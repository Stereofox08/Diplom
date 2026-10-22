/* ==========================================================================
   ByteStore — Ядро: общие утилиты (DOM, форматирование, хранилище, крипто)
   Модуль не зависит от других и загружается первым.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var util = (BS.util = {});

  /* --------------------------- Константы проекта -------------------------- */
  util.APP = {
    name: 'ByteStore',
    version: '1.0.0',
    slogan: 'Комплектующие и ИИ-подбор',
    phone: '+7 (727) 355-31-08',
    email: 'support@bytestore.kz',
    address: 'г. Алматы, ул. Процессорная, 16, стр. 1',
    workHours: 'Ежедневно 09:00 — 21:00',
    currency: '₸',
    deliveryCost: 2990,
    freeDeliveryFrom: 250000
  };

  /* ------------------------------- DOM ----------------------------------- */
  util.$ = function (sel, root) { return (root || document).querySelector(sel); };
  util.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  util.el = function (html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  };
  util.html = function (target, markup) {
    var node = typeof target === 'string' ? util.$(target) : target;
    if (node) node.innerHTML = markup;
    return node;
  };
  util.delegate = function (root, event, selector, handler) {
    var node = typeof root === 'string' ? util.$(root) : root;
    if (!node) return function () {};
    function listener(e) {
      var t = e.target.closest(selector);
      if (t && node.contains(t)) handler.call(t, e, t);
    }
    node.addEventListener(event, listener);
    return function () { node.removeEventListener(event, listener); };
  };
  util.esc = function (value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  util.attr = function (value) { return util.esc(value); };

  /* ---------------------------- Форматирование ---------------------------- */
  util.num = function (value, digits) {
    var n = Number(value) || 0;
    return n.toLocaleString('ru-KZ', {
      minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0
    });
  };
  util.money = function (value) { return util.num(Math.round(Number(value) || 0)) + ' ' + util.APP.currency; };
  util.kilo = function (value) {
    var n = Number(value) || 0;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + ' млн ₸';
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + ' тыс ₸';
    return util.money(n);
  };
  util.pct = function (value, digits) { return util.num(value, digits === undefined ? 1 : digits) + '%'; };
  util.plural = function (n, one, few, many) {
    var num = Math.abs(Number(n)) % 100, mod = num % 10;
    if (num > 10 && num < 20) return many;
    if (mod > 1 && mod < 5) return few;
    if (mod === 1) return one;
    return many;
  };
  util.declOfNum = function (n, titles) { return titles[0] + ' ' + util.plural(n, titles[1], titles[2], titles[3]); };
  util.pad = function (n, len) {
    var s = String(n);
    while (s.length < (len || 2)) s = '0' + s;
    return s;
  };
  util.date = function (ts, withTime) {
    var d = ts instanceof Date ? ts : new Date(ts || Date.now());
    if (isNaN(d.getTime())) return '—';
    var out = util.pad(d.getDate()) + '.' + util.pad(d.getMonth() + 1) + '.' + d.getFullYear();
    if (withTime) out += ' ' + util.pad(d.getHours()) + ':' + util.pad(d.getMinutes());
    return out;
  };
  util.isoDay = function (ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    return d.getFullYear() + '-' + util.pad(d.getMonth() + 1) + '-' + util.pad(d.getDate());
  };
  util.monthName = function (m) {
    return ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
      'августа', 'сентября', 'октября', 'ноября', 'декабря'][m];
  };
  util.shortMonth = function (m) {
    return ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][m];
  };
  util.timeAgo = function (ts) {
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return util.declOfNum(Math.floor(diff / 60), ['', 'минуту', 'минуты', 'минут']) + ' назад';
    if (diff < 86400) return util.declOfNum(Math.floor(diff / 3600), ['', 'час', 'часа', 'часов']) + ' назад';
    if (diff < 2592000) return util.declOfNum(Math.floor(diff / 86400), ['', 'день', 'дня', 'дней']) + ' назад';
    return util.date(ts);
  };
  util.bytes = function (bytes) {
    var units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'], i = 0, b = Number(bytes) || 0;
    while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
    return (i === 0 ? b : b.toFixed(1)) + ' ' + units[i];
  };
  /* ------------------------- Хранилище (localStorage) --------------------- */
  var memory = {};
  var canUseLS = (function () {
    try {
      var k = '__bs_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var storage = (util.storage = {
    prefix: 'bs:',
    available: canUseLS,
    get: function (key, fallback) {
      try {
        var raw = canUseLS ? window.localStorage.getItem(storage.prefix + key) : memory[key];
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try {
        var raw = JSON.stringify(value);
        if (canUseLS) window.localStorage.setItem(storage.prefix + key, raw);
        else memory[key] = raw;
        return true;
      } catch (e) { return false; }
    },
    remove: function (key) {
      try {
        if (canUseLS) window.localStorage.removeItem(storage.prefix + key);
        delete memory[key];
      } catch (e) { /* ignore */ }
    },
    /** Полная очистка данных магазина (используется в админке). */
    clearAll: function () {
      try {
        if (canUseLS) {
          Object.keys(window.localStorage).forEach(function (k) {
            if (k.indexOf(storage.prefix) === 0) window.localStorage.removeItem(k);
          });
        }
        memory = {};
      } catch (e) { /* ignore */ }
    },
    /** Оценка занятого объёма (для настроек админки). */
    usedBytes: function () {
      try {
        var total = 0;
        if (canUseLS) {
          Object.keys(window.localStorage).forEach(function (k) {
            if (k.indexOf(storage.prefix) === 0) total += k.length + (window.localStorage.getItem(k) || '').length;
          });
        } else {
          Object.keys(memory).forEach(function (k) { total += k.length + memory[k].length; });
        }
        return total * 2;
      } catch (e) { return 0; }
    }
  });

  /* ------------------------------ Криптография ---------------------------- */
  util.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };
  util.salt = function () {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  };
  util.sha256 = function (text) {
    var value = String(text);
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle.digest('SHA-256', new window.TextEncoder().encode(value))
        .then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('00' + b.toString(16)).slice(-2);
          }).join('');
        })
        .catch(function () { return util.fallbackHash(value); });
    }
    return Promise.resolve(util.fallbackHash(value));
  };
  /** Резервный хеш (FNV-1a) для среды без WebCrypto (например, file://). */
  util.fallbackHash = function (text) {
    var h = 0x811c9dc5, str = String(text), out = '';
    for (var round = 0; round < 4; round++) {
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i) + round;
        h = (h * 0x01000193) >>> 0;
      }
      out += ('00000000' + h.toString(16)).slice(-8);
    }
    return 'fnv' + out;
  };
  /** Хеш пароля с солью — единая точка для регистрации и входа. */
  util.hashPassword = function (password, salt) {
    return util.sha256('bytestore::' + salt + '::' + password);
  };
  util.passwordScore = function (password) {
    var p = String(password || ''), score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-zА-Яа-я0-9]/.test(p)) score++;
    return Math.min(score, 4);
  };
  /* ------------------------------- Хелперы -------------------------------- */
  util.clamp = function (v, min, max) { return Math.min(Math.max(v, min), max); };
  util.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  util.debounce = function (fn, wait) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 250);
    };
  };
  util.throttle = function (fn, wait) {
    var last = 0, timer = null;
    return function () {
      var args = arguments, ctx = this, now = Date.now();
      if (now - last >= (wait || 200)) { last = now; fn.apply(ctx, args); }
      else if (!timer) {
        timer = setTimeout(function () { last = Date.now(); timer = null; fn.apply(ctx, args); },
          (wait || 200) - (now - last));
      }
    };
  };
  /** Детерминированный ГПСЧ (mulberry32) — нужен для стабильных демо-данных. */
  util.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  util.randInt = function (min, max, rnd) {
    var r = (rnd || Math.random)();
    return Math.floor(r * (max - min + 1)) + min;
  };
  util.pick = function (arr, rnd) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor((rnd || Math.random)() * arr.length)];
  };
  util.shuffle = function (arr, rnd) {
    var a = arr.slice(), r = rnd || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };
  util.sum = function (arr, getter) {
    return (arr || []).reduce(function (acc, item) {
      return acc + (Number(getter ? getter(item) : item) || 0);
    }, 0);
  };
  util.avg = function (arr, getter) {
    return arr && arr.length ? util.sum(arr, getter) / arr.length : 0;
  };
  util.groupBy = function (arr, getKey) {
    var out = {};
    (arr || []).forEach(function (item) {
      var k = getKey(item);
      (out[k] = out[k] || []).push(item);
    });
    return out;
  };
  util.deepClone = function (value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (e) { return value; }
  };
  util.slug = function (text) {
    return String(text || '').toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  };
  util.bytesFmt = util.bytes;

  /* --------------------------- URL / параметры ---------------------------- */
  util.qs = function (name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) { return null; }
  };
  util.qsAll = function () {
    var out = {};
    try {
      new URLSearchParams(window.location.search).forEach(function (v, k) { out[k] = v; });
    } catch (e) { /* ignore */ }
    return out;
  };
  util.setQs = function (params, replace) {
    try {
      var url = new URL(window.location.href);
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v === null || v === undefined || v === '') url.searchParams.delete(k);
        else url.searchParams.set(k, v);
      });
      if (replace !== false) window.history.replaceState({}, '', url.toString());
      return url.toString();
    } catch (e) { return window.location.href; }
  };

  /* --------------------------- Файлы и буфер ----------------------------- */
  util.copyText = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return util.copyFallback(text); });
    }
    return Promise.resolve(util.copyFallback(text));
  };
  util.copyFallback = function (text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (e) { return false; }
  };
  util.download = function (filename, content, mime) {
    try {
      var blob = new Blob(['\uFEFF' + content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { return false; }
  };
  /** Массив объектов -> CSV-строка (для выгрузок в админке). */
  util.toCsv = function (rows, columns) {
    if (!rows || !rows.length) return '';
    var cols = columns || Object.keys(rows[0]);
    function cell(v) {
      var s = v === null || v === undefined ? '' : String(v);
      if (/[";\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [cols.join(';')];
    rows.forEach(function (row) {
      lines.push(cols.map(function (c) { return cell(row[c]); }).join(';'));
    });
    return lines.join('\n');
  };
  /* --------------------- Мини-Markdown (для ответов ИИ) ------------------- */
  util.markdown = function (text) {
    var src = util.esc(text || '').replace(/\r\n/g, '\n');
    var blocks = [];
    /* Код-блоки извлекаем, чтобы не портить их форматирование */
    src = src.replace(/```([\s\S]*?)```/g, function (m, code) {
      blocks.push('<pre><code>' + code.trim() + '</code></pre>');
      return '\u0000BLOCK' + (blocks.length - 1) + '\u0000';
    });

    src = src
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    var lines = src.split('\n'), out = [], listType = null;
    function closeList() {
      if (listType) { out.push('</' + listType + '>'); listType = null; }
    }
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) { closeList(); return; }
      if (/^\u0000BLOCK\d+\u0000$/.test(t)) { closeList(); out.push(t); return; }
      var head = t.match(/^(#{1,4})\s+(.*)$/);
      if (head) {
        closeList();
        var level = Math.min(head[1].length + 1, 5);
        out.push('<h' + level + '>' + head[2] + '</h' + level + '>');
        return;
      }
      if (/^(---+|\*\*\*+)$/.test(t)) { closeList(); out.push('<hr>'); return; }
      if (/^>\s?/.test(t)) { closeList(); out.push('<blockquote>' + t.replace(/^>\s?/, '') + '</blockquote>'); return; }
      var ul = t.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
        out.push('<li>' + ul[1] + '</li>');
        return;
      }
      var ol = t.match(/^\d+[.)]\s+(.*)$/);
      if (ol) {
        if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
        out.push('<li>' + ol[1] + '</li>');
        return;
      }
      closeList();
      out.push('<p>' + t + '</p>');
    });
    closeList();

    var html = out.join('\n');
    html = html.replace(/\u0000BLOCK(\d+)\u0000/g, function (m, i) { return blocks[Number(i)] || ''; });
    return '<div class="md">' + html + '</div>';
  };

  /** Извлечь JSON из ответа модели (модели любят оборачивать в ```json). */
  util.extractJson = function (text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) raw = fence[1].trim();
    var start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    var candidate = raw.slice(start, end + 1);
    try { return JSON.parse(candidate); }
    catch (e) {
      try { return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1')); }
      catch (e2) { return null; }
    }
  };

  /** Нормализация поискового запроса (регистр, ё, лишние пробелы). */
  util.norm = function (text) {
    return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  };
  /** Слова запроса длиной больше одного символа. */
  util.terms = function (text) {
    return util.norm(text).split(/[^a-zа-я0-9.]+/i).filter(function (t) { return t.length > 1; });
  };
})();

