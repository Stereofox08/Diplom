/* ==========================================================================
   ByteStore — Каркас витрины: шапка, подвал, темы, поиск, корзина-drawer,
   модальные окна, уведомления, панель сравнения.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var L = (BS.layout = {});

  /* ------------------------------ Меню витрины ---------------------------- */
  L.NAV = [
    { href: 'index.html', label: 'Главная', icon: 'home' },
    { href: 'catalog.html', label: 'Каталог', icon: 'grid' },
    { href: 'configurator.html', label: 'Конфигуратор', icon: 'sparkles' },
    { href: 'catalog.html?category=prebuilt', label: 'Готовые ПК', icon: 'package' },
    { href: 'favorites.html', label: 'Избранное', icon: 'heart' }
  ];

  L.currentPage = function () {
    return window.location.pathname.split('/').pop() || 'index.html';
  };
  L.isActive = function (href) {
    var current = new URL(window.location.href);
    var target = new URL(href, current.href);
    if (target.pathname !== current.pathname) return false;
    var isPrebuiltLink = target.searchParams.get('category') === 'prebuilt';
    var isPrebuiltPage = current.searchParams.get('category') === 'prebuilt';
    if (target.pathname.endsWith('/catalog.html') || target.pathname === 'catalog.html') {
      return isPrebuiltLink ? isPrebuiltPage : !isPrebuiltPage;
    }
    for (var pair of target.searchParams.entries()) {
      if (current.searchParams.get(pair[0]) !== pair[1]) return false;
    }
    return true;
  };

  /* --------------------------------- Тема --------------------------------- */
  L.theme = function () {
    return U.storage.get('theme', document.documentElement.getAttribute('data-theme') || 'dark');
  };
  L.setTheme = function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    U.storage.set('theme', theme);
    U.$$('[data-theme-icon]').forEach(function (node) {
      node.innerHTML = BS.icon(theme === 'dark' ? 'sun' : 'moon', { size: 20 });
    });
  };
  L.toggleTheme = function () { L.setTheme(L.theme() === 'dark' ? 'light' : 'dark'); };

  /* ------------------------------- Разметка ------------------------------- */
  L.topbarHtml = function () {
    return '' +
      '<div class="topbar"><div class="container topbar__in">' +
      '<ul class="topbar__list">' +
      '<li>' + BS.icon('phone', { size: 14 }) + '<a href="tel:77273553108">' + U.APP.phone + '</a></li>' +
      '<li>' + BS.icon('clock', { size: 14 }) + '<span>' + U.APP.workHours + '</span></li>' +
      '<li>' + BS.icon('truck', { size: 14 }) + '<span>Бесплатная доставка от ' +
      U.money(db.settings().freeDeliveryFrom) + '</span></li>' +
      '</ul>' +
      '<ul class="topbar__list">' +
      '<li>' + BS.icon('award', { size: 14 }) + '<span>Гарантия до 3 лет</span></li>' +
      '<li>' + BS.icon('shield', { size: 14 }) + '<span>Официальный ретейлер</span></li>' +
      '</ul>' +
      '</div></div>';
  };

  L.headerHtml = function () {
    var user = BS.auth.user();
    var cartCount = db.cartCount();
    var favCount = db.favorites().length;
    var nav = L.NAV.map(function (item) {
      return '<a href="' + item.href + '"' + (L.isActive(item.href) ? ' class="is-active"' : '') + '>' +
        item.label + (item.badge ? ' <span class="badge badge--violet">' + item.badge + '</span>' : '') + '</a>';
    }).join('');
    return '' +
      '<header class="header" id="mainHeader"><div class="container header__in">' +
      '<a class="logo" href="index.html" aria-label="ByteStore — на главную">' +
      '<span class="logo__mark">' + BS.icon('cpu', { size: 24 }) + '</span>' +
      '<span class="logo__text"><span class="logo__name">Byte<span>Store</span></span>' +
      '<span class="logo__slogan">' + U.APP.slogan + '</span></span></a>' +
      '<nav class="nav" aria-label="Основная навигация">' + nav + '</nav>' +
      '<div class="header__search">' +
      '<div class="input-icon">' + BS.icon('search', { size: 17 }) +
      '<input type="search" class="input" id="globalSearch" placeholder="Поиск: RTX 4060, Ryzen 7, SSD 1 ТБ…" ' +
      'autocomplete="off" aria-label="Поиск по каталогу"></div>' +
      '<div id="searchSuggest" class="suggest hide"></div>' +
      '</div>' +
      '<div class="header__actions">' +
      '<button class="icon-btn" data-theme-toggle title="Переключить тему" aria-label="Сменить тему">' +
      '<span data-theme-icon>' + BS.icon(L.theme() === 'dark' ? 'sun' : 'moon', { size: 20 }) + '</span></button>' +
      '<a class="icon-btn" href="favorites.html" title="Избранное" aria-label="Избранное">' +
      BS.icon('heart', { size: 20 }) + '<span class="icon-btn__count" data-count="favorites" data-empty="' +
      (favCount ? 0 : 1) + '">' + favCount + '</span></a>' +
      '<button class="icon-btn" data-cart-open title="Корзина" aria-label="Корзина">' +
      BS.icon('cart', { size: 20 }) + '<span class="icon-btn__count" data-count="cart" data-empty="' +
      (cartCount ? 0 : 1) + '">' + cartCount + '</span></button>' +
      (user
        ? '<a class="user-chip" href="account.html"><span class="user-chip__ava">' + BS.auth.initials(user.name) +
          '</span><span class="name">' + U.esc(BS.auth.firstName()) + '</span></a>'
        : '<a class="btn btn--primary btn--sm" href="login.html">' + BS.icon('user', { size: 16 }) + 'Войти</a>') +
      '<button class="icon-btn burger" data-burger aria-label="Меню">' + BS.icon('menu', { size: 22 }) + '</button>' +
      '</div></div></header>';
  };
  L.footerHtml = function () {
    var catLinks = db.categories().slice(0, 7).map(function (c) {
      return '<a href="catalog.html?category=' + c.id + '">' + U.esc(c.name) + '</a>';
    }).join('');
    return '' +
      '<footer class="footer"><div class="container">' +
      '<div class="footer__grid">' +
      '<div class="footer__col">' +
      '<a class="logo" href="index.html"><span class="logo__mark">' + BS.icon('cpu', { size: 24 }) + '</span>' +
      '<span class="logo__text"><span class="logo__name">Byte<span>Store</span></span>' +
      '<span class="logo__slogan">' + U.APP.slogan + '</span></span></a>' +
      '<p class="footer__about">ByteStore — магазин компьютерных комплектующих с ИИ-подбором конфигураций. ' +
      'Более 60 позиций на складе, автоматическая проверка совместимости деталей и сборка под ключ.</p>' +
      '<div class="footer__quick-contact" aria-label="Связаться с ByteStore">' +
      '<a href="tel:77273553108" aria-label="Позвонить в ByteStore" title="Позвонить">' + BS.icon('phone', { size: 18 }) + '</a>' +
      '<a href="mailto:' + U.APP.email + '" aria-label="Написать в ByteStore" title="Написать по e-mail">' +
      BS.icon('mail', { size: 18 }) + '</a>' +
      '</div></div>' +
      '<div class="footer__col"><h5>Каталог</h5><div class="footer__links">' + catLinks + '</div></div>' +
      '<div class="footer__col"><h5>Покупателям</h5><div class="footer__links">' +
      '<a href="configurator.html">Конфигуратор сборки</a>' +
      '<a href="cart.html">Корзина и оформление</a>' +
      '<a href="account.html">Личный кабинет</a>' +
      '<a href="favorites.html">Избранное</a>' +
      '<a href="#" data-help="delivery">Доставка и оплата</a>' +
      '<a href="#" data-help="warranty">Гарантия и возврат</a>' +
      '</div></div>' +
      '<div class="footer__col"><h5>Контакты</h5><div class="footer__links">' +
      '<a href="tel:77273553108">' + U.APP.phone + '</a>' +
      '<a href="mailto:' + U.APP.email + '">' + U.APP.email + '</a>' +
      '<span class="muted">' + U.APP.address + '</span>' +
      '<span class="muted">' + U.APP.workHours + '</span>' +
      '</div>' +
      '<form class="newsletter" data-newsletter>' +
      '<input type="email" class="input input--sm" placeholder="E-mail для акций" required aria-label="E-mail для акций">' +
      '<button class="btn btn--primary btn--sm" type="submit" aria-label="Подписаться на новости">' +
      BS.icon('send', { size: 15 }) + '</button>' +
      '</form></div>' +
      '</div>' +
      '<div class="footer__bottom">' +
      '<span>© ' + new Date().getFullYear() + ' ByteStore — выпускная квалификационная работа: ' +
      'информационная система интернет-магазина комплектующих с ИИ-подбором. Версия ' + U.APP.version + '</span>' +
      '<div class="footer__pay"><span>Visa</span><span>Mastercard</span><span>МИР</span><span>Единый QR</span>' +
      '<span>Рассрочка 0-0-6</span></div>' +
      '</div></div></footer>';
  };

  /* --------------------------- Уведомления и модалки ---------------------- */
  L.toast = function (message, type, title) {
    var stack = U.$('#toastStack');
    if (!stack) {
      stack = U.el('<div class="toast-stack" id="toastStack"></div>');
      document.body.appendChild(stack);
    }
    var icons = { ok: 'check-circle', danger: 'x-circle', warn: 'alert', info: 'info' };
    var kind = icons[type] ? type : 'info';
    var toast = U.el('<div class="toast toast--' + kind + '">' +
      '<span class="toast__icon">' + BS.icon(icons[kind], { size: 19 }) + '</span>' +
      '<div class="toast__body">' +
      (title ? '<div class="toast__title">' + U.esc(title) + '</div>' : '') +
      '<div class="toast__text">' + U.esc(message) + '</div></div></div>');
    stack.appendChild(toast);
    setTimeout(function () {
      toast.classList.add('is-out');
      setTimeout(function () { toast.remove(); }, 320);
    }, type === 'danger' ? 6000 : 3800);
    return toast;
  };
  L.toastOk = function (message, title) { return L.toast(message, 'ok', title); };
  L.toastError = function (message, title) { return L.toast(message, 'danger', title || 'Ошибка'); };
  L.toastInfo = function (message, title) { return L.toast(message, 'info', title); };
  /* --------------------------- Модальные окна ----------------------------- */
  /** Открывает модальное окно. Возвращает {el, close}. */
  L.modal = function (options) {
    options = options || {};
    var returnFocus = document.activeElement;
    var titleId = 'modal-title-' + (++L._modalId || (L._modalId = 1));
    var backdrop = U.el('<div class="modal-backdrop"></div>');
    var modal = U.el('<div class="modal' + (options.size ? ' modal--' + options.size : '') + '"></div>');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', titleId);
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = '' +
      '<div class="modal-head"><h3 id="' + titleId + '">' + U.esc(options.title || '') + '</h3>' +
      '<button class="modal-close" data-close aria-label="Закрыть">×</button></div>' +
      '<div class="modal-body">' + (options.html || '') + '</div>' +
      (options.footer ? '<div class="modal-foot">' + options.footer + '</div>' : '');
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');
    function close() {
      backdrop.remove();
      if (!U.$('.modal-backdrop') && !U.$('.drawer-backdrop')) document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape' && options.closable !== false) { close(); return; }
      if (e.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(modal.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(function (node) { return !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true'; });
      if (!focusable.length) { e.preventDefault(); modal.focus(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    }
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop && options.closable !== false) close();
    });
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    var firstField = modal.querySelector('input, select, textarea, button:not([data-close])');
    setTimeout(function () { (firstField || modal).focus(); }, 0);
    return { el: modal, close: close };
  };

  /** Диалог подтверждения → Promise<boolean>. */
  L.confirm = function (text, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var instance = L.modal({
        title: options.title || 'Подтвердите действие',
        size: 'narrow',
        html: '<p>' + U.esc(text) + '</p>',
        footer: '<button class="btn" data-close>Отмена</button>' +
          '<button class="btn ' + (options.danger ? 'btn--danger' : 'btn--primary') + '" data-yes>' +
          U.esc(options.confirmText || 'Подтвердить') + '</button>'
      });
      instance.el.addEventListener('click', function (e) {
        if (e.target.closest('[data-yes]')) { resolve(true); instance.close(); }
        else if (e.target.closest('[data-close]')) resolve(false);
      });
    });
  };

  /** Диалог ввода → Promise<string|null>. */
  L.prompt = function (options) {
    options = options || {};
    return new Promise(function (resolve) {
      var instance = L.modal({
        title: options.title || 'Введите значение',
        size: 'narrow',
        html: (options.text ? '<p>' + U.esc(options.text) + '</p>' : '') +
          '<textarea class="textarea" data-prompt-input rows="4" placeholder="' +
          U.attr(options.placeholder || '') + '">' + U.esc(options.value || '') + '</textarea>',
        footer: '<button class="btn" data-close>Отмена</button>' +
          '<button class="btn btn--primary" data-ok>Сохранить</button>'
      });
      function submit() {
        var value = instance.el.querySelector('[data-prompt-input]').value;
        resolve(value);
        instance.close();
      }
      instance.el.addEventListener('click', function (e) {
        if (e.target.closest('[data-ok]')) submit();
        else if (e.target.closest('[data-close]')) resolve(null);
      });
      instance.el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
      });
    });
  };

  /** Боковая панель. Возвращает {el, body, close}. */
  L.drawer = function (options) {
    options = options || {};
    var returnFocus = document.activeElement;
    var titleId = 'drawer-title-' + (++L._drawerId || (L._drawerId = 1));
    var backdrop = U.el('<div class="drawer-backdrop"></div>');
    var drawer = U.el('<aside class="drawer' + (options.side === 'left' ? ' drawer--left' : '') + '"></aside>');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', titleId);
    drawer.setAttribute('tabindex', '-1');
    drawer.innerHTML = '' +
      '<div class="drawer-head"><h3 id="' + titleId + '">' + U.esc(options.title || '') + '</h3>' +
      '<button class="modal-close" data-close aria-label="Закрыть">×</button></div>' +
      '<div class="drawer-body">' + (options.html || '') + '</div>' +
      (options.footer ? '<div class="drawer-foot">' + options.footer + '</div>' : '');
    backdrop.appendChild(drawer);
    document.body.appendChild(backdrop);
    document.body.classList.add('is-locked');
    function close() {
      backdrop.remove();
      if (!U.$('.modal-backdrop') && !U.$('.drawer-backdrop')) document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(drawer.querySelectorAll(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(function (node) { return !node.hasAttribute('hidden') && node.getAttribute('aria-hidden') !== 'true'; });
      if (!focusable.length) { e.preventDefault(); drawer.focus(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]') || e.target === backdrop) close();
    });
    var firstField = drawer.querySelector('input, select, textarea, button:not([data-close]), a[href]');
    setTimeout(function () { (firstField || drawer).focus(); }, 0);
    return { el: drawer, body: drawer.querySelector('.drawer-body'), close: close };
  };
  /* ------------------------- Общие фрагменты UI --------------------------- */
  L.sectionHead = function (kicker, title, subtitle, actionHtml) {
    return '<div class="section-head"><div>' +
      (kicker ? '<div class="kicker">' + BS.icon('sparkles', { size: 14 }) + U.esc(kicker) + '</div>' : '') +
      '<h2>' + title + '</h2>' + (subtitle ? '<p>' + subtitle + '</p>' : '') +
      '</div>' + (actionHtml ? '<div class="btn-group">' + actionHtml + '</div>' : '') + '</div>';
  };
  L.emptyState = function (options) {
    options = options || {};
    return '<div class="empty"><div class="empty__icon">' + (options.emoji || '🔍') + '</div>' +
      '<h3>' + U.esc(options.title || 'Ничего не найдено') + '</h3>' +
      '<p>' + U.esc(options.text || '') + '</p>' +
      (options.action || '') + '</div>';
  };
  L.loading = function (text) {
    return '<div class="loading-block"><span class="spinner spinner--lg"></span>' +
      '<span>' + U.esc(text || 'Загрузка данных…') + '</span></div>';
  };
  L.badge = function (text, type) {
    return '<span class="badge' + (type ? ' badge--' + type : '') + '">' + U.esc(text) + '</span>';
  };
  L.statusBadge = function (status) {
    var meta = db.ORDER_STATUS[status] || { label: status, cls: 'info' };
    return '<span class="badge badge--' + meta.cls + '">' + U.esc(meta.label) + '</span>';
  };

  /* ---------------------------- Счётчики в шапке -------------------------- */
  L.refreshCounters = function () {
    var cartNode = U.$('[data-count="cart"]');
    var favNode = U.$('[data-count="favorites"]');
    var cartCount = db.cartCount();
    var favCount = db.favorites().length;
    if (cartNode) {
      cartNode.textContent = cartCount;
      cartNode.setAttribute('data-empty', cartCount ? '0' : '1');
    }
    if (favNode) {
      favNode.textContent = favCount;
      favNode.setAttribute('data-empty', favCount ? '0' : '1');
    }
  };

  /* ------------------------------ Корзина-drawer -------------------------- */
  L.cartDrawerHtml = function () {
    var totals = db.cartTotals();
    if (!totals.lines.length) {
      return L.emptyState({
        emoji: '🛒', title: 'Корзина пуста',
        text: 'Добавьте комплектующие из каталога или соберите ПК в ИИ-конфигураторе.',
        action: '<a class="btn btn--primary" href="catalog.html">Перейти в каталог</a>'
      });
    }
    var rows = totals.lines.map(function (line) {
      var p = line.product;
      return '<div class="cart-item" data-line="' + U.attr(p.id) + '">' +
        '<div class="cart-item__img">' + BS.art(p) + '</div>' +
        '<div><div class="cart-item__name"><a href="product.html?id=' + U.attr(p.id) + '">' + U.esc(p.name) + '</a></div>' +
        '<div class="muted">' + U.esc((p.key || []).join(' · ')) + '</div></div>' +
        '<div class="col gap-2" style="align-items:flex-end">' +
        '<span class="strong">' + U.money(line.sum) + '</span>' +
        '<div class="cart-item__ctrl">' +
        '<div class="qty"><button data-qty="-1" aria-label="Меньше">−</button>' +
        '<input type="text" value="' + line.qty + '" data-qty-input aria-label="Количество">' +
        '<button data-qty="1" aria-label="Больше">+</button></div>' +
        '<button class="btn btn--ghost btn--icon btn--sm tip" data-remove title="Удалить">' +
        BS.icon('trash', { size: 16 }) + '</button>' +
        '</div></div></div>';
    }).join('');
    return rows +
      '<div class="summary-row mt-4"><span>Товаров</span><b>' + totals.count + '</b></div>' +
      '<div class="summary-row"><span>Сумма</span><b>' + U.money(totals.subtotal) + '</b></div>' +
      (totals.discount ? '<div class="summary-row text-ok"><span>Скидка</span><b>−' + U.money(totals.discount) + '</b></div>' : '') +
      '<div class="summary-row"><span>Доставка</span><b>' + (totals.delivery ? U.money(totals.delivery) : 'бесплатно') + '</b></div>' +
      '<div class="summary-row summary-row--total"><span>Итого</span><span>' + U.money(totals.total) + '</span></div>';
  };

  L.openCartDrawer = function () {
    var instance = L.drawer({
      title: 'Корзина',
      html: L.cartDrawerHtml(),
      footer: db.cartCount()
        ? '<a class="btn btn--primary btn--block" href="cart.html">' + BS.icon('credit-card', { size: 17 }) +
          'Оформить заказ</a>'
        : ''
    });
    instance.el.addEventListener('click', function (e) {
      var row = e.target.closest('[data-line]');
      if (!row) return;
      var id = row.getAttribute('data-line');
      if (e.target.closest('[data-qty]')) {
        var delta = Number(e.target.closest('[data-qty]').getAttribute('data-qty'));
        var input = row.querySelector('[data-qty-input]');
        db.setCartQty(id, Number(input.value) + delta);
      } else if (e.target.closest('[data-remove]')) {
        db.removeFromCart(id);
        L.toast('Товар удалён из корзины', 'info');
      } else {
        return;
      }
      instance.body.innerHTML = L.cartDrawerHtml();
      L.refreshCounters();
      if (L.onCartChange) L.onCartChange();
    });
  };

  /** Универсальное добавление товара в корзину с обновлением интерфейса. */
  L.addToCart = function (productId, qty) {
    var result = db.addToCart(productId, qty);
    if (result.ok) {
      L.toastOk(result.message, 'Добавлено в корзину');
      L.refreshCounters();
      if (L.onCartChange) L.onCartChange();
    } else {
      L.toastError(result.message);
    }
    return result;
  };
  /* --------------------------- Поиск с подсказками ------------------------ */
  L.renderSuggest = function (query) {
    var box = U.$('#searchSuggest');
    if (!box) return;
    var q = String(query || '').trim();
    if (q.length < 2) { box.classList.add('hide'); box.innerHTML = ''; return; }
    var found = db.searchProducts(q, 6);
    var categories = db.categories().filter(function (c) {
      return U.norm(c.name).indexOf(U.norm(q)) !== -1;
    }).slice(0, 3);
    if (!found.length && !categories.length) {
      box.innerHTML = '<div class="suggest__head">Ничего не найдено</div>' +
        '<div class="suggest__row" data-suggest-search="' + U.attr(q) + '">' +
        '<div class="suggest__thumb">🔍</div><div class="suggest__body">' +
        '<div class="suggest__name">Искать «' + U.esc(q) + '» во всём каталоге</div>' +
        '<div class="suggest__meta">Также можно собрать ПК в ИИ-конфигураторе</div></div></div>';
      box.classList.remove('hide');
      return;
    }
    var html = '';
    if (categories.length) {
      html += '<div class="suggest__head">Категории</div>' + categories.map(function (c) {
        return '<div class="suggest__row" data-suggest-category="' + U.attr(c.id) + '">' +
          '<div class="suggest__thumb">' + c.emoji + '</div><div class="suggest__body">' +
          '<div class="suggest__name">' + U.esc(c.name) + '</div>' +
          '<div class="suggest__meta">' + db.byCategory(c.id).length + ' товаров</div></div></div>';
      }).join('');
    }
    if (found.length) {
      html += '<div class="suggest__head">Товары</div>' + found.map(function (p) {
        return '<div class="suggest__row" data-suggest-product="' + U.attr(p.id) + '">' +
          '<div class="suggest__thumb">' + ((db.category(p.categoryId) || {}).emoji || '📦') + '</div>' +
          '<div class="suggest__body"><div class="suggest__name">' + U.esc(p.name) + '</div>' +
          '<div class="suggest__meta">' + U.esc(p.brand) + ' · ' + U.esc((p.key || []).join(', ')) + '</div></div>' +
          '<div class="suggest__price">' + U.money(p.price) + '</div></div>';
      }).join('');
    }
    html += '<div class="suggest__head">Действия</div>' +
      '<div class="suggest__row" data-suggest-search="' + U.attr(q) + '"><div class="suggest__thumb">🔎</div>' +
      '<div class="suggest__body"><div class="suggest__name">Показать все результаты по «' + U.esc(q) + '»</div>' +
      '<div class="suggest__meta">Откроется каталог с фильтрами</div></div></div>' +
      '<div class="suggest__row" data-suggest-build="1"><div class="suggest__thumb">' +
      BS.icon('sparkles', { size: 20 }) + '</div>' +
      '<div class="suggest__body"><div class="suggest__name">Открыть конфигуратор</div>' +
      '<div class="suggest__meta">Учитывает совместимость и бюджет</div></div></div>';
    box.innerHTML = html;
    box.classList.remove('hide');
  };

  /* ----------------------------- Панель сравнения ------------------------- */
  L.renderCompare = function () {
    var existing = U.$('#compareBar');
    if (existing) existing.remove();
    var products = db.compare.products();
    if (!products.length) return;
    var bar = U.el('<div class="compare-bar" id="compareBar"></div>');
    bar.innerHTML = '<span class="strong nowrap">' + BS.icon('sliders', { size: 16 }) +
      ' Сравнение ' + products.length + '/4</span>' +
      '<div class="compare-bar__list">' + products.map(function (p) {
        var short = p.name.replace(/^(Процессор|Видеокарта|Материнская плата|Оперативная память)\s+/i, '');
        return '<span class="compare-bar__item">' + U.esc(short.slice(0, 30)) +
          ' <button data-cmp-remove="' + U.attr(p.id) + '" aria-label="Убрать">×</button></span>';
      }).join('') + '</div>' +
      '<button class="btn btn--primary btn--sm" data-cmp-show>Сравнить</button>' +
      '<button class="btn btn--ghost btn--sm" data-cmp-clear>Очистить</button>';
    document.body.appendChild(bar);
  };
  /** Таблица сравнения товаров в модальном окне. */
  L.showCompare = function () {
    var products = db.compare.products();
    if (products.length < 2) {
      L.toast('Добавьте минимум два товара к сравнению', 'warn');
      return;
    }
    var rows = [
      ['Цена', function (p) { return U.money(p.price); }, function (p) { return -p.price; }],
      ['Бренд', function (p) { return p.brand; }],
      ['Рейтинг', function (p) { return p.rating + ' / 5 (' + p.reviews + ' отзывов)'; }, function (p) { return p.rating; }],
      ['Наличие', function (p) { return p.stock > 0 ? p.stock + ' шт.' : 'нет в наличии'; }, function (p) { return p.stock; }]
    ];
    var specKeys = {};
    products.forEach(function (p) {
      Object.keys(p.specs || {}).forEach(function (k) { if (k !== 'score') specKeys[k] = true; });
    });
    Object.keys(specKeys).forEach(function (key) {
      rows.push([key, function (p) {
        var value = p.specs[key];
        return value === undefined || value === '' ? '—' : String(value);
      }]);
    });
    rows.push(['Индекс производительности', function (p) { return String(p.specs.score || '—'); },
      function (p) { return p.specs.score || 0; }]);

    var head = '<tr><th>Характеристика</th>' + products.map(function (p) {
      return '<th><div class="cmp-head"><div class="pc__media">' + BS.art(p) + '</div>' +
        '<a href="product.html?id=' + U.attr(p.id) + '">' + U.esc(p.name) + '</a>' +
        '<button class="btn btn--soft btn--xs" data-add-cart="' + U.attr(p.id) + '">В корзину</button></div></th>';
    }).join('') + '</tr>';

    var body = rows.map(function (row) {
      var values = products.map(function (p) { return row[1](p); });
      var scored = row[2] ? products.map(function (p) { return row[2](p); }) : null;
      var best = scored ? Math.max.apply(null, scored) : null;
      return '<tr><td class="strong">' + U.esc(row[0]) + '</td>' + values.map(function (value, index) {
        var isBest = scored && values.length > 1 && scored[index] === best;
        return '<td' + (isBest ? ' class="better"' : '') + '>' + U.esc(value) + '</td>';
      }).join('') + '</tr>';
    }).join('');

    L.modal({
      title: 'Сравнение товаров',
      size: 'wide',
      html: '<div class="table-wrap"><table class="table compare-table"><thead>' + head +
        '</thead><tbody>' + body + '</tbody></table></div>',
      footer: '<button class="btn btn--ghost" data-cmp-clear>Очистить сравнение</button>' +
        '<button class="btn" data-close>Закрыть</button>'
    });
  };
  /* --------------------------- Глобальные обработчики --------------------- */
  function wireDelegation() {
    document.addEventListener('click', function (e) {
      var themeBtn = e.target.closest('[data-theme-toggle]');
      if (themeBtn) { L.toggleTheme(); return; }

      var cartBtn = e.target.closest('[data-cart-open]');
      if (cartBtn) { L.openCartDrawer(); return; }

      var addBtn = e.target.closest('[data-add-cart]');
      if (addBtn) {
        e.preventDefault();
        var block = addBtn.closest('[data-product-block]');
        var qtyInput = block ? block.querySelector('[data-qty-input]') : null;
        L.addToCart(addBtn.getAttribute('data-add-cart'), qtyInput ? Number(qtyInput.value) || 1 : 1);
        return;
      }

      var favBtn = e.target.closest('[data-fav-toggle]');
      if (favBtn) {
        e.preventDefault();
        var favId = favBtn.getAttribute('data-fav-toggle');
        var isFav = db.toggleFavorite(favId);
        favBtn.classList.toggle('is-on', isFav);
        L.refreshCounters();
        L.toast(isFav ? 'Товар добавлен в избранное' : 'Товар удалён из избранного', 'ok');
        if (L.onFavoritesChange) L.onFavoritesChange();
        return;
      }

      var cmpBtn = e.target.closest('[data-cmp-toggle]');
      if (cmpBtn) {
        e.preventDefault();
        var cmpId = cmpBtn.getAttribute('data-cmp-toggle');
        var result = db.compare.toggle(cmpId);
        if (!result.ok) { L.toast(result.message, 'warn'); return; }
        cmpBtn.classList.toggle('is-on', db.compare.has(cmpId));
        L.renderCompare();
        L.toast(result.message, 'ok');
        return;
      }

      var removeSlot = e.target.closest('[data-cmp-remove]');
      if (removeSlot) { db.compare.remove(removeSlot.getAttribute('data-cmp-remove')); L.renderCompare(); return; }

      if (e.target.closest('[data-cmp-clear]')) {
        db.compare.clear();
        L.renderCompare();
        L.toast('Сравнение очищено', 'info');
        return;
      }
      if (e.target.closest('[data-cmp-show]')) { L.showCompare(); return; }

      var shareBtn = e.target.closest('[data-share]');
      if (shareBtn) {
        U.copyText(shareBtn.getAttribute('data-share') || window.location.href).then(function (ok) {
          L.toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку', ok ? 'ok' : 'danger');
        });
        return;
      }

      var help = e.target.closest('[data-help]');
      if (help) {
        e.preventDefault();
        var topic = help.getAttribute('data-help');
        L.modal({
          title: topic === 'delivery' ? 'Доставка и оплата' : 'Гарантия и возврат',
          html: topic === 'delivery'
            ? '<ul class="col gap-2"><li>Курьер до двери — 1 день по Алматы и Астане, 2–4 дня по Казахстану.</li>' +
              '<li>Самовывоз — более 90 пунктов выдачи в 20 городах, 2–4 дня.</li>' +
              '<li>Стоимость доставки — ' + U.money(db.settings().deliveryCost) + ', бесплатно от ' +
              U.money(db.settings().freeDeliveryFrom) + '.</li>' +
              '<li>Оплата: картой онлайн, Единый QR, рассрочка 0-0-6 / 0-0-12 / 0-0-24, наличными при получении, счёт для юрлиц.</li></ul>'
            : '<ul class="col gap-2"><li>Гарантия производителя от 1 года, на сборки ByteStore — 3 года.</li>' +
              '<li>Возврат товара в течение 14 дней при сохранении упаковки.</li>' +
              '<li>Бесплатная диагностика при обращении по гарантии.</li>' +
              '<li>Сервисный центр: ' + U.APP.address + ', ' + U.APP.workHours + '.</li></ul>',
          footer: '<button class="btn btn--primary" data-close>Понятно</button>'
        });
        return;
      }
    });
  }
  /* ------------------------- Поиск и мобильное меню ----------------------- */
  function wireSearch() {
    var input = U.$('#globalSearch');
    if (!input) return;
    var run = U.debounce(function () { L.renderSuggest(input.value); }, 180);
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (input.value.length > 1) L.renderSuggest(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var value = input.value.trim();
        if (value) window.location.href = 'catalog.html?q=' + encodeURIComponent(value);
      } else if (e.key === 'Escape') {
        var box = U.$('#searchSuggest');
        if (box) box.classList.add('hide');
      }
    });
    document.addEventListener('click', function (e) {
      var box = U.$('#searchSuggest');
      if (!box) return;
      var row = e.target.closest('[data-suggest-product]');
      if (row) { window.location.href = 'product.html?id=' + encodeURIComponent(row.getAttribute('data-suggest-product')); return; }
      var cat = e.target.closest('[data-suggest-category]');
      if (cat) { window.location.href = 'catalog.html?category=' + encodeURIComponent(cat.getAttribute('data-suggest-category')); return; }
      var search = e.target.closest('[data-suggest-search]');
      if (search) { window.location.href = 'catalog.html?q=' + encodeURIComponent(search.getAttribute('data-suggest-search')); return; }
      if (e.target.closest('[data-suggest-build]')) { window.location.href = 'configurator.html'; return; }
      if (!e.target.closest('.header__search')) box.classList.add('hide');
    });
  }

  function wireScrollAndMenu() {
    var toTop = U.el('<button class="to-top" aria-label="Наверх">' + BS.icon('arrow-up', { size: 20 }) + '</button>');
    document.body.appendChild(toTop);
    toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var onScroll = U.throttle(function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      toTop.classList.toggle('is-on', y > 600);
      var header = U.$('.header');
      if (header) header.classList.toggle('is-stuck', y > 10);
    }, 140);
    window.addEventListener('scroll', onScroll);
    onScroll();

    var burger = U.$('[data-burger]');
    if (burger) {
      burger.addEventListener('click', function () {
        var user = BS.auth.user();
        var nav = L.NAV.map(function (item) {
          return '<a href="' + item.href + '"' + (L.isActive(item.href) ? ' class="is-active"' : '') + '>' +
            BS.icon(item.icon, { size: 19 }) + item.label + '</a>';
        }).join('');
        var actions = user
          ? '<a href="account.html">' + BS.icon('user', { size: 19 }) + 'Личный кабинет</a>' +
            '<button data-logout>' + BS.icon('logout', { size: 19 }) + 'Выйти с аккаунта</button>'
          : '<a href="login.html">' + BS.icon('user', { size: 19 }) + 'Войти</a>' +
            '<a href="register.html">' + BS.icon('sparkles', { size: 19 }) + 'Регистрация</a>';
        var drawer = L.drawer({
          side: 'left',
          title: 'Меню ByteStore',
          html: '<nav class="mobile-nav">' + nav +
            '<a href="cart.html">' + BS.icon('cart', { size: 19 }) + 'Корзина (' + db.cartCount() + ')</a>' +
            actions + '</nav>'
        });
        drawer.el.addEventListener('click', function (e) {
          if (e.target.closest('[data-logout]')) {
            BS.auth.logout();
            window.location.href = 'index.html';
            return;
          }
          if (e.target.closest('a')) drawer.close();
        });
      });
    }

  }

  /* ------------------------------- Запуск --------------------------------- */
  L.init = function () {
    var topbar = U.$('#bs-topbar');
    var header = U.$('#bs-header');
    var footer = U.$('#bs-footer');
    if (topbar) topbar.innerHTML = L.topbarHtml();
    if (header) header.innerHTML = L.headerHtml();
    if (footer) footer.innerHTML = L.footerHtml();
    var chatRoot = U.$('#bs-chat');
    if (chatRoot && BS.chat && BS.chat.mount) BS.chat.mount(chatRoot);
    wireDelegation();
    wireSearch();
    wireScrollAndMenu();
    L.renderCompare();
    L.refreshCounters();
    document.documentElement.setAttribute('data-theme', L.theme());
    var newsletter = U.$('[data-newsletter]');
    if (newsletter) {
      newsletter.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = newsletter.querySelector('input').value;
        var error = BS.auth.validateEmail(email);
        if (error) { L.toast(error, 'warn'); return; }
        db.track('newsletter', { label: email });
        newsletter.reset();
        L.toastOk('Подписка оформлена: скидки и новинки ByteStore будут приходить на ' + email, 'Спасибо!');
      });
    }
  };
})();
