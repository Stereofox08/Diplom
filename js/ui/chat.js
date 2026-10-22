/* ==========================================================================
   ByteStore — ИИ-чат-бот поддержки (виджет на всех страницах магазина)
   Использует BS.advisor.askChat: ИИ-модель при наличии подключения, иначе —
   встроенные сценарные ответы (пользователь разницы не видит).
   Диалог сохраняется между страницами.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var chat = (BS.chat = {});

  var HISTORY_KEY = 'chat-history';
  var MAX_STORED = 12;

  chat.QUICK = [
    'Собери игровой ПК за 700 000 ₸ для 1440p',
    'Совместимы ли Ryzen 5 7600 и плата B650M?',
    'Какая доставка и сколько стоит?',
    'Есть действующие промокоды?'
  ];

  chat.history = [];

  /* ------------------------------- Разметка ------------------------------- */
  chat.mount = function (root) {
    if (U.$('#chatPanel')) return;
    var host = root || document.body;
    host.insertAdjacentHTML('beforeend', '' +
      '<button class="chat-fab" data-chat-fab aria-label="Открыть ИИ-ассистента">' +
      BS.icon('robot', { size: 26 }) + '<span class="chat-fab__dot" title="Ассистент онлайн"></span></button>' +
      '<section class="chat-panel hide" id="chatPanel" aria-label="Чат с ИИ-ассистентом">' +
      '<header class="chat-head">' +
      '<span class="chat-head__ava">' + BS.icon('robot', { size: 22 }) + '</span>' +
      '<div class="grow"><div class="strong">ИИ-ассистент ByteStore</div>' +
      '<div class="small muted" data-chat-status>Онлайн · отвечаю мгновенно</div>' +
      '</div>' +
      '<div class="chat-head__tools">' +
      '<button class="chat-head__action" data-chat-reset aria-label="Очистить диалог" title="Очистить диалог">' +
      BS.icon('trash', { size: 16 }) + '</button>' +
      '<button class="chat-head__expand" data-chat-expand aria-label="Развернуть чат" title="Развернуть чат">⛶</button>' +
      '<button class="modal-close" data-chat-close aria-label="Закрыть чат">×</button>' +
      '</div>' +
      '</header>' +
      '<div class="chat-msgs" id="chatMsgs"></div>' +
      '<div class="chat-quick" id="chatQuick">' + chat.QUICK.map(function (text) {
        return '<button class="chip" data-chat-quick="' + U.attr(text) + '">' + U.esc(text.slice(0, 34)) + '</button>';
      }).join('') + '</div>' +
      '<form class="chat-form" data-chat-form>' +
      '<input class="input" data-chat-input placeholder="Спросите про комплектующие…" autocomplete="off" ' +
      'aria-label="Сообщение ассистенту">' +
      '<button class="btn btn--primary" type="submit" aria-label="Отправить">' +
      BS.icon('send', { size: 18 }) + '</button>' +
      '</form></section>');

    chat.history = U.storage.get(HISTORY_KEY, []);
    var quick = U.$('#chatQuick');
    if (quick && chat.history.length) quick.hidden = true;
    if (!chat.history.length) {
      chat.push('assistant', 'Здравствуйте! Я ИИ-ассистент ByteStore 🤖\n\n' +
        'Помогу подобрать комплектующие, проверю совместимость деталей, расскажу про доставку, гарантию ' +
        'и статус заказа. Напишите задачу и бюджет — например: «собери ПК для 1440p за 900 000 ₸».', null, true);
    } else {
      chat.history.forEach(function (item) {
        chat.renderMessage(item.role, item.content, db.productsByIds(item.products || []), true);
      });
    }
    chat.wire();
  };

  /* ------------------------------ Рендер сообщений ------------------------ */
  chat.productCards = function (products) {
    if (!products || !products.length) return '';
    var visible = products.slice(0, 2);
    return '<div class="chat-cards">' + visible.map(function (p) {
      var category = db.category(p.categoryId) || {};
      return '<div class="chat-card"><span class="chat-card__icon">' + (category.emoji || '📦') + '</span>' +
        '<span class="grow"><a class="chat-card__name" href="product.html?id=' + U.attr(p.id) + '">' +
        U.esc(p.name) + '</a><span class="chat-card__price">' + U.money(p.price) + '</span></span>' +
        '<button class="btn btn--soft btn--xs" data-add-cart="' + U.attr(p.id) + '">В корзину</button></div>';
    }).join('') + '</div>' + (products.length > visible.length
      ? '<a class="chat-cards__more" href="catalog.html">Показать ещё ' +
        (products.length - visible.length) + ' в каталоге</a>' : '');
  };

  /**
   * Кнопка переноса сборки из ответа ИИ в конфигуратор.
   * Показывается, если в сообщении есть хотя бы одна деталь для сборки ПК.
   */
  chat.configuratorBar = function (products) {
    if (!products || !products.length) return '';
    var mapped = BS.advisor.buildFromProducts(products);
    var parts = Object.keys(mapped.full);
    if (!parts.length) return '';
    var coreCount = Object.keys(mapped.build).length;
    var total = mapped.total;
    return '<div class="chat-cards-actions">' +
      '<button class="btn btn--primary btn--sm" data-chat-to-configurator="' +
      U.attr(products.map(function (p) { return p.id; }).join(',')) + '">' +
      BS.icon('tool', { size: 15 }) + 'Добавить в конфигуратор' +
      '<span class="badge badge--solid">' + parts.length + '</span></button>' +
      '<span class="muted small">Перенесём ' + coreCount + ' ' +
      U.plural(coreCount, 'компонент', 'компонента', 'компонентов') +
      (parts.length > coreCount ? ' + периферия' : '') +
      ' · ' + U.money(total) + '</span></div>';
  };

  /** Перенос комплектующих из ответа чата в ручную сборку конфигуратора. */
  chat.toConfigurator = function (ids) {
    var products = db.productsByIds(String(ids || '').split(',').filter(Boolean));
    if (!products.length) {
      L.toast('Не удалось определить комплектующие в ответе', 'warn');
      return;
    }
    var mapped = BS.advisor.buildFromProducts(products);
    var stored = {};
    Object.keys(mapped.full).forEach(function (slot) { stored[slot] = mapped.full[slot].id; });
    if (!Object.keys(stored).length) {
      L.toast('В этом сообщении нет комплектующих для сборки — уточните запрос у ИИ', 'warn');
      return;
    }
    U.storage.set('manual-build', stored);
    U.storage.set('manual-build-meta', {
      at: Date.now(),
      from: 'chat',
      count: Object.keys(stored).length,
      skipped: mapped.skipped.map(function (item) { return item.product.name + ' (' + item.reason + ')'; })
    });
    db.track('chat_to_configurator', {
      label: Object.keys(mapped.build).join(','),
      value: mapped.total
    });
    window.location.href = 'configurator.html?tab=manual&from=chat';
  };

  chat.renderMessage = function (role, content, products, skipStore) {
    var box = U.$('#chatMsgs');
    if (!box) return;
    var isMe = role === 'user';
    var messageText = String(content || '');
    var canCollapse = !isMe && messageText.length > 650;
    var messageHtml = isMe
      ? '<p>' + U.esc(messageText) + '</p>'
      : '<div class="chat-msg__text' + (canCollapse ? ' is-collapsed' : '') + '" data-chat-text>' +
        U.markdown(messageText) + '</div>' + (canCollapse
          ? '<button class="chat-msg__more" data-chat-more>Показать ответ целиком</button>' : '');
    var node = U.el('<div class="chat-msg ' + (isMe ? 'chat-msg--me' : 'chat-msg--ai') + '"></div>');
    node.innerHTML = '<span class="chat-msg__ava">' + (isMe ? '🙋' : BS.icon('robot', { size: 16 })) + '</span>' +
      '<div class="chat-msg__bubble">' + messageHtml +
      chat.productCards(products) +
      (isMe ? '' : chat.configuratorBar(products)) + '</div>';
    box.appendChild(node);
    box.scrollTop = box.scrollHeight;
    if (!skipStore) {
      chat.history.push({
        role: role, content: content,
        products: (products || []).map(function (p) { return p.id; })
      });
      if (chat.history.length > MAX_STORED) chat.history = chat.history.slice(-MAX_STORED);
      U.storage.set(HISTORY_KEY, chat.history);
    }
  };

  chat.push = function (role, content, products, skipStore) {
    chat.renderMessage(role, content, products, skipStore);
  };

  chat.typing = function (show) {
    var box = U.$('#chatMsgs');
    if (!box) return;
    var existing = U.$('#chatTyping');
    if (!show) { if (existing) existing.remove(); return; }
    if (existing) return;
    var node = U.el('<div class="chat-msg chat-msg--ai" id="chatTyping">' +
      '<span class="chat-msg__ava">' + BS.icon('robot', { size: 16 }) + '</span>' +
      '<div class="chat-msg__bubble"><span class="chat-typing"><i></i><i></i><i></i></span> ' +
      '<span class="small muted">ассистент печатает…</span></div></div>');
    box.appendChild(node);
    box.scrollTop = box.scrollHeight;
  };
  /* --------------------------------- Логика ------------------------------- */
  chat.open = function () {
    var panel = U.$('#chatPanel');
    if (!panel) return;
    panel.classList.remove('hide');
    var input = U.$('[data-chat-input]');
    if (input) setTimeout(function () { input.focus(); }, 120);
    db.track('chat_open', {});
  };
  chat.close = function () {
    var panel = U.$('#chatPanel');
    if (panel) panel.classList.add('hide');
  };
  chat.toggle = function () {
    var panel = U.$('#chatPanel');
    if (!panel) return;
    if (panel.classList.contains('hide')) chat.open(); else chat.close();
  };

  chat.send = function (text) {
    var message = String(text || '').trim();
    if (!message) return Promise.resolve();
    var quick = U.$('#chatQuick');
    if (quick) quick.hidden = true;
    chat.renderMessage('user', message);
    var input = U.$('[data-chat-input]');
    if (input) input.value = '';
    chat.typing(true);
    var started = Date.now();
    return BS.advisor.askChat(message, chat.history.slice(0, -1).slice(-MAX_STORED))
      .then(function (result) {
        chat.typing(false);
        chat.renderMessage('assistant', result.content, result.products);
        if (result.source === 'ai') {
          db.track('chat_answer', { label: 'ai', value: Date.now() - started });
        }
      })
      .catch(function () {
        chat.typing(false);
        chat.renderMessage('assistant', 'Не удалось получить ответ. Попробуйте ещё раз или позвоните: ' + U.APP.phone + '.');
      });
  };

  chat.reset = function () {
    chat.history = [];
    U.storage.remove(HISTORY_KEY);
    var box = U.$('#chatMsgs');
    if (box) box.innerHTML = '';
    var quick = U.$('#chatQuick');
    if (quick) quick.hidden = false;
    chat.push('assistant', 'Диалог очищен. Чем помочь по комплектующим?', null, true);
  };

  /* ------------------------------- Обработчики ---------------------------- */
  chat.wire = function () {
    var fab = U.$('[data-chat-fab]');
    if (fab) fab.addEventListener('click', function () { chat.toggle(); });
    var closeBtn = U.$('[data-chat-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { chat.close(); });
    var resetBtn = U.$('[data-chat-reset]');
    if (resetBtn) resetBtn.addEventListener('click', function () { chat.reset(); });
    var expandBtn = U.$('[data-chat-expand]');
    var panel = U.$('#chatPanel');
    if (expandBtn && panel) {
      expandBtn.addEventListener('click', function () {
        var expanded = panel.classList.toggle('is-expanded');
        expandBtn.textContent = expanded ? '↙' : '⛶';
        expandBtn.setAttribute('aria-label', expanded ? 'Свернуть чат' : 'Развернуть чат');
        expandBtn.title = expanded ? 'Свернуть чат' : 'Развернуть чат';
      });
    }
    if (panel) {
      panel.addEventListener('click', function (e) {
        var more = e.target.closest('[data-chat-more]');
        if (!more) return;
        var text = more.parentNode.querySelector('[data-chat-text]');
        if (!text) return;
        var expanded = text.classList.toggle('is-collapsed') === false;
        more.textContent = expanded ? 'Свернуть ответ' : 'Показать ответ целиком';
      });
    }
    var form = U.$('[data-chat-form]');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('[data-chat-input]');
        chat.send(input.value);
      });
    }
    var quick = U.$('#chatQuick');
    if (quick) {
      quick.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-chat-quick]');
        if (!chip) return;
        chat.send(chip.getAttribute('data-chat-quick'));
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var panel = U.$('#chatPanel');
        if (panel && !panel.classList.contains('hide')) chat.close();
      }
    });
    /* Кнопка «Добавить в конфигуратор» в ответе ИИ */
    document.addEventListener('click', function (e) {
      var toConfigurator = e.target.closest('[data-chat-to-configurator]');
      if (toConfigurator) {
        e.preventDefault();
        chat.toConfigurator(toConfigurator.getAttribute('data-chat-to-configurator'));
        return;
      }
      /* Кнопки «спросить у ИИ» на страницах магазина */
      var ask = e.target.closest('[data-ask-ai]');
      if (!ask) return;
      e.preventDefault();
      chat.open();
      var question = ask.getAttribute('data-ask-ai');
      if (question) chat.send(question);
    });
  };
})();
