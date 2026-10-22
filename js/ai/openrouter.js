/* ==========================================================================
   ByteStore — Клиент OpenRouter с автоматическим выбором бесплатной модели
   Администратор вводит только API-ключ. Дальше система:
     1) получает список бесплатных моделей (pricing = 0, суффикс :free);
     2) сортирует их по приоритету качества и объёму контекста;
     3) проверяет доступность каждой реальным запросом-пробой;
     4) запоминает первую рабочую модель как активную (model);
     5) при сбое запрос автоматически уходит на следующую живую модель
        (failover), а неудачная «остывает» на 10 минут.
   Витрина не знает этих деталей: пользователю показывается только нейтральный
   статус «ИИ-ассистент ByteStore».
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var ai = (BS.ai = {});

  var CHAT_TIMEOUT = 18000;      // не держим покупателя в ожидании медленной модели
  var PROBE_TIMEOUT = 12000;     // ожидание проверки модели
  var VERIFY_TTL = 30 * 60000;   // как часто перепроверять активную модель
  var COOLDOWN = 10 * 60000;     // «остывание» модели после ошибки
  var MAX_ATTEMPTS = 2;          // быстрый переход на резервную модель

  /* Приоритет семейств моделей: чем раньше в списке, тем охотнее выбираем. */
  var PREFERRED = [
    /gemini-.*flash/i, /qwen3-8b/i, /mistral-small/i, /llama-3\.2/i,
    /qwen3-32b/i, /deepseek/i, /glm-4\.5/i, /gpt-oss/i,
    /llama-3\.3-70b/i, /deepseek-chat-v3/i, /qwen3-235b/i, /llama-3\.1-70b/i,
    /mistral/i, /llama/i
  ];

  ai.settings = function () { return db.aiSettings(); };
  ai.configured = function () {
    var s = ai.settings();
    return !!(s.enabled && s.apiKey && String(s.apiKey).trim().length > 10);
  };

  /** Нейтральный статус для витрины: детали подключения пользователю не нужны. */
  ai.status = function () {
    return { ok: true, label: 'ИИ-ассистент ByteStore', cls: '' };
  };

  /** Диагностика для админ-панели: ключ, активная модель, проверки, сбои. */
  ai.diagnostics = function () {
    var s = ai.settings();
    var failed = s.failedModels || {};
    var now = Date.now();
    return {
      hasKey: !!(s.apiKey && String(s.apiKey).length > 10),
      enabled: !!s.enabled,
      activeModel: s.model || null,
      verifiedAt: s.verifiedAt || null,
      freeCount: (s.freeModels || []).length,
      lastSync: s.lastSync || null,
      lastError: s.lastError || null,
      cooldown: Object.keys(failed).filter(function (key) { return failed[key] > now; })
        .map(function (key) { return { model: key, until: failed[key] }; }),
      candidates: ai.candidates().length
    };
  };

  function shortModel(model) {
    return String(model || '').split('/').pop().replace(':free', '');
  }
  ai.shortModel = shortModel;

  /** Оценка приоритета модели: меньше — лучше. */
  function rank(model) {
    var id = String(model.id || '');
    var priority = PREFERRED.length;
    for (var i = 0; i < PREFERRED.length; i++) {
      if (PREFERRED[i].test(id)) { priority = i; break; }
    }
    var context = Number(model.context) || 0;
    return priority * 1000000 - Math.min(context, 1000000);
  }

  /** Базовый список моделей, если список OpenRouter ещё не загружен. */
  ai.defaultModels = function () {
    return [
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (free)', context: 1048576 },
      { id: 'qwen/qwen3-8b:free', name: 'Qwen3 8B (free)', context: 40960 },
      { id: 'mistralai/mistral-small-3.2-24b-instruct:free', name: 'Mistral Small 3.2 24B (free)', context: 131072 },
      { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (free)', context: 131072 },
      { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek Chat v3.1 (free)', context: 131072 },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (free)', context: 131072 }
    ];
  };

  /** Порядок перебора моделей: активная, затем «живые» по приоритету. */
  ai.candidates = function () {
    var s = ai.settings();
    var failed = s.failedModels || {};
    var now = Date.now();
    var seen = {};
    var pool = (s.freeModels || []).filter(function (model) {
      if (!model || !model.id || seen[model.id]) return false;
      seen[model.id] = true;
      return true;
    });
    if (!pool.length) pool = ai.defaultModels();
    var alive = pool.filter(function (model) { return !failed[model.id] || failed[model.id] < now; });
    var ordered = (alive.length ? alive : pool).slice().sort(function (a, b) { return rank(a) - rank(b); });
    var active = s.model;
    if (active && !ordered.some(function (model) { return model.id === active; })) {
      ordered.push({ id: active, name: shortModel(active), context: s.contextLength || 0 });
      ordered.sort(function (a, b) { return rank(a) - rank(b); });
    }
    return ordered;
  };

  /** Список моделей для отображения в админке. */
  ai.modelOptions = function () {
    var cached = ai.settings().freeModels || [];
    return cached.length ? cached : ai.defaultModels();
  };

  function markFailed(model, reason) {
    if (!model) return;
    var s = ai.settings();
    var failed = Object.assign({}, s.failedModels || {});
    failed[model] = Date.now() + COOLDOWN;
    db.updateAiSettings({ failedModels: failed, lastError: reason || null });
  }
  ai.markFailed = markFailed;
  /* --------------------------- HTTP-запрос к модели ----------------------- */
  /** Прямой запрос к chat/completions с таймаутом и разбором ошибок. */
  function request(model, messages, opts) {
    opts = opts || {};
    var settings = ai.settings();
    var key = String(settings.apiKey || '').trim();
    if (!key) {
      return Promise.resolve({ ok: false, fallback: true, message: 'API-ключ не задан', reason: 'no-key' });
    }
    var payload = {
      model: model,
      messages: messages,
      temperature: opts.temperature === undefined ? (settings.temperature || 0.4) : opts.temperature,
      max_tokens: opts.maxTokens || (opts.probe ? 8 : (settings.maxTokens || 1200))
    };
    if (opts.json) payload.response_format = { type: 'json_object' };

    var controller = null, timer = null;
    var init = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': location.origin && location.origin !== 'null' ? location.origin : 'https://bytestore.kz',
        'X-Title': 'ByteStore'
      },
      body: JSON.stringify(payload)
    };
    if (window.AbortController) {
      controller = new window.AbortController();
      init.signal = controller.signal;
      timer = setTimeout(function () { controller.abort(); }, opts.timeout || CHAT_TIMEOUT);
    }
    var started = Date.now();
    return fetch(settings.baseUrl.replace(/\/$/, '') + '/chat/completions', init)
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try { data = JSON.parse(text); } catch (e) { data = null; }
          if (!response.ok) {
            return {
              ok: false, fallback: true, status: response.status, model: model,
              message: describeError(response.status, data), reason: 'http-' + response.status
            };
          }
          var choice = data && data.choices && data.choices[0];
          var content = choice && choice.message ? choice.message.content : '';
          if (!content) {
            return { ok: false, fallback: true, status: response.status, model: model,
              message: 'Модель вернула пустой ответ', reason: 'empty' };
          }
          return {
            ok: true, content: content, model: (data && data.model) || model,
            usage: (data && data.usage) || null, ms: Date.now() - started
          };
        });
      })
      .catch(function (error) {
        var aborted = error && (error.name === 'AbortError' || String(error).indexOf('abort') !== -1);
        return {
          ok: false, fallback: true, model: model, reason: aborted ? 'timeout' : 'network',
          message: aborted ? 'Превышено время ожидания ответа модели' : 'Нет связи с сервисом ИИ'
        };
      })
      .then(function (result) {
        if (timer) clearTimeout(timer);
        if (result.ok && !opts.probe) {
          db.track('ai_request', { label: result.model, value: result.usage ? result.usage.total_tokens : 0 });
        }
        return result;
      });
  }
  ai.request = request;

  function describeError(status, data) {
    var detail = data && data.error ? (data.error.message || data.error.code) : '';
    if (status === 401) return 'Неверный API-ключ';
    if (status === 402) return 'Исчерпан бесплатный лимит ключа';
    if (status === 403) return 'Модель требует платный аккаунт';
    if (status === 404) return 'Модель недоступна';
    if (status === 429) return 'Лимит запросов бесплатного тарифа';
    if (status >= 500) return 'Сервис временно недоступен';
    return 'Ошибка запроса' + (status ? ' (HTTP ' + status + ')' : '') + (detail ? ': ' + detail : '');
  }

  /* ---------------------- Проверка доступности модели --------------------- */
  /** Короткий запрос-проба: жива ли модель прямо сейчас. */
  ai.probeModel = function (model) {
    return request(model, [{ role: 'user', content: 'ping' }], { probe: true, timeout: PROBE_TIMEOUT })
      .then(function (result) {
        return { ok: result.ok, model: model, message: result.message || '', ms: result.ms || 0 };
      });
  };
  /** Актуализация списка бесплатных моделей из OpenRouter. */
  ai.listFreeModels = function () {
    var settings = ai.settings();
    return fetch(settings.baseUrl.replace(/\/$/, '') + '/models', { method: 'GET' })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var models = (data && data.data) || [];
        var free = models.filter(function (model) {
          var price = model.pricing || {};
          var isFree = Number(price.prompt) === 0 && Number(price.completion) === 0;
          return isFree && /:free$/.test(model.id || '');
        }).map(function (model) {
          return {
            id: model.id,
            name: model.name || model.id,
            context: model.context_length || 0,
            description: model.description || ''
          };
        }).sort(function (a, b) { return rank(a) - rank(b); });
        if (free.length) db.updateAiSettings({ freeModels: free, lastSync: Date.now() });
        return {
          ok: free.length > 0,
          models: free,
          message: free.length
            ? 'Найдено бесплатных моделей: ' + free.length
            : 'Список пуст — использую сохранённый'
        };
      })
      .catch(function () {
        return {
          ok: false,
          models: settings.freeModels || [],
          message: 'Список моделей недоступен, использую сохранённый'
        };
      });
  };

  /**
   * Автоматический выбор рабочей модели.
   * Список бесплатных моделей → сортировка по приоритету → параллельная проба
   * лучших кандидатов → активной становится первая живая по приоритету.
   * @param {{force:boolean, limit:number}} [options]
   */
  ai.selectModel = function (options) {
    options = options || {};
    var limit = options.limit || 4;
    if (!ai.configured()) {
      return Promise.resolve({ ok: false, fallback: true, message: 'API-ключ не задан', reason: 'no-key' });
    }
    var settings = ai.settings();
    var needList = options.force || !(settings.freeModels || []).length ||
      !settings.lastSync || (Date.now() - settings.lastSync) > 24 * 3600000;
    var prepare = needList ? ai.listFreeModels() : Promise.resolve({ ok: true });
    return prepare.then(function () {
      var candidates = ai.candidates().slice(0, limit);
      if (!candidates.length) {
        return { ok: false, fallback: true, reason: 'no-candidates', message: 'Нет доступных бесплатных моделей' };
      }
      return Promise.all(candidates.map(function (model) {
        return ai.probeModel(model.id).then(function (result) {
          return { model: model, ok: result.ok, message: result.message, ms: result.ms };
        });
      })).then(function (results) {
        var checked = results.map(function (item) {
          return { model: item.model.id, ok: item.ok, message: item.message };
        });
        var winner = null;
        results.forEach(function (item) {
          if (item.ok && !winner) winner = item;          // приоритет сохранён порядком списка
          else if (!item.ok) markFailed(item.model.id, item.message);
        });
        if (!winner) {
          return {
            ok: false, fallback: true, checked: checked, reason: 'all-failed',
            message: 'Ни одна модель сейчас не ответила — работает экспертный движок'
          };
        }
        db.updateAiSettings({
          model: winner.model.id,
          contextLength: winner.model.context || 0,
          verifiedAt: Date.now(),
          lastError: null
        });
        return {
          ok: true, model: winner.model.id, name: winner.model.name || shortModel(winner.model.id),
          checked: checked, ms: winner.ms
        };
      });
    });
  };

  /** Выбор модели с кэшированием: перепроверка не чаще одного раза в 30 минут. */
  ai.ensureModel = function (options) {
    options = options || {};
    var settings = ai.settings();
    var fresh = settings.model && settings.verifiedAt && (Date.now() - settings.verifiedAt) < VERIFY_TTL;
    if (fresh && !options.force) {
      return Promise.resolve({ ok: true, model: settings.model, cached: true });
    }
    /* В пользовательском чате не тратим время на серию проб: сразу обращаемся
       к быстрой модели из списка, а недоступность определит сам запрос. */
    if (!options.force && ai.candidates().length) {
      return Promise.resolve({ ok: true, model: ai.candidates()[0].id, cached: true });
    }
    if (ai._pending && !options.force) return ai._pending;
    ai._pending = ai.selectModel(options).then(function (result) {
      ai._pending = null;
      return result;
    }).catch(function (error) {
      ai._pending = null;
      return { ok: false, fallback: true, message: String(error), reason: 'error' };
    });
    return ai._pending;
  };
  /* -------------------- Запрос с автоматическим failover ------------------ */
  /**
   * Основная точка входа: сама выбирает/перепроверяет модель, а при сбое
   * молча переключается на следующую доступную.
   * @param {Array<{role:string,content:string}>} messages
   * @param {{json:boolean, temperature:number, maxTokens:number, force:boolean}} [opts]
   */
  ai.chat = function (messages, opts) {
    opts = opts || {};
    var settings = ai.settings();
    if (!settings.enabled) {
      return Promise.resolve({ ok: false, fallback: true, message: 'ИИ отключён в настройках', reason: 'disabled' });
    }
    if (!ai.configured()) {
      return Promise.resolve({ ok: false, fallback: true, message: 'API-ключ не задан', reason: 'no-key' });
    }
    return ai.ensureModel({ force: opts.force }).then(function (ready) {
      if (!ready.ok) {
        return {
          ok: false, fallback: true, reason: ready.reason || 'unavailable',
          message: ready.message, checked: ready.checked
        };
      }
      var queue = ai.candidates().slice(0, MAX_ATTEMPTS);
      var tried = [], requestStarted = Date.now();
      var requestBudget = opts.timeout || CHAT_TIMEOUT;
      function remainingTimeout() {
        return Math.max(5000, requestBudget - (Date.now() - requestStarted));
      }
      return queue.reduce(function (chain, candidate) {
        return chain.then(function (result) {
          if (result) return result;
          return request(candidate.id, messages, {
            json: opts.json, temperature: opts.temperature, maxTokens: opts.maxTokens,
            timeout: remainingTimeout()
          }).then(function (res) {
            if (res.ok) {
              tried.push({ model: candidate.id, ok: true, ms: res.ms });
              if (candidate.id !== ai.settings().model) {
                db.updateAiSettings({
                  model: candidate.id, verifiedAt: Date.now(),
                  contextLength: candidate.context || 0, lastError: null
                });
              }
              res.tried = tried;
              return res;
            }
            tried.push({ model: candidate.id, ok: false, message: res.message });
            /* Модель не поддерживает JSON-режим — повторяем без него */
            if (opts.json && res.status === 400) {
              return request(candidate.id, messages, {
                temperature: opts.temperature, maxTokens: opts.maxTokens,
                timeout: remainingTimeout()
              }).then(function (retry) {
                if (retry.ok) {
                  tried[tried.length - 1] = { model: candidate.id, ok: true, note: 'без JSON-режима' };
                  retry.tried = tried;
                  return retry;
                }
                markFailed(candidate.id, retry.message);
                return null;
              });
            }
            ai.markFailed(candidate.id, res.message);
            return null;
          });
        });
      }, Promise.resolve(null)).then(function (result) {
        if (result) return result;
        return {
          ok: false, fallback: true, reason: 'all-failed', tried: tried,
          message: 'Все модели сейчас недоступны — отвечает экспертный движок'
        };
      });
    });
  };

  /**
   * Проверка подключения для админ-панели: принудительно перепроверяет модели.
   * @param {{limit:number}} [options]
   */
  ai.test = function (options) {
    options = options || {};
    if (!ai.configured()) {
      return Promise.resolve({
        ok: false, model: null, checked: [],
        message: 'Укажите API-ключ OpenRouter — модели будут выбраны автоматически'
      });
    }
    return ai.selectModel({ force: true, limit: options.limit || 5 }).then(function (result) {
      if (!result.ok) {
        var reasons = (result.checked || []).map(function (item) {
          return shortModel(item.model) + (item.message ? ' — ' + item.message : '');
        });
        return {
          ok: false, model: null, checked: result.checked || [],
          message: 'Не удалось найти рабочую модель' + (reasons.length ? ': ' + reasons.join('; ') : '')
        };
      }
      return {
        ok: true,
        model: result.model,
        checked: result.checked || [],
        message: 'Активная модель: ' + shortModel(result.model) +
          (result.ms ? ' (ответ за ' + result.ms + ' мс)' : '') +
          ((result.checked || []).length
            ? '. Проверено моделей: ' + (result.checked.length + 1) : '')
      };
    });
  };
})();

