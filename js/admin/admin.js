/* ==========================================================================
   ByteStore — Административная панель: вход, дашборд, CRUD, модерация
   Доступ только по логину и паролю администратора (по умолчанию Admin / 1234).
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout, charts = BS.charts;
  var admin = (BS.admin = {});

  var ui = {
    panel: 'dashboard', days: 30, productQuery: '', productCategory: '',
    orderQuery: '', reviewStatus: 'all', photoQuery: '', photoFilter: 'missing'
  };

  var PANELS = [
    { id: 'dashboard', label: 'Дашборд', icon: 'chart' },
    { id: 'products', label: 'Товары', icon: 'package' },
    { id: 'images', label: 'Фото товаров', icon: 'image' },
    { id: 'categories', label: 'Категории', icon: 'grid' },
    { id: 'orders', label: 'Заказы', icon: 'truck' },
    { id: 'reviews', label: 'Отзывы', icon: 'thumbs-up' },
    { id: 'users', label: 'Пользователи', icon: 'users' },
    { id: 'promos', label: 'Промокоды', icon: 'tag' },
    { id: 'ai', label: 'ИИ и настройки', icon: 'robot' },
    { id: 'log', label: 'Журнал действий', icon: 'list' }
  ];

  admin.init = function () {
    var root = U.$('#adminRoot');
    if (!root) return;
    admin.root = root;
    L.setTheme(L.theme());
    if (!root._adminThemeWired) {
      root._adminThemeWired = true;
      root.addEventListener('click', function (event) {
        if (event.target.closest('[data-admin-theme]')) { event.preventDefault(); L.toggleTheme(); }
      });
    }
    if (!db.isAdmin()) {
      renderLogin();
      return;
    }
    renderShell();
  };

  /* ------------------------------- Вход ----------------------------------- */
  function themeButton() {
    return '<button type="button" class="btn btn--ghost btn--sm" data-theme-toggle data-admin-theme aria-label="Сменить тему" aria-pressed="' + (L.theme() === 'dark') + '">' +
      '<span data-theme-icon>' + BS.icon(L.theme() === 'dark' ? 'sun' : 'moon', { size: 18 }) + '</span> Тема</button>';
  }
  function renderLogin() {
    admin.root.innerHTML = '<div class="admin-login"><div class="glass admin-login__card">' +
      '<div class="center col gap-3" style="text-align:center">' +
      '<span class="logo__mark" style="margin:0 auto">' + BS.icon('cpu', { size: 26 }) + '</span>' +
      '<div class="logo__name" style="font-size:24px">Byte<span>Store</span> · Admin</div>' +
      '<p class="muted small">Панель администратора интернет-магазина компьютерных комплектующих. ' +
      'Доступ только для сотрудников: вход по логину и паролю.</p></div>' +
      '<div class="row center mt-4">' + themeButton() + '</div>' +
      '<form class="mt-5" data-admin-login>' +
      '<div class="field"><label for="adLogin">Логин</label>' +
      '<div class="input-icon">' + BS.icon('user', { size: 17 }) +
      '<input class="input" id="adLogin" name="login" required autocomplete="username" ' +
      'value="' + (BS.cloud ? '' : 'Admin') + '" placeholder="' + (BS.cloud ? 'E-mail администратора' : 'Администратор') + '"></div></div>' +
      '<div class="field"><label for="adPass">Пароль</label>' +
      '<div class="input-icon">' + BS.icon('lock', { size: 17 }) +
      '<input class="input" id="adPass" name="password" type="password" required ' +
      'autocomplete="current-password" placeholder="••••"></div></div>' +
      '<div data-login-error></div>' +
      '<button class="btn btn--primary btn--lg btn--block" type="submit">' + BS.icon('lock', { size: 18 }) +
      'Войти в панель</button></form>' +
      '<div class="alert alert--info mt-4"' + (BS.cloud ? ' style="display:none!important"' : '') + '><span class="alert__icon">ℹ️</span><div class="alert__body">' +
      '<strong>Данные для проверки проекта</strong><p>Логин <b class="mono">Admin</b>, пароль ' +
      '<b class="mono">1234</b>. После 5 неудачных попыток вход блокируется на 5 минут.</p></div></div>' +
      '<p class="muted small center mt-4"><a href="index.html">← Вернуться в магазин</a></p>' +
      '</div></div>';

    var form = admin.root.querySelector('[data-admin-login]');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      var errorBox = admin.root.querySelector('[data-login-error]');
      var data = new FormData(form);
      button.classList.add('is-loading');
      db.adminLogin(data.get('login'), data.get('password')).then(async function (result) {
        button.classList.remove('is-loading');
        if (!result.ok) {
          errorBox.innerHTML = '<div class="alert alert--danger"><span class="alert__icon">⚠️</span>' +
            '<div class="alert__body"><strong>Доступ запрещён</strong><p>' + U.esc(result.message) +
            '</p></div></div>';
          return;
        }
        L.toastOk(result.message, 'Вход выполнен');
        renderShell();
      });
    });
  }
  /* ------------------------------- Каркас --------------------------------- */
  function renderShell() {
    var pendingReviews = db.pendingReviewsCount();
    var pendingOrders = db.analytics(30).pendingOrders;
    admin.root.innerHTML = '<div class="admin" id="adminLayout">' +
      '<aside class="admin-side">' +
      '<div class="admin-side__brand"><span class="logo__mark">' + BS.icon('cpu', { size: 22 }) + '</span>' +
      '<div class="logo__text"><span class="logo__name" style="font-size:17px">Byte<span>Store</span></span>' +
      '<span class="logo__slogan">админ-панель</span></div></div>' +
      '<nav class="admin-side__nav">' +
      '<div class="admin-side__group">Управление</div>' +
      navItem(PANELS[0]) +
      '<div class="admin-side__group">Каталог</div>' +
      navItem(PANELS[1]) + navItem(PANELS[2]) + navItem(PANELS[3]) +
      '<div class="admin-side__group">Продажи</div>' +
      navItem(PANELS[4], pendingOrders) + navItem(PANELS[5], pendingReviews) + navItem(PANELS[6]) +
      '<div class="admin-side__group">Лояльность и ИИ</div>' +
      navItem(PANELS[7]) + navItem(PANELS[8]) +
      '<div class="admin-side__group">Система</div>' +
      navItem(PANELS[9]) +
      '</nav>' +
      '<div class="admin-side__foot">' +
      '<div class="between mb-3"><span>Администратор</span><b>' + U.esc(db.state.admin.login) + '</b></div>' +
      '<div class="muted small mb-3">Последний вход: ' +
      (db.state.admin.lastLogin ? U.date(db.state.admin.lastLogin, true) : '—') + '</div>' +
      '<div class="col gap-2">' +
      '<a class="btn btn--outline btn--sm btn--block" href="index.html" target="_blank">' +
      BS.icon('link', { size: 15 }) + 'Открыть магазин</a>' +
      '<button class="btn btn--ghost btn--sm btn--block" data-admin-logout>' + BS.icon('logout', { size: 15 }) +
      'Выйти из панели</button></div></div>' +
      '</aside>' +
      '<div class="admin-main">' +
      '<header class="admin-top">' +
      '<button class="icon-btn admin-burger" data-admin-burger aria-label="Меню">' +
      BS.icon('menu', { size: 22 }) + '</button>' +
      '<div class="admin-top__title"><h2 id="adminTitle">Дашборд</h2>' +
      '<span id="adminSubtitle">Сводка продаж и ключевые показатели магазина</span></div>' +
      '<div class="admin-top__actions">' + themeButton() +
      '<select class="select input--sm" data-admin-days>' +
      [7, 30, 90].map(function (days) {
        return '<option value="' + days + '"' + (ui.days === days ? ' selected' : '') +
          '>Период: ' + days + ' дней</option>';
      }).join('') + '</select>' +
      '<button class="icon-btn" data-admin-refresh title="Обновить данные">' +
      BS.icon('refresh', { size: 20 }) + '</button>' +
      '</div></header>' +
      '<div class="admin-content"><div id="adminPanel"></div></div>' +
      '</div></div>';
    admin.layout = U.$('#adminLayout');
    admin.panelHost = U.$('#adminPanel');
    wireShell();
    admin.show(ui.panel);
  }

  function navItem(panel, badge) {
    return '<button class="admin-nav-item' + (ui.panel === panel.id ? ' is-active' : '') +
      '" data-admin-panel="' + panel.id + '">' + BS.icon(panel.icon, { size: 18 }) + panel.label +
      (badge ? '<span class="pill">' + badge + '</span>' : '') + '</button>';
  }

  /** Переключение панели администратора. */
  admin.show = function (panelId) {
    ui.panel = panelId;
    var meta = PANELS.filter(function (panel) { return panel.id === panelId; })[0] || PANELS[0];
    U.$$('[data-admin-panel]').forEach(function (node) {
      node.classList.toggle('is-active', node.getAttribute('data-admin-panel') === panelId);
    });
    var title = U.$('#adminTitle');
    var subtitle = U.$('#adminSubtitle');
    if (title) title.textContent = meta.label;
    if (subtitle) subtitle.textContent = SUBTITLES[panelId] || '';
    admin.panelHost.innerHTML = '<div class="loading-block"><span class="spinner spinner--lg"></span>' +
      '<span>Загрузка данных…</span></div>';
    setTimeout(function () {
      admin.panelHost.innerHTML = render();
      if (admin.afterRender) admin.afterRender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);
  };

  var SUBTITLES = {
    dashboard: 'Сводка продаж, графики и ключевые показатели магазина',
    products: 'Добавление, редактирование и удаление товаров каталога',
    images: 'Поиск, предпросмотр и пакетное назначение фотографий товарам',
    categories: 'Структура каталога и привязка категорий к конфигуратору',
    orders: 'Обработка заказов и изменение статусов доставки',
    reviews: 'Модерация отзывов: публикация, скрытие и ответы покупателям',
    users: 'Клиентская база, блокировка и статистика покупок',
    promos: 'Промокоды и акции магазина',
    ai: 'Настройки искусственного интеллекта, демо-данные и экспорт',
    log: 'Журнал действий администраторов и системных событий'
  };
  /* --------------------------- Диспетчер панелей -------------------------- */
  function render() {
    switch (ui.panel) {
      case 'products': return renderProducts();
      case 'images': return renderProductImages();
      case 'categories': return renderCategories();
      case 'orders': return renderOrders();
      case 'reviews': return renderReviews();
      case 'users': return renderUsers();
      case 'promos': return renderPromos();
      case 'ai': return renderAiSettings();
      case 'log': return renderLog();
      default: return renderDashboard();
    }
  }

  function kpiCard(options) {
    var delta = options.delta;
    var deltaClass = (delta === null || delta === undefined) ? 'flat' : delta >= 0 ? 'up' : 'down';
    var arrow = deltaClass === 'up' ? 'trending-up' : deltaClass === 'down' ? 'trending-down' : 'minus';
    return '<div class="kpi">' +
      '<div class="kpi__label">' + BS.icon(options.icon, { size: 15 }) + ' ' + U.esc(options.label) + '</div>' +
      '<div class="kpi__value">' + options.value + '</div>' +
      ((delta === null || delta === undefined)
        ? '<div class="kpi__delta kpi__delta--flat">' + U.esc(options.hint || '') + '</div>'
        : '<div class="kpi__delta kpi__delta--' + deltaClass + '">' + BS.icon(arrow, { size: 14 }) +
          (delta > 0 ? '+' : '') + delta + ' % к прошлому периоду</div>') +
      '</div>';
  }

  /** Верхний блок дашборда: восемь KPI-карточек. */
  function dashboardKpis(stats) {
    return '<div class="kpi-grid">' +
      kpiCard({ label: 'Выручка за ' + ui.days + ' дней', icon: 'wallet', value: U.kilo(stats.revenue),
        delta: stats.revenueDelta }) +
      kpiCard({ label: 'Заказов', icon: 'package', value: U.num(stats.orders),
        delta: stats.ordersDelta, hint: 'сегодня: ' + stats.ordersToday }) +
      kpiCard({ label: 'Средний чек', icon: 'card', value: U.money(stats.avgOrder),
        delta: stats.prevAvgOrder
          ? Math.round((stats.avgOrder - stats.prevAvgOrder) / stats.prevAvgOrder * 1000) / 10 : null,
        hint: 'по оплаченным заказам' }) +
      kpiCard({ label: 'Конверсия визита', icon: 'trending-up', value: stats.conversion + ' %',
        delta: stats.prevConversion ? Math.round((stats.conversion - stats.prevConversion) * 10) / 10 : null,
        hint: 'посещений: ' + U.num(stats.visits) }) +
      kpiCard({ label: 'Продано товаров', icon: 'box', value: U.num(stats.itemsSold),
        hint: 'валовая маржа: ' + U.kilo(stats.margin) }) +
      kpiCard({ label: 'Покупателей', icon: 'users', value: U.num(stats.customers),
        delta: stats.customersDelta, hint: 'уникальные аккаунты' }) +
      kpiCard({ label: 'Ожидают обработки', icon: 'bell', value: U.num(stats.pendingOrders),
        hint: 'новые и комплектуются' }) +
      kpiCard({ label: 'Отзывы на модерации', icon: 'thumbs-up', value: U.num(stats.pendingReviews),
        hint: 'средняя оценка: ' + (stats.avgRating || '—') + ' / 5' }) +
      '</div>';
  }
  /** Дашборд: графики выручки, статусов, заказов и воронки. */
  function renderDashboard() {
    var stats = db.analytics(ui.days);
    var colors = ['#22d3ee', '#8b5cf6', '#22c55e', '#f59e0b', '#fb4d6d', '#60a5fa'];
    var statusSeries = Object.keys(stats.statuses).map(function (key) {
      return { label: stats.statuses[key].label, value: stats.statuses[key].count };
    }).filter(function (row) { return row.value > 0; });
    var maxProductRevenue = Math.max.apply(null, stats.topProducts.map(function (p) {
      return p.revenue;
    }).concat([1]));

    return dashboardKpis(stats) +
      '<div class="dash-grid">' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Выручка по дням</h4>' +
      '<span class="muted">Сумма оплаченных заказов в рублях</span></div>' +
      '<span class="badge badge--accent">' + U.money(stats.revenue) + ' за период</span></div>' +
      '<canvas class="chart-canvas" id="chartRevenue"></canvas></div>' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Статусы заказов</h4>' +
      '<span class="muted">Распределение по всей базе</span></div></div>' +
      '<canvas class="chart-canvas" id="chartStatuses"></canvas>' +
      '<div class="legend mt-4">' + statusSeries.map(function (row, index) {
        return '<span class="legend__item"><span class="legend__dot" style="background:' +
          colors[index % colors.length] + '"></span>' + U.esc(row.label) + ': <b>' + row.value + '</b></span>';
      }).join('') + '</div></div></div>' +

      '<div class="dash-grid dash-grid--even">' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Заказы по дням</h4>' +
      '<span class="muted">Количество оформленных заказов</span></div></div>' +
      '<canvas class="chart-canvas chart-canvas--sm" id="chartOrders"></canvas></div>' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Воронка продаж</h4>' +
      '<span class="muted">Путь покупателя от визита до заказа</span></div></div>' +
      stats.funnel.map(function (step, index) {
        var previous = index ? stats.funnel[index - 1].value : step.value;
        var percent = previous ? Math.round(step.value / previous * 100) : 100;
        return '<div class="bar-item mt-3"><span class="bar-item__name">' + BS.icon(step.icon, { size: 14 }) + ' ' +
          U.esc(step.label) + '</span><span class="bar-item__val">' + U.num(step.value) + '</span>' +
          '<span class="bar-item__track"><span class="bar-item__fill" style="width:' +
          Math.min(100, percent) + '%"></span></span></div>';
      }).join('') +
      '<div class="muted small mt-4">Конверсия визита в заказ: <b>' + stats.conversion +
      ' %</b>. ИИ-конфигуратор: ' + U.num(stats.aiUsage.builds) + ' сборок, чат-бот: ' +
      U.num(stats.aiUsage.chats) + ' обращений за период.</div></div></div>' +
      '<div class="dash-grid dash-grid--even">' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Топ товаров по выручке</h4>' +
      '<span class="muted">За последние ' + ui.days + ' дней</span></div></div>' +
      '<div class="bar-list">' + (stats.topProducts.length ? stats.topProducts.map(function (product) {
        return '<div class="bar-item"><span class="bar-item__name">' + U.esc(product.name) + '</span>' +
          '<span class="bar-item__val">' + U.kilo(product.revenue) + '</span>' +
          '<span class="bar-item__track"><span class="bar-item__fill" style="width:' +
          Math.round(product.revenue / maxProductRevenue * 100) + '%"></span></span>' +
          '<span class="muted small">' + product.qty + ' шт.</span></div>';
      }).join('') : '<p class="muted">Нет данных за период</p>') + '</div></div>' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Выручка по категориям</h4>' +
      '<span class="muted">Доля в общей выручке периода</span></div></div>' +
      '<div class="bar-list">' + (stats.categoryRevenue.length ? stats.categoryRevenue.map(function (cat) {
        return '<div class="bar-item"><span class="bar-item__name">' + cat.emoji + ' ' + U.esc(cat.name) +
          '</span><span class="bar-item__val">' + U.kilo(cat.revenue) + '</span>' +
          '<span class="bar-item__track"><span class="bar-item__fill" style="width:' + cat.share +
          '%;background:' + cat.color + '"></span></span>' +
          '<span class="muted small">' + cat.share + ' % · ' + cat.qty + ' шт.</span></div>';
      }).join('') : '<p class="muted">Нет данных за период</p>') + '</div></div></div>' +
      '<div class="dash-grid">' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Последние заказы</h4>' +
      '<span class="muted">Полный список — в разделе «Заказы»</span></div>' +
      '<button class="btn btn--outline btn--sm" data-admin-go="orders">Все заказы</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Номер</th><th>Клиент</th>' +
      '<th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead><tbody>' +
      stats.recentOrders.map(function (order) {
        return '<tr><td class="mono">' + U.esc(order.number) + '</td><td>' + U.esc(order.customer.name) +
          '</td><td class="num">' + U.money(order.total) + '</td><td>' + L.statusBadge(order.status) +
          '</td><td class="muted">' + U.date(order.createdAt) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="chart-card"><div class="chart-head"><div><h4>Контроль остатков</h4>' +
      '<span class="muted">Позиции с остатком менее 9 шт.</span></div></div>' +
      (stats.lowStock.length ? stats.lowStock.map(function (product) {
        return '<div class="log-row"><span class="log-row__icon">' +
          ((db.category(product.categoryId) || {}).emoji || '📦') + '</span>' +
          '<span class="grow small clamp-2">' + U.esc(product.name) + '</span>' +
          '<b class="' + (product.stock === 0 ? 'text-danger' : product.stock <= 3 ? 'text-warn' : '') +
          '">' + product.stock + ' шт.</b></div>';
      }).join('') : '<p class="muted">Все позиции в достаточном количестве</p>') +
      '<h4 class="mt-5">Лучшие покупатели</h4>' +
      stats.topCustomers.map(function (customer) {
        return '<div class="log-row"><span class="table-user__ava">' + U.esc(customer.name.slice(0, 1)) +
          '</span><span class="grow small">' + U.esc(customer.name) + '<br><span class="muted">' +
          customer.orders + ' заказов</span></span><b>' + U.kilo(customer.spent) + '</b></div>';
      }).join('') + '</div></div>' +

      '<div class="chart-card mt-5"><div class="chart-head"><div><h4>Настройки периода и экспорт</h4>' +
      '<span class="muted">Данные обновляются в реальном времени при оформлении заказов на сайте</span></div>' +
      '<div class="btn-group">' +
      '<button class="btn btn--outline btn--sm" data-admin-export="orders">Выгрузить заказы (CSV)</button>' +
      '<button class="btn btn--outline btn--sm" data-admin-export="products">Выгрузить товары (CSV)</button>' +
      '</div></div>' +
      '<div class="grid-4">' +
      '<div><div class="muted small">Период анализа</div><b>' + ui.days + ' дней</b></div>' +
      '<div><div class="muted small">Записей о событиях</div><b>' + U.num(db.events({}).length) + '</b></div>' +
      '<div><div class="muted small">Товаров в каталоге</div><b>' + db.productsAll().length + '</b></div>' +
      '<div><div class="muted small">Занято в хранилище</div><b>' + U.bytes(U.storage.usedBytes()) + '</b></div>' +
      '</div></div>';

  }

  /** Отрисовка графиков дашборда (после вставки разметки). */
  function drawDashboardCharts() {
    var stats = db.analytics(ui.days);
    charts.line(document.getElementById('chartRevenue'), stats.series.map(function (point) {
      return { label: point.label, value: point.revenue };
    }), { moneyAxis: true });
    charts.bars(document.getElementById('chartOrders'), stats.series.map(function (point) {
      return { label: point.short, value: point.orders };
    }), { color: '#8b5cf6' });
    charts.donut(document.getElementById('chartStatuses'), Object.keys(stats.statuses).map(function (key) {
      return { label: stats.statuses[key].label, value: stats.statuses[key].count };
    }).filter(function (row) { return row.value > 0; }), { centerLabel: 'заказов' });
  }
  /* ------------------------------- Панель «Товары» ------------------------ */
  function renderProducts() {
    var photosMissing = db.productsAll(true).filter(function (product) {
      return !String(product.image || '').trim();
    }).length;
    var products = db.productsAll(true).filter(function (product) {
      var matchQuery = !ui.productQuery ||
        U.norm(product.name + ' ' + product.brand + ' ' + product.sku).indexOf(U.norm(ui.productQuery)) !== -1;
      var matchCategory = !ui.productCategory || product.categoryId === ui.productCategory;
      return matchQuery && matchCategory;
    }).sort(function (a, b) { return b.createdAt - a.createdAt; });

    return '<div class="admin-toolbar">' +
      '<label class="input-icon">' + BS.icon('search', { size: 16 }) +
      '<input class="input input--sm" placeholder="Поиск по названию, бренду, артикулу" value="' +
      U.attr(ui.productQuery) + '" data-admin-product-search></label>' +
      '<select class="select input--sm" style="max-width:220px" data-admin-product-category>' +
      '<option value="">Все категории</option>' + db.categories().map(function (category) {
        return '<option value="' + U.attr(category.id) + '"' +
          (ui.productCategory === category.id ? ' selected' : '') + '>' + category.emoji + ' ' +
          U.esc(category.name) + '</option>';
      }).join('') + '</select>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--outline btn--sm" data-admin-go="images">' + BS.icon('image', { size: 15 }) +
      'Фото товаров' + (photosMissing ? ' · ' + photosMissing : '') + '</button>' +
      '<button class="btn btn--outline btn--sm" data-admin-export="products">' +
      BS.icon('download', { size: 15 }) + 'CSV</button>' +
      '<button class="btn btn--primary btn--sm" data-product-new>' + BS.icon('plus', { size: 16 }) +
      'Добавить товар</button></div></div>' +
      '<div class="muted small mb-4">Найдено: <b>' + products.length + '</b> · в наличии: ' +
      products.filter(db.inStock).length + ' · скрыто: ' +
      db.productsAll(true).filter(function (p) { return p.status === 'hidden'; }).length + '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Товар</th><th>Категория</th><th class="num">Цена</th><th class="num">Остаток</th>' +
      '<th class="num">Продажи</th><th class="num">Рейтинг</th><th>Статус</th><th></th></tr></thead><tbody>' +
      (products.length ? products.map(productRow).join('')
        : '<tr><td colspan="8"><p class="muted">Товары не найдены — измените фильтры.</p></td></tr>') +
      '</tbody></table></div>';
  }

  /** Панель управления реальными фотографиями и массового назначения URL. */
  function renderProductImages() {
    var all = db.productsAll(true);
    var filtered = all.filter(function (product) {
      var hasImage = !!String(product.image || '').trim();
      if (ui.photoFilter === 'missing' && hasImage) return false;
      if (ui.photoFilter === 'ready' && !hasImage) return false;
      return !ui.photoQuery || U.norm(product.name + ' ' + product.brand + ' ' + product.sku)
        .indexOf(U.norm(ui.photoQuery)) !== -1;
    }).sort(function (a, b) {
      return Number(!!a.image) - Number(!!b.image) || a.name.localeCompare(b.name, 'ru');
    });
    var missing = all.filter(function (product) { return !String(product.image || '').trim(); }).length;
    var statusText = missing
      ? 'У ' + missing + ' товаров пока нет фотографии. Вставьте прямую ссылку на изображение или заполните шаблон и загрузите CSV.'
      : 'У всех товаров назначены ссылки на фотографии. Здесь можно проверить их и заменить при необходимости.';
    return '<div class="admin-photo-tools">' +
      '<div class="admin-card admin-photo-intro"><div><span class="kicker">' + BS.icon('image', { size: 15 }) +
      ' Фотографии каталога</span><h3>Заполнено ' + (all.length - missing) + ' из ' + all.length + '</h3>' +
      '<p class="muted">' + U.esc(statusText) + '</p></div><div class="admin-photo-actions">' +
      '<button class="btn btn--outline btn--sm" data-photo-template>' + BS.icon('download', { size: 15 }) +
      'Скачать CSV-шаблон</button>' +
      '<label class="btn btn--primary btn--sm admin-photo-upload">' + BS.icon('upload', { size: 15 }) +
      'Загрузить заполненный CSV<input type="file" accept=".csv,text/csv" data-photo-import hidden></label></div></div>' +
      '<div class="admin-toolbar mt-4">' +
      '<label class="input-icon">' + BS.icon('search', { size: 16 }) +
      '<input class="input input--sm" placeholder="Поиск товара или артикула" value="' +
      U.attr(ui.photoQuery) + '" data-photo-search></label>' +
      '<select class="select input--sm" style="max-width:220px" data-photo-filter>' +
      '<option value="missing"' + (ui.photoFilter === 'missing' ? ' selected' : '') + '>Без фото</option>' +
      '<option value="all"' + (ui.photoFilter === 'all' ? ' selected' : '') + '>Все товары</option>' +
      '<option value="ready"' + (ui.photoFilter === 'ready' ? ' selected' : '') + '>С фото</option></select>' +
      '<span class="muted small" data-photo-count>Показано: ' + filtered.length + '</span></div>' +
      '<div class="admin-photo-grid">' + (filtered.length ? filtered.map(productPhotoCard).join('') :
        '<div class="admin-card"><h4>Здесь пока нечего показывать</h4><p class="muted">Измените фильтр или поиск.</p></div>') +
      '</div><p class="muted small mt-4">Добавляйте прямые ссылки на изображения производителей или поставщиков. ' +
      'Для поиска конкретной модели используйте кнопку «Найти фото», затем скопируйте адрес самого изображения.</p></div>';
  }

  function productPhotoCard(product) {
    var query = [product.brand, product.name, 'official product photo'].filter(Boolean).join(' ');
    var searchUrl = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
    var category = db.category(product.categoryId) || {};
    return '<article class="admin-photo-card" data-photo-card data-photo-search-text="' +
      U.attr(U.norm(product.name + ' ' + product.brand + ' ' + product.sku)) + '" data-photo-name="' +
      U.attr(product.name) + '">' +
      '<div class="admin-photo-card__preview">' + BS.art(product) + '</div>' +
      '<div class="admin-photo-card__body"><div class="between gap-3"><div class="grow">' +
      '<span class="muted small">' + U.esc(category.name || 'Товар') + ' · ' + U.esc(product.sku) + '</span>' +
      '<h4>' + U.esc(product.name) + '</h4></div>' +
      '<span class="badge ' + (product.image ? 'badge--ok' : 'badge--warn') + '">' +
      (product.image ? 'Фото задано' : 'Нет фото') + '</span></div>' +
      '<div class="admin-photo-card__controls"><label class="field grow"><span class="label">Прямая ссылка на фото</span>' +
      '<input class="input input--sm" type="url" placeholder="https://…" value="' + U.attr(product.image || '') +
      '" data-photo-url="' + U.attr(product.id) + '"></label>' +
      '<div class="admin-photo-card__buttons"><a class="btn btn--outline btn--sm" href="' + U.attr(searchUrl) +
      '" target="_blank" rel="noopener noreferrer">Найти фото</a>' +
      '<button class="btn btn--primary btn--sm" data-photo-save="' + U.attr(product.id) + '">Сохранить</button>' +
      (product.image ? '<button class="btn btn--ghost btn--sm" data-photo-clear="' + U.attr(product.id) + '">Убрать</button>' : '') +
      '</div></div></div></article>';
  }

  function photoTemplateCsv() {
    var rows = ['sku;image_url'].concat(db.productsAll(true).map(function (product) {
      return product.sku + ';' + (product.image || '');
    }));
    return rows.join('\r\n');
  }

  async function importPhotoCsv(text) {
    var products = db.productsAll(true), bySku = {};
    products.forEach(function (product) { bySku[String(product.sku).toLowerCase()] = product; });
    var updated = 0, unknown = 0, invalid = 0;
    String(text || '').split(/\r?\n/).forEach(function (line, index) {
      line = line.replace(/^\uFEFF/, '');
      if (!line.trim() || (index === 0 && /^\s*sku\s*[;,\t]/i.test(line))) return;
      var delimiter = line.indexOf(';');
      if (delimiter < 0) delimiter = line.indexOf('\t');
      if (delimiter < 0) delimiter = line.indexOf(',');
      if (delimiter < 0) { invalid++; return; }
      var sku = line.slice(0, delimiter).trim().replace(/^"|"$/g, '').toLowerCase();
      var image = line.slice(delimiter + 1).trim().replace(/^"|"$/g, '');
      var product = bySku[sku];
      if (!product) { unknown++; return; }
      if (!image) return;
      if (!/^(https?:\/\/|\/(?!\/)|\.\/)/i.test(image)) { invalid++; return; }
      product.image = image;
      product.__photoChanged = true;
      product.updatedAt = Date.now();
      updated++;
    });
    if (updated && BS.cloud) {
      for (var photoProduct of products) {
        if (photoProduct.__photoChanged) {
          delete photoProduct.__photoChanged;
          await db.saveProduct(photoProduct);
        }
      }
    }
    if (updated) {
      db.audit('Обновлены фотографии товаров: ' + updated, 'admin');
      db.save();
    }
    return { updated: updated, unknown: unknown, invalid: invalid };
  }

  async function savePhotoUrl(product, value) {
    var url = String(value || '').trim();
    if (url && !/^(https?:\/\/|\/(?!\/)|\.\/)/i.test(url)) {
      L.toast('Укажите прямую ссылку http(s) или путь к файлу сайта', 'warn', 'Проверьте ссылку');
      return;
    }
    var result = await db.saveProduct(Object.assign({}, product, { image: url }));
    if (!result.ok) { L.toastError(result.message); return; }
    L.toastOk(url ? 'Фотография назначена товару' : 'Фотография удалена');
    admin.show('images');
  }

  function wirePhotoPreviews() {
    U.$$('[data-photo-card]').forEach(function (card) {
      var image = card.querySelector('.admin-photo-card__preview img');
      if (!image) return;
      image.addEventListener('error', async function () {
        image.parentNode.innerHTML = '<span class="admin-photo-preview-fallback">Не удалось загрузить изображение</span>';
      }, { once: true });
    });
  }

  function productRow(product) {
    return '<tr>' +
      '<td><div class="table-user"><span class="row-thumb">' + BS.art(product) + '</span>' +
      '<span><a href="product.html?id=' + U.attr(product.id) + '" target="_blank">' + U.esc(product.name) +
      '</a><br><span class="muted small mono">' + U.esc(product.sku) + ' · ' + U.esc(product.brand) +
      '</span></span></div></td>' +
      '<td class="muted">' + U.esc((db.category(product.categoryId) || {}).name || '—') + '</td>' +
      '<td class="num"><b>' + U.money(product.price) + '</b>' +
      (db.discountOf(product) ? '<br><span class="muted small">было ' + U.money(product.oldPrice) + '</span>' : '') +
      '</td>' +
      '<td class="num"><input class="input input--sm stock-input" type="number" min="0" value="' +
      product.stock + '" data-stock-input="' + U.attr(product.id) + '"></td>' +
      '<td class="num">' + U.num(product.sales) + '</td>' +
      '<td class="num">' + (product.rating || '—') + '</td>' +
      '<td>' + (product.status === 'hidden' ? '<span class="badge badge--warn">Скрыт</span>'
        : product.stock === 0 ? '<span class="badge badge--danger">Нет в наличии</span>'
          : '<span class="badge badge--ok">Активен</span>') + '</td>' +
      '<td><div class="actions">' +
      '<button class="btn btn--soft btn--icon btn--sm tip" data-product-edit="' + U.attr(product.id) +
      '" data-tip="Редактировать">' + BS.icon('edit', { size: 15 }) + '</button>' +
      '<button class="btn btn--ghost btn--icon btn--sm tip" data-product-toggle="' + U.attr(product.id) +
      '" data-tip="' + (product.status === 'hidden' ? 'Показать' : 'Скрыть') + '">' +
      BS.icon(product.status === 'hidden' ? 'eye' : 'eye-off', { size: 15 }) + '</button>' +
      '<button class="btn btn--ghost btn--icon btn--sm tip" data-product-copy="' + U.attr(product.id) +
      '" data-tip="Дублировать">' + BS.icon('copy', { size: 15 }) + '</button>' +
      '<button class="btn btn--ghost btn--icon btn--sm tip text-danger" data-product-delete="' +
      U.attr(product.id) + '" data-tip="Удалить">' + BS.icon('trash', { size: 15 }) + '</button>' +
      '</div></td></tr>';
  }

  function specRow(key, value) {
    return '<div class="spec-editor__row" data-spec-row>' +
      '<input class="input input--sm" placeholder="socket" data-spec-key value="' + U.attr(key || '') + '">' +
      '<input class="input input--sm" placeholder="LGA1700" data-spec-value value="' +
      U.attr(value === undefined || value === null ? '' : value) + '">' +
      '<button class="btn btn--ghost btn--icon btn--sm" type="button" data-spec-remove title="Удалить">' +
      BS.icon('x', { size: 15 }) + '</button></div>';
  }
  /** Форма товара: создание и редактирование. */
  function openProductForm(product) {
    var isNew = !product;
    product = product || { key: [], badges: [], specs: {}, categoryId: 'cpu', brand: 'ByteStore', status: 'active' };
    var specRows = Object.keys(product.specs || {}).length
      ? Object.keys(product.specs).map(function (key) { return specRow(key, product.specs[key]); }).join('')
      : specRow('', '');
    var instance = L.modal({
      title: isNew ? 'Новый товар' : 'Редактирование: ' + product.name,
      size: 'wide',
      html: '<form data-product-form>' +
        '<input type="hidden" name="id" value="' + U.attr(product.id || '') + '">' +
        '<div class="modal-grid">' +
        '<div class="field full"><label for="pName">Название товара *</label>' +
        '<input class="input" id="pName" name="name" required value="' + U.attr(product.name || '') + '"></div>' +
        '<div class="field"><label for="pCategory">Категория *</label>' +
        '<select class="select" id="pCategory" name="categoryId">' + db.categories().map(function (category) {
          return '<option value="' + U.attr(category.id) + '"' +
            (product.categoryId === category.id ? ' selected' : '') + '>' + category.emoji + ' ' +
            U.esc(category.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="pBrand">Бренд</label>' +
        '<input class="input" id="pBrand" name="brand" value="' + U.attr(product.brand || '') + '"></div>' +
        '<div class="field"><label for="pPrice">Цена, ₸ *</label>' +
        '<input class="input" id="pPrice" name="price" type="number" min="0" required value="' +
        U.attr(product.price || 0) + '"></div>' +
        '<div class="field"><label for="pOldPrice">Старая цена (для скидки)</label>' +
        '<input class="input" id="pOldPrice" name="oldPrice" type="number" min="0" value="' +
        U.attr(product.oldPrice || '') + '"></div>' +
        '<div class="field"><label for="pCost">Закупочная цена, ₸</label>' +
        '<input class="input" id="pCost" name="cost" type="number" min="0" value="' +
        U.attr(product.cost || '') + '"></div>' +
        '<div class="field"><label for="pStock">Остаток, шт.</label>' +
        '<input class="input" id="pStock" name="stock" type="number" min="0" value="' +
        U.attr(product.stock || 0) + '"></div>' +
        '<div class="field"><label for="pSku">Артикул</label>' +
        '<input class="input" id="pSku" name="sku" value="' + U.attr(product.sku || '') + '"></div>' +
        '<div class="field"><label for="pStatus">Статус</label>' +
        '<select class="select" id="pStatus" name="status">' +
        '<option value="active"' + (product.status !== 'hidden' ? ' selected' : '') + '>Активен</option>' +
        '<option value="hidden"' + (product.status === 'hidden' ? ' selected' : '') +
        '>Скрыт из каталога</option></select></div>' +
        '<div class="field full"><label for="pKey">Ключевые характеристики (через запятую)</label>' +
        '<input class="input" id="pKey" name="key" placeholder="8 ГБ GDDR6, DLSS 3" value="' +
        U.attr((product.key || []).join(', ')) + '"></div>' +
        '<div class="field full"><label for="pBadges">Бейджи (через запятую)</label>' +
        '<input class="input" id="pBadges" name="badges" placeholder="Хит, Новинка" value="' +
        U.attr((product.badges || []).join(', ')) + '"></div>' +
        '<div class="field full"><label for="pImage">Ссылка на изображение (необязательно)</label>' +
        '<input class="input" id="pImage" name="image" placeholder="https://… или пусто для авто-иллюстрации" ' +
        'value="' + U.attr(product.image || '') + '"></div>' +
        '<div class="field full"><label for="pDesc">Описание</label>' +
        '<textarea class="textarea" id="pDesc" name="description" rows="3">' +
        U.esc(product.description || '') + '</textarea></div></div>' +
        '<div class="panel-head mt-4"><h4>Характеристики (specs)</h4>' +
        '<button class="btn btn--ghost btn--xs" type="button" data-spec-add>' +
        BS.icon('plus', { size: 14 }) + 'Добавить поле</button></div>' +
        '<div class="spec-editor" data-spec-editor>' + specRows + '</div>' +
        '<p class="muted small mt-3">Поля specs используются конфигуратором и калькулятором совместимости. ' +
        'Ключ <span class="mono">score</span> задаёт индекс производительности от 0 до 100.</p></form>',
      footer: '<button class="btn" data-close>Отмена</button>' +
        '<button class="btn btn--primary" data-product-save>' + BS.icon('check', { size: 17 }) +
        'Сохранить товар</button>'
    });
    admin.onProductModal = { instance: instance, isNew: isNew };
  }
  /* ----------------------------- Панель «Категории» ----------------------- */
  function renderCategories() {
    return '<div class="admin-toolbar"><div class="muted small">Категории формируют структуру каталога, ' +
      'а поле «слот конфигуратора» связывает категорию с ИИ-подбором ПК.</div>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--primary btn--sm" data-category-new>' + BS.icon('plus', { size: 16 }) +
      'Добавить категорию</button></div></div>' +
      '<div class="grid-3">' + db.categories().map(function (category) {
        var count = db.byCategory(category.id).length;
        var withSlot = db.categories().filter(function (c) { return c.slot; }).length;
        return '<div class="admin-card">' +
          '<div class="between mb-3"><span class="cat-tile__icon">' + category.emoji + '</span>' +
          '<div class="btn-group">' +
          '<button class="btn btn--ghost btn--icon btn--sm tip" data-category-edit="' + U.attr(category.id) +
          '" data-tip="Изменить">' + BS.icon('edit', { size: 15 }) + '</button>' +
          '<button class="btn btn--ghost btn--icon btn--sm tip text-danger" data-category-delete="' +
          U.attr(category.id) + '" data-tip="Удалить">' + BS.icon('trash', { size: 15 }) + '</button>' +
          '</div></div>' +
          '<h4>' + U.esc(category.name) + '</h4>' +
          '<p class="muted small clamp-2">' + U.esc(category.description || '') + '</p>' +
          '<div class="row gap-2 wrap mt-3">' +
          '<span class="badge badge--accent">' + count + ' товаров</span>' +
          (category.slot ? '<span class="badge badge--violet">слот: ' + U.esc(category.slot) + '</span>'
            : '<span class="badge">не в конфигураторе</span>') +
          '<span class="badge">' + U.esc(category.id) + '</span>' +
          '</div></div>';
      }).join('') + '</div>' +
      '<div class="muted small mt-4">Слотов конфигуратора настроено: ' +
      db.categories().filter(function (c) { return c.slot; }).length + ' из ' + ad_slotCount() + '.</div>';
  }
  function ad_slotCount() { return BS.advisor.SLOTS.length; }

  function openCategoryForm(category) {
    var isNew = !category;
    category = category || { color: '#22d3ee', color2: '#8b5cf6', emoji: '📦', icon: 'box' };
    var iconOptions = ['cpu', 'grid', 'gpu', 'memory', 'database', 'zap', 'box', 'wind', 'monitor',
      'keyboard', 'package', 'layers', 'tag'].filter(function (name) { return BS.hasIcon(name); });
    var instance = L.modal({
      title: isNew ? 'Новая категория' : 'Категория: ' + category.name,
      html: '<form data-category-form>' +
        '<input type="hidden" name="id" value="' + U.attr(category.id || '') + '">' +
        '<div class="field"><label for="cName">Название *</label>' +
        '<input class="input" id="cName" name="name" required value="' + U.attr(category.name || '') + '"></div>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="cEmoji">Эмодзи</label>' +
        '<input class="input" id="cEmoji" name="emoji" maxlength="4" value="' +
        U.attr(category.emoji || '📦') + '"></div>' +
        '<div class="field"><label for="cIcon">Иконка</label>' +
        '<select class="select" id="cIcon" name="icon">' + iconOptions.map(function (name) {
          return '<option value="' + name + '"' + (category.icon === name ? ' selected' : '') + '>' + name + '</option>';
        }).join('') + '</select></div></div>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="cColor">Основной цвет</label>' +
        '<input class="input" id="cColor" name="color" type="color" value="' +
        U.attr(category.color || '#22d3ee') + '"></div>' +
        '<div class="field"><label for="cColor2">Дополнительный цвет</label>' +
        '<input class="input" id="cColor2" name="color2" type="color" value="' +
        U.attr(category.color2 || '#8b5cf6') + '"></div></div>' +
        '<div class="field"><label for="cSlot">Слот конфигуратора</label>' +
        '<select class="select" id="cSlot" name="slot"><option value="">— не используется —</option>' +
        BS.advisor.SLOTS.map(function (slot) {
          return '<option value="' + slot.slot + '"' + (category.slot === slot.slot ? ' selected' : '') + '>' +
            U.esc(slot.label) + ' (' + slot.slot + ')</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="cOrder">Порядок вывода</label>' +
        '<input class="input" id="cOrder" name="order" type="number" min="1" value="' +
        U.attr(category.order || db.categories().length + 1) + '"></div>' +
        '<div class="field"><label for="cDesc">Описание</label>' +
        '<textarea class="textarea" id="cDesc" name="description" rows="3">' +
        U.esc(category.description || '') + '</textarea></div></form>',
      footer: '<button class="btn" data-close>Отмена</button>' +
        '<button class="btn btn--primary" data-category-save>Сохранить</button>'
    });
    admin.onCategoryModal = instance;
  }
  /* ------------------------------- Панель «Заказы» ----------------------- */
  function renderOrders() {
    var orders = db.orders({ q: ui.orderQuery });
    var stats = db.analytics(ui.days);
    return '<div class="kpi-grid mb-5">' +
      kpiCard({ label: 'Всего заказов', icon: 'package', value: U.num(db.orders({}).length),
        hint: 'в базе магазина' }) +
      kpiCard({ label: 'В обработке', icon: 'bell', value: U.num(stats.pendingOrders),
        hint: 'новые и комплектуются' }) +
      kpiCard({ label: 'Выручка за ' + ui.days + ' дней', icon: 'wallet', value: U.kilo(stats.revenue),
        delta: stats.revenueDelta }) +
      kpiCard({ label: 'Средний чек', icon: 'card', value: U.money(stats.avgOrder),
        hint: 'по оплаченным заказам' }) +
      '</div>' +
      '<div class="admin-toolbar">' +
      '<label class="input-icon">' + BS.icon('search', { size: 16 }) +
      '<input class="input input--sm" placeholder="Номер заказа, клиент, город, товар" value="' +
      U.attr(ui.orderQuery) + '" data-admin-order-search></label>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--outline btn--sm" data-admin-export="orders">' + BS.icon('download', { size: 15 }) +
      'CSV</button></div></div>' +
      '<div class="muted small mb-4">Показано заказов: <b>' + orders.length +
      '</b> (новые сверху). Изменение статуса сразу отражается в личном кабинете покупателя.</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Номер</th><th>Клиент</th><th>Состав</th><th class="num">Сумма</th><th>Статус</th>' +
      '<th>Оплата</th><th>Дата</th><th></th></tr></thead><tbody>' +
      (orders.length ? orders.slice(0, 200).map(orderRow).join('')
        : '<tr><td colspan="8"><p class="muted">Заказы не найдены.</p></td></tr>') +
      '</tbody></table></div>';
  }

  function orderRow(order) {
    return '<tr>' +
      '<td class="mono">' + U.esc(order.number) + '</td>' +
      '<td><div class="table-user"><span class="table-user__ava">' + U.esc(order.customer.name.slice(0, 1)) +
      '</span><span>' + U.esc(order.customer.name) + '<br><span class="muted small">' +
      U.esc(order.customer.phone) + '</span></span></div></td>' +
      '<td class="muted small">' + order.items.slice(0, 2).map(function (item) {
        return U.esc(item.name.slice(0, 34)) + ' × ' + item.qty;
      }).join('<br>') + (order.items.length > 2 ? '<br>+' + (order.items.length - 2) + ' поз.' : '') + '</td>' +
      '<td class="num"><b>' + U.money(order.total) + '</b></td>' +
      '<td><select class="select input--sm" style="min-width:150px" data-order-status="' + U.attr(order.id) +
      '">' + Object.keys(db.ORDER_STATUS).map(function (key) {
        return '<option value="' + key + '"' + (order.status === key ? ' selected' : '') + '>' +
          db.ORDER_STATUS[key].label + '</option>';
      }).join('') + '</select></td>' +
      '<td class="muted small">' + U.esc(order.payment) + '</td>' +
      '<td class="muted small">' + U.date(order.createdAt, true) + '</td>' +
      '<td><div class="actions">' +
      '<button class="btn btn--soft btn--icon btn--sm tip" data-order-view="' + U.attr(order.id) +
      '" data-tip="Подробнее">' + BS.icon('list', { size: 15 }) + '</button>' +
      '<button class="btn btn--ghost btn--icon btn--sm tip text-danger" data-order-delete="' +
      U.attr(order.id) + '" data-tip="Удалить">' + BS.icon('trash', { size: 15 }) + '</button>' +
      '</div></td></tr>';
  }
  /** Карточка заказа: состав, клиент, таймлайн и комментарий менеджера. */
  function openOrderDetails(order) {
    var timeline = order.status === 'cancelled' ? '' : db.orderTimeline(order).map(function (step) {
      return '<div class="log-row"><span class="log-row__icon">' + BS.icon(step.icon, { size: 15 }) + '</span>' +
        '<span class="grow small">' + U.esc(step.label) + '</span>' +
        '<span class="log-row__time">' + (step.ts ? U.date(step.ts, true) : '—') + '</span></div>';
    }).join('');
    L.modal({
      title: 'Заказ ' + order.number,
      size: 'wide',
      html: '<div class="grid-2"><div><h4>Состав заказа</h4>' +
        order.items.map(function (item) {
          return '<div class="order-line"><span>' + U.esc(item.name) + ' × ' + item.qty + '</span><b>' +
            U.money(item.price * item.qty) + '</b></div>';
        }).join('') +
        '<div class="summary-row"><span>Сумма товаров</span><b>' + U.money(order.subtotal) + '</b></div>' +
        (order.discount ? '<div class="summary-row text-ok"><span>Скидка ' + U.esc(order.promoCode) +
          '</span><b>−' + U.money(order.discount) + '</b></div>' : '') +
        '<div class="summary-row"><span>Доставка</span><b>' +
        (order.deliveryCost ? U.money(order.deliveryCost) : 'бесплатно') + '</b></div>' +
        '<div class="summary-row summary-row--total"><span>Итого</span><span>' + U.money(order.total) + '</span></div>' +
        '<h4 class="mt-5">Клиент</h4><div class="col gap-2 small">' +
        '<div class="between"><span>Имя</span><b>' + U.esc(order.customer.name) + '</b></div>' +
        '<div class="between"><span>Телефон</span><b>' + U.esc(order.customer.phone) + '</b></div>' +
        '<div class="between"><span>E-mail</span><b>' + U.esc(order.customer.email || '—') + '</b></div>' +
        '<div class="between"><span>Адрес</span><b>' + U.esc(order.city + ', ' + order.address) + '</b></div>' +
        '<div class="between"><span>Доставка</span><b>' + U.esc(order.deliveryType) + '</b></div>' +
        '<div class="between"><span>Оплата</span><b>' + U.esc(order.payment) + '</b></div>' +
        '<div class="between"><span>Источник</span><b>' + U.esc(order.source || 'Каталог') + '</b></div>' +
        '</div>' + (order.comment ? '<p class="muted small mt-3">Комментарий покупателя: ' +
          U.esc(order.comment) + '</p>' : '') + '</div>' +
        '<div><h4>Этапы обработки</h4>' + (timeline || '<p class="muted">Заказ отменён.</p>') +
        '<div class="field mt-4"><label for="ordComment">Комментарий менеджера</label>' +
        '<textarea class="textarea" id="ordComment" rows="3" ' +
        'placeholder="Например: клиент просил доставку после 18:00">' +
        U.esc(order.managerComment || '') + '</textarea></div>' +
        '<div class="btn-group">' +
        '<button class="btn btn--primary btn--sm" data-order-save="' + U.attr(order.id) +
        '">Сохранить комментарий</button>' +
        '<button class="btn btn--outline btn--sm" data-order-cancel="' + U.attr(order.id) +
        '">Отменить заказ</button></div></div></div>',
      footer: '<button class="btn" data-close>Закрыть</button>'
    });
  }
  /* ------------------------------- Панель «Отзывы» ----------------------- */
  function renderReviews() {
    var reviews = db.reviews({ statuses: ui.reviewStatus === 'all' ? null : [ui.reviewStatus], sort: 'new' });
    var stats = db.analytics(90);
    return '<div class="kpi-grid mb-5">' +
      kpiCard({ label: 'Всего отзывов', icon: 'thumbs-up', value: U.num(db.all('reviews').length),
        hint: 'включая скрытые' }) +
      kpiCard({ label: 'Ждут модерации', icon: 'bell', value: U.num(db.pendingReviewsCount()),
        hint: 'требуют решения' }) +
      kpiCard({ label: 'Средняя оценка', icon: 'star', value: (stats.avgRating || '—') + ' / 5',
        hint: 'по опубликованным' }) +
      kpiCard({ label: 'С ответом магазина', icon: 'mail',
        value: U.num(db.all('reviews').filter(function (r) { return !!r.reply; }).length),
        hint: 'публичные ответы' }) +
      '</div>' +
      '<div class="admin-toolbar">' +
      '<div class="tabs">' + [['all', 'Все'], ['pending', 'На модерации'],
        ['published', 'Опубликованные'], ['rejected', 'Отклонённые']].map(function (pair) {
        return '<button class="tab' + (ui.reviewStatus === pair[0] ? ' is-active' : '') +
          '" data-review-filter="' + pair[0] + '">' + pair[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--outline btn--sm" data-admin-export="reviews">' + BS.icon('download', { size: 15 }) +
      'CSV</button></div></div>' +
      (reviews.length ? reviews.map(reviewRow).join('')
        : '<div class="admin-card">' + L.emptyState({
          emoji: '💬', title: 'Отзывов в этом разделе нет',
          text: 'Отзывы покупателей появляются здесь сразу после отправки и ждут модерации.'
        }) + '</div>');
  }

  function reviewRow(review) {
    var statusMeta = {
      published: { label: 'Опубликован', cls: 'ok' },
      pending: { label: 'На модерации', cls: 'warn' },
      rejected: { label: 'Отклонён', cls: 'danger' }
    }[review.status] || { label: review.status, cls: 'info' };
    return '<div class="admin-card" data-review-row="' + U.attr(review.id) + '">' +
      '<div class="between wrap mb-3">' +
      '<div class="row gap-3 center">' + BS.stars(review.rating, { size: 15 }) +
      '<b>' + U.esc(review.author) + '</b>' +
      (review.verified ? '<span class="badge badge--ok">Покупка подтверждена</span>'
        : '<span class="badge">Гость</span>') +
      '<span class="muted small">' + U.date(review.createdAt, true) + '</span></div>' +
      '<span class="badge badge--' + statusMeta.cls + '">' + statusMeta.label + '</span></div>' +
      '<div class="muted small mb-3">Товар: <a href="product.html?id=' + U.attr(review.productId) +
      '" target="_blank">' + U.esc(review.productName || review.productId) + '</a></div>' +
      '<div class="review-body-cell"><p>«' + U.esc(review.text) + '»</p></div>' +
      (review.pros ? '<p class="small text-ok mt-2">Плюсы: ' + U.esc(review.pros) + '</p>' : '') +
      (review.cons ? '<p class="small text-warn mt-2">Минусы: ' + U.esc(review.cons) + '</p>' : '') +
      (review.reply ? '<div class="review__reply mt-3"><b>Ответ магазина</b>' + U.esc(review.reply) + '</div>' : '') +
      '<div class="btn-group mt-4">' +
      (review.status !== 'published' ? '<button class="btn btn--ok btn--sm" data-review-publish="' +
        U.attr(review.id) + '">' + BS.icon('check', { size: 15 }) + 'Опубликовать</button>' : '') +
      (review.status !== 'rejected' ? '<button class="btn btn--outline btn--sm" data-review-reject="' +
        U.attr(review.id) + '">Скрыть</button>' : '') +
      '<button class="btn btn--soft btn--sm" data-review-reply="' + U.attr(review.id) + '">' +
      BS.icon('send', { size: 15 }) + (review.reply ? 'Изменить ответ' : 'Ответить') + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-review-edit="' + U.attr(review.id) + '">Редактировать</button>' +
      '<button class="btn btn--danger btn--sm" data-review-delete="' + U.attr(review.id) + '">Удалить</button>' +
      '</div></div>';
  }
  /* --------------------------- Панель «Пользователи» --------------------- */
  function renderUsers() {
    var users = db.users({ q: ui.userQuery || '' });
    return '<div class="admin-toolbar">' +
      '<label class="input-icon">' + BS.icon('search', { size: 16 }) +
      '<input class="input input--sm" placeholder="Имя, e-mail или телефон" value="' +
      U.attr(ui.userQuery || '') + '" data-admin-user-search></label>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--outline btn--sm" data-admin-export="users">' + BS.icon('download', { size: 15 }) +
      'CSV</button></div></div>' +
      '<div class="muted small mb-4">Клиентов в базе: <b>' + db.all('users').length + '</b> · ' +
      'заблокировано: ' + db.all('users').filter(function (u) { return u.status === 'blocked'; }).length + '</div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Клиент</th><th>Контакты</th><th class="num">Заказов</th><th class="num">Сумма покупок</th>' +
      '<th class="num">Отзывов</th><th>Регистрация</th><th>Статус</th><th></th></tr></thead><tbody>' +
      users.map(function (user) {
        var stats = db.userStats(user.id);
        return '<tr>' +
          '<td><div class="table-user"><span class="table-user__ava">' + BS.auth.initials(user.name) +
          '</span><span>' + U.esc(user.name) + '<br><span class="muted small">ID ' + U.esc(user.id) +
          '</span></span></div></td>' +
          '<td class="muted small">' + U.esc(user.email) + '<br>' + U.esc(user.phone || '') + '</td>' +
          '<td class="num">' + stats.orders + '</td>' +
          '<td class="num"><b>' + U.money(stats.spent) + '</b></td>' +
          '<td class="num">' + stats.reviews + '</td>' +
          '<td class="muted small">' + U.date(user.createdAt) + '<br>' +
          (user.lastLogin ? 'вход: ' + U.timeAgo(user.lastLogin) : '') + '</td>' +
          '<td>' + (user.status === 'blocked' ? '<span class="badge badge--danger">Заблокирован</span>'
            : '<span class="badge badge--ok">Активен</span>') + '</td>' +
          '<td><div class="actions">' +
          '<button class="btn btn--soft btn--icon btn--sm tip" data-user-view="' + U.attr(user.id) +
          '" data-tip="Карточка клиента">' + BS.icon('user', { size: 15 }) + '</button>' +
          '<button class="btn btn--ghost btn--icon btn--sm tip" data-user-block="' + U.attr(user.id) +
          '" data-tip="' + (user.status === 'blocked' ? 'Разблокировать' : 'Заблокировать') + '">' +
          BS.icon(user.status === 'blocked' ? 'check-circle' : 'lock', { size: 15 }) + '</button>' +
          '<button class="btn btn--ghost btn--icon btn--sm tip text-danger" data-user-delete="' +
          U.attr(user.id) + '" data-tip="Удалить">' + BS.icon('trash', { size: 15 }) + '</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function openUserCard(user) {
    var stats = db.userStats(user.id);
    var orders = db.orders({ userId: user.id }).slice(0, 5);
    L.modal({
      title: 'Клиент: ' + user.name,
      html: '<div class="grid-4">' +
        '<div><div class="muted small">Заказов</div><b>' + stats.orders + '</b></div>' +
        '<div><div class="muted small">Сумма покупок</div><b>' + U.money(stats.spent) + '</b></div>' +
        '<div><div class="muted small">Средний чек</div><b>' +
        U.money(stats.orders ? Math.round(stats.spent / stats.orders) : 0) + '</b></div>' +
        '<div><div class="muted small">Бонусы</div><b>' + U.num(user.bonus || 0) + '</b></div></div>' +
        '<div class="col gap-2 mt-5 small">' +
        '<div class="between"><span>E-mail</span><b>' + U.esc(user.email) + '</b></div>' +
        '<div class="between"><span>Телефон</span><b>' + U.esc(user.phone || '—') + '</b></div>' +
        '<div class="between"><span>Роль</span><b>' + U.esc(user.role) + '</b></div>' +
        '<div class="between"><span>Регистрация</span><b>' + U.date(user.createdAt) + '</b></div>' +
        '<div class="between"><span>Последний вход</span><b>' +
        (user.lastLogin ? U.date(user.lastLogin, true) : '—') + '</b></div>' +
        '<div class="between"><span>Рассылка</span><b>' + (user.newsletter ? 'да' : 'нет') + '</b></div>' +
        '</div>' +
        '<h4 class="mt-5">Последние заказы</h4>' +
        (orders.length ? orders.map(function (order) {
          return '<div class="order-line"><span class="mono">' + U.esc(order.number) + '</span>' +
            '<span class="muted small">' + U.date(order.createdAt) + '</span><b>' + U.money(order.total) +
            '</b></div>';
        }).join('') : '<p class="muted">Заказов нет</p>'),
      footer: '<button class="btn" data-close>Закрыть</button>'
    });
  }
  /* ------------------------------ Панель «Промокоды» --------------------- */
  function renderPromos() {
    var promos = db.promos(false);
    return '<div class="admin-toolbar"><div class="muted small">' +
      'Промокоды применяются в корзине при оформлении заказа.</div>' +
      '<div class="admin-toolbar__right">' +
      '<button class="btn btn--primary btn--sm" data-promo-new>' + BS.icon('plus', { size: 16 }) +
      'Добавить промокод</button></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Код</th><th>Тип</th><th class="num">Значение</th><th class="num">Мин. сумма</th>' +
      '<th class="num">Использований</th><th>Статус</th><th>Описание</th><th></th></tr></thead><tbody>' +
      promos.map(function (promo) {
        return '<tr>' +
          '<td class="mono"><b>' + U.esc(promo.code) + '</b></td>' +
          '<td>' + (promo.type === 'percent' ? 'Процент' : 'Фиксированная') + '</td>' +
          '<td class="num">' + U.esc(db.promoLabel(promo)) + '</td>' +
          '<td class="num">' + U.money(promo.min) + '</td>' +
          '<td class="num">' + U.num(promo.used || 0) + '</td>' +
          '<td>' + (promo.active ? '<span class="badge badge--ok">Активен</span>'
            : '<span class="badge">Архив</span>') + '</td>' +
          '<td class="muted small">' + U.esc(promo.description) + '</td>' +
          '<td><div class="actions">' +
          '<button class="btn btn--soft btn--icon btn--sm tip" data-promo-edit="' + U.attr(promo.code) +
          '" data-tip="Изменить">' + BS.icon('edit', { size: 15 }) + '</button>' +
          '<button class="btn btn--ghost btn--icon btn--sm tip" data-promo-toggle="' + U.attr(promo.code) +
          '" data-tip="Активность">' + BS.icon('refresh', { size: 15 }) + '</button>' +
          '<button class="btn btn--ghost btn--icon btn--sm tip text-danger" data-promo-delete="' +
          U.attr(promo.code) + '" data-tip="Удалить">' + BS.icon('trash', { size: 15 }) + '</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function openPromoForm(promo) {
    var isNew = !promo;
    promo = promo || { type: 'percent', value: 10, min: 0, active: true };
    var instance = L.modal({
      title: isNew ? 'Новый промокод' : 'Промокод ' + promo.code,
      html: '<form data-promo-form>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="prCode">Код *</label>' +
        '<input class="input" id="prCode" name="code" required placeholder="BYTE10" value="' +
        U.attr(promo.code || '') + '"' + (isNew ? '' : ' readonly') + '></div>' +
        '<div class="field"><label for="prType">Тип скидки</label>' +
        '<select class="select" id="prType" name="type">' +
        '<option value="percent"' + (promo.type === 'percent' ? ' selected' : '') + '>Процент от суммы</option>' +
        '<option value="fixed"' + (promo.type === 'fixed' ? ' selected' : '') + '>Фиксированная сумма, ₸</option>' +
        '</select></div></div>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="prValue">Значение *</label>' +
        '<input class="input" id="prValue" name="value" type="number" min="1" required value="' +
        U.attr(promo.value) + '"></div>' +
        '<div class="field"><label for="prMin">Минимальная сумма заказа, ₸</label>' +
        '<input class="input" id="prMin" name="min" type="number" min="0" value="' +
        U.attr(promo.min || 0) + '"></div></div>' +
        '<div class="field"><label for="prDesc">Описание для покупателя</label>' +
        '<input class="input" id="prDesc" name="description" ' +
        'placeholder="Скидка 10% на заказ от 280 000 ₸" value="' + U.attr(promo.description || '') + '"></div>' +
        '<label class="switch"><input type="checkbox" name="active"' + (promo.active ? ' checked' : '') +
        '><span>Промокод активен</span></label></form>',
      footer: '<button class="btn" data-close>Отмена</button>' +
        '<button class="btn btn--primary" data-promo-save>Сохранить</button>'
    });
    admin.onPromoModal = instance;
  }
  /* --------------------------- Панель «ИИ и настройки» ------------------- */
  /** Админу достаточно вставить ключ: модель выбирается и проверяется автоматически. */
  function renderAiSettings() {
    var ai = db.aiSettings();
    var info = BS.ai.diagnostics();
    var settings = db.settings();
    var models = BS.ai.modelOptions();
    var aiEvents = db.events({ types: ['ai_request', 'ai_build', 'chat'], limit: 1000 });
    var tokens = U.sum(aiEvents, function (event) { return event.value; });
    var activeModel = info.activeModel ? BS.ai.shortModel(info.activeModel) : 'определяется автоматически';
    var modelRows = models.slice(0, 12).map(function (model) {
      var isActive = model.id === info.activeModel;
      var cooling = info.cooldown.filter(function (item) { return item.model === model.id; })[0];
      return '<div class="log-row"><span class="log-row__icon">' +
        BS.icon(isActive ? 'check-circle' : 'cpu', { size: 14 }) + '</span>' +
        '<span class="grow small">' + U.esc(model.name) +
        '<br><span class="muted mono">' + U.esc(model.id) + '</span></span>' +
        (isActive ? '<span class="badge badge--ok">активна</span>'
          : cooling ? '<span class="badge badge--warn">пауза до ' + U.date(cooling.until) + '</span>'
            : '<span class="badge">в резерве</span>') +
        '</div>';
    }).join('');

    return '<div class="dash-grid">' +
      '<div class="admin-card"><div class="panel-head"><h3>' + BS.icon('robot', { size: 20 }) +
      ' Искусственный интеллект (OpenRouter)</h3>' +
      '<span class="ai-badge' + (info.hasKey && info.activeModel ? '' : ' ai-badge--off') + '">' +
      BS.icon('robot', { size: 12 }) + ' ' + U.esc(activeModel) + '</span></div>' +
      '<div class="alert alert--info"><span class="alert__icon">🔑</span><div class="alert__body">' +
      '<strong>Нужен только API-ключ</strong>' +
      '<p>Вставьте ключ и нажмите «Сохранить»: ByteStore сам запросит список бесплатных моделей, ' +
      'проверит их реальным тестовым запросом, выберет первую рабочую и будет переключаться на следующую, ' +
      'если текущая перестанет отвечать. Вручную выбирать модель не нужно.</p></div></div>' +
      '<form data-admin-ai-form>' +
      '<div class="field"><label for="adAiKey">API-ключ OpenRouter</label>' +
      '<input class="input" id="adAiKey" name="apiKey" type="password" placeholder="sk-or-v1-…" value="' +
      U.attr(ai.apiKey) + '">' +
      '<span class="hint">Бесплатный ключ создаётся на openrouter.ai/keys и хранится только в базе магазина.</span>' +
      '</div>' +
      '<label class="switch mb-3"><input type="checkbox" name="enabled"' + (ai.enabled ? ' checked' : '') +
      '><span>ИИ включён для конфигуратора и чата</span></label>' +
      '<div class="btn-group mt-2">' +
      '<button class="btn btn--primary" type="submit">' + BS.icon('check', { size: 16 }) + 'Сохранить</button>' +
      '<button class="btn btn--outline" type="button" data-admin-ai-test>' +
      BS.icon('refresh', { size: 16 }) + 'Проверить модели сейчас</button>' +
      '</div></form>' +
      '<div data-admin-ai-result class="mt-4"></div>' +
      '<div class="panel-head mt-5"><h4>Состояние подключения</h4></div>' +
      '<div class="col gap-2 small">' +
      '<div class="between"><span>API-ключ</span><b class="' + (info.hasKey ? 'text-ok' : 'text-warn') + '">' +
      (info.hasKey ? 'установлен' : 'не задан') + '</b></div>' +
      '<div class="between"><span>Активная модель</span><b>' + U.esc(activeModel) + '</b></div>' +
      '<div class="between"><span>Модель проверена</span><b>' +
      (info.verifiedAt ? U.date(info.verifiedAt, true) + ' · ' + U.timeAgo(info.verifiedAt) : '—') +
      '</b></div>' +
      '<div class="between"><span>Бесплатных моделей найдено</span><b>' + U.num(info.freeCount) + '</b></div>' +
      '<div class="between"><span>Список обновлён</span><b>' +
      (info.lastSync ? U.date(info.lastSync, true) : '—') + '</b></div>' +
      '<div class="between"><span>Моделей в очереди переключения</span><b>' + U.num(info.candidates) + '</b></div>' +
      (info.lastError ? '<div class="between"><span>Последняя ошибка</span><b class="text-warn">' +
        U.esc(info.lastError) + '</b></div>' : '') +
      '</div>' +
      (modelRows ? '<div class="panel-head mt-5"><h4>Найденные бесплатные модели</h4>' +
        '<span class="muted small">переключение выполняется автоматически</span></div>' +
        '<div class="admin-log-panel">' + modelRows + '</div>' : '') +
      '</div>' +
      '<div class="admin-card"><h3>' + BS.icon('chart', { size: 20 }) + ' Использование ИИ</h3>' +
      '<div class="grid-2 mt-4">' +
      '<div><div class="muted small">Сборок в конфигураторе</div><b>' +
      U.num(db.events({ type: 'ai_build' }).length) + '</b></div>' +
      '<div><div class="muted small">Обращений в чат</div><b>' + U.num(db.events({ type: 'chat' }).length) +
      '</b></div>' +
      '<div><div class="muted small">Запросов к модели</div><b>' +
      U.num(db.events({ type: 'ai_request' }).length) + '</b></div>' +
      '<div><div class="muted small">Израсходовано токенов</div><b>' + U.num(tokens) + '</b></div>' +
      '</div>' +
      '<h4 class="mt-5">Параметры магазина</h4>' +
      '<div class="col gap-2 small">' +
      '<div class="between"><span>Стоимость доставки</span><b>' + U.money(settings.deliveryCost) + '</b></div>' +
      '<div class="between"><span>Бесплатно от</span><b>' + U.money(settings.freeDeliveryFrom) + '</b></div>' +
      '<div class="between"><span>Событий в журнале</span><b>' + U.num(db.events({}).length) + '</b></div>' +
      '<div class="between"><span>Товаров в каталоге</span><b>' + U.num(db.productsAll(true).length) + '</b></div>' +
      '</div>' +
      '<div class="settings-row mt-4"><div class="settings-row__text">' +
      '<b>Демонстрационные данные</b><span>Сбросить каталог, заказы и отзывы к исходному состоянию</span></div>' +
      '<button class="btn btn--outline btn--sm" data-admin-reset' + (BS.cloud ? ' disabled title="Общую базу нельзя сбросить к демо-данным"' : '') + '>Сбросить</button></div>' +
      '<div class="settings-row"><div class="settings-row__text">' +
      '<b>Полный экспорт базы</b><span>Выгрузка всей системы в JSON для отчёта по диплому</span></div>' +
      '<button class="btn btn--outline btn--sm" data-admin-export="json">Скачать JSON</button></div>' +
      '<div class="settings-row"><div class="settings-row__text">' +
      '<b>Смена пароля администратора</b><span>Текущий логин: ' + U.esc(db.state.admin.login) + '</span></div>' +
      '<button class="btn btn--outline btn--sm" data-admin-password>Изменить пароль</button></div>' +
      '</div>' +
      '</div>';
  }

  /* ------------------------------ Панель «Журнал» ------------------------ */
  function renderLog() {
    var audit = db.auditLog(80);
    var events = db.events({ limit: 40 });
    var types = {
      view: { label: 'Просмотр товара', icon: 'eye' },
      add_cart: { label: 'Добавление в корзину', icon: 'cart' },
      remove_cart: { label: 'Удаление из корзины', icon: 'trash' },
      purchase: { label: 'Покупка', icon: 'wallet' },
      login: { label: 'Вход пользователя', icon: 'user' },
      register: { label: 'Регистрация', icon: 'user' },
      ai_build: { label: 'ИИ-подбор сборки', icon: 'sparkles' },
      chat: { label: 'Сообщение в чат-бот', icon: 'robot' },
      chat_to_configurator: { label: 'Сборка из чата в конфигуратор', icon: 'tool' },
      ai_request: { label: 'Запрос к модели', icon: 'cpu' },
      review: { label: 'Новый отзыв', icon: 'thumbs-up' },
      favorite: { label: 'В избранное', icon: 'heart' },
      compare: { label: 'Добавлено к сравнению', icon: 'sliders' },
      newsletter: { label: 'Подписка на рассылку', icon: 'mail' }
    };
    return '<div class="dash-grid dash-grid--even">' +
      '<div class="admin-card"><div class="panel-head"><h3>' + BS.icon('list', { size: 20 }) +
      ' Действия администратора</h3><span class="muted small">' + audit.length + ' записей</span></div>' +
      '<div class="admin-log-panel">' + audit.map(function (entry) {
        return '<div class="log-row"><span class="log-row__icon">' + BS.icon('settings', { size: 14 }) +
          '</span><span class="grow small">' + U.esc(entry.action) + '<br><span class="muted">' +
          U.esc(entry.user) + '</span></span>' +
          '<span class="log-row__time">' + U.date(entry.ts, true) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="admin-card"><div class="panel-head"><h3>' + BS.icon('eye', { size: 20 }) +
      ' События покупателей</h3><span class="muted small">' + U.num(db.events({}).length) +
      ' всего</span></div>' +
      '<div class="admin-log-panel">' + events.map(function (event) {
        var meta = types[event.type] || { label: event.type, icon: 'info' };
        var product = event.productId ? db.product(event.productId) : null;
        return '<div class="log-row"><span class="log-row__icon">' + BS.icon(meta.icon, { size: 14 }) +
          '</span><span class="grow small">' + U.esc(meta.label) +
          (product ? '<br><span class="muted">' + U.esc(product.name.slice(0, 48)) + '</span>' : '') +
          '</span><span class="log-row__time">' + U.date(event.ts, true) + '</span></div>';
      }).join('') + '</div></div></div>';
  }
  /* --------------------------- Обработчики событий ------------------------ */
  function wireShell() {
    var layout = admin.layout;
    admin.afterRender = function () {
      if (ui.panel === 'dashboard') drawDashboardCharts();
      if (ui.panel === 'images') wirePhotoPreviews();
    };

    layout.addEventListener('click', async function (e) {
      var navBtn = e.target.closest('[data-admin-panel]');
      if (navBtn) {
        admin.show(navBtn.getAttribute('data-admin-panel'));
        layout.classList.remove('is-open');
        return;
      }
      if (e.target.closest('[data-admin-logout]')) {
        await db.adminLogout();
        L.toast('Сессия администратора завершена', 'info');
        renderLogin();
        return;
      }
      if (e.target.closest('[data-admin-refresh]')) {
        if (BS.cloud) await BS.cloud.refresh();
        admin.show(ui.panel);
        L.toast('Данные обновлены', 'info');
        return;
      }
      if (e.target.closest('[data-admin-burger]')) { layout.classList.toggle('is-open'); return; }
      var go = e.target.closest('[data-admin-go]');
      if (go) { admin.show(go.getAttribute('data-admin-go')); return; }
      if (e.target.closest('[data-photo-template]')) {
        U.download('bytestore-photo-links-' + U.isoDay(Date.now()) + '.csv', photoTemplateCsv(), 'text/csv;charset=utf-8');
        L.toastInfo('В таблице заполните image_url и загрузите файл сюда', 'Шаблон фотографий');
        return;
      }
      var photoSave = e.target.closest('[data-photo-save]');
      if (photoSave) {
        var photoProduct = db.product(photoSave.getAttribute('data-photo-save'));
        var photoInput = U.$$('[data-photo-url]', layout).filter(function (node) {
          return node.getAttribute('data-photo-url') === photoSave.getAttribute('data-photo-save');
        })[0];
        if (photoProduct && photoInput) savePhotoUrl(photoProduct, photoInput.value);
        return;
      }
      var photoClear = e.target.closest('[data-photo-clear]');
      if (photoClear) {
        var clearProduct = db.product(photoClear.getAttribute('data-photo-clear'));
        if (clearProduct) savePhotoUrl(clearProduct, '');
        return;
      }
      var exportBtn = e.target.closest('[data-admin-export]');
      if (exportBtn) { exportData(exportBtn.getAttribute('data-admin-export')); return; }
      if (e.target.closest('[data-admin-reset]')) {
        L.confirm('Сбросить все данные магазина к демонстрационным? Текущие товары, заказы и отзывы будут удалены.',
          { danger: true, confirmText: 'Сбросить данные' }).then(async function (yes) {
          if (!yes) return;
          db.resetDemo().then(async function () {
            L.toastOk('Демонстрационные данные восстановлены', 'Готово');
            renderShell();
          });
        });
        return;
      }
      if (e.target.closest('[data-admin-password]')) { openPasswordForm(); return; }

      /* Товары */
      if (e.target.closest('[data-product-new]')) { openProductForm(null); return; }
      var editProduct = e.target.closest('[data-product-edit]');
      if (editProduct) { openProductForm(db.product(editProduct.getAttribute('data-product-edit'))); return; }
      var copyProduct = e.target.closest('[data-product-copy]');
      if (copyProduct) {
        var copy = await db.duplicateProduct(copyProduct.getAttribute('data-product-copy'));
        if (copy) { L.toastOk('Создана копия: ' + copy.name, 'Товар дублирован'); admin.show('products'); }
        return;
      }
      var toggleProduct = e.target.closest('[data-product-toggle]');
      if (toggleProduct) {
        var target = db.product(toggleProduct.getAttribute('data-product-toggle'));
        await db.saveProduct(Object.assign({}, target, { status: target.status === 'hidden' ? 'active' : 'hidden' }));
        L.toast('Статус товара изменён', 'info');
        admin.show('products');
        return;
      }
      var deleteProduct = e.target.closest('[data-product-delete]');
      if (deleteProduct) {
        var product = db.product(deleteProduct.getAttribute('data-product-delete'));
        L.confirm('Удалить товар «' + product.name + '»? Отзывы о товаре тоже будут удалены.',
          { danger: true, confirmText: 'Удалить' }).then(async function (yes) {
          if (!yes) return;
          await db.deleteProduct(product.id);
          L.toastOk('Товар удалён из каталога', 'Готово');
          admin.show('products');
        });
        return;
      }

      /* Категории */
      if (e.target.closest('[data-category-new]')) { openCategoryForm(null); return; }
      var editCategory = e.target.closest('[data-category-edit]');
      if (editCategory) { openCategoryForm(db.category(editCategory.getAttribute('data-category-edit'))); return; }
      var deleteCategory = e.target.closest('[data-category-delete]');
      if (deleteCategory) {
        var category = db.category(deleteCategory.getAttribute('data-category-delete'));
        L.confirm('Удалить категорию «' + category.name + '»?', { danger: true, confirmText: 'Удалить' })
          .then(async function (yes) {
            if (!yes) return;
            var result = await db.deleteCategory(category.id);
            if (result.ok) { L.toastOk(result.message); admin.show('categories'); }
            else L.toastError(result.message);
          });
        return;
      }

      /* Заказы */
      var viewOrder = e.target.closest('[data-order-view]');
      if (viewOrder) { openOrderDetails(db.order(viewOrder.getAttribute('data-order-view'))); return; }
      var deleteOrder = e.target.closest('[data-order-delete]');
      if (deleteOrder) {
        var order = db.order(deleteOrder.getAttribute('data-order-delete'));
        L.confirm('Удалить заказ ' + order.number + ' из системы?', { danger: true, confirmText: 'Удалить' })
          .then(async function (yes) {
            if (!yes) return;
            await db.deleteOrder(order.id);
            L.toastOk('Заказ удалён', 'Готово');
            admin.show('orders');
          });
        return;
      }
      /* Промокоды */
      if (e.target.closest('[data-promo-new]')) { openPromoForm(null); return; }
      var editPromo = e.target.closest('[data-promo-edit]');
      if (editPromo) { openPromoForm(db.findPromo(editPromo.getAttribute('data-promo-edit'))); return; }
      var togglePromo = e.target.closest('[data-promo-toggle]');
      if (togglePromo) {
        var promo = db.findPromo(togglePromo.getAttribute('data-promo-toggle'));
        await db.savePromo(Object.assign({}, promo, { active: !promo.active, id: promo.code }));
        L.toast('Промокод ' + promo.code + (promo.active ? ' отключён' : ' активирован'), 'info');
        admin.show('promos');
        return;
      }
      var deletePromo = e.target.closest('[data-promo-delete]');
      if (deletePromo) {
        var promoCode = deletePromo.getAttribute('data-promo-delete');
        L.confirm('Удалить промокод ' + promoCode + '?', { danger: true, confirmText: 'Удалить' })
          .then(async function (yes) {
            if (!yes) return;
            await db.deletePromo(promoCode);
            L.toastOk('Промокод удалён', 'Готово');
            admin.show('promos');
          });
        return;
      }

      /* Отзывы */
      var reviewFilter = e.target.closest('[data-review-filter]');
      if (reviewFilter) {
        ui.reviewStatus = reviewFilter.getAttribute('data-review-filter');
        admin.show('reviews');
        return;
      }
      var publish = e.target.closest('[data-review-publish]');
      if (publish) {
        await db.setReviewStatus(publish.getAttribute('data-review-publish'), 'published');
        L.toastOk('Отзыв опубликован — рейтинг товара пересчитан', 'Модерация');
        admin.show('reviews');
        return;
      }
      var reject = e.target.closest('[data-review-reject]');
      if (reject) {
        await db.setReviewStatus(reject.getAttribute('data-review-reject'), 'rejected');
        L.toast('Отзыв скрыт с витрины', 'info');
        admin.show('reviews');
        return;
      }
      var reply = e.target.closest('[data-review-reply]');
      if (reply) {
        var reviewId = reply.getAttribute('data-review-reply');
        var review = db.review(reviewId);
        L.prompt({
          title: 'Ответ магазина',
          text: 'Ответ увидят все покупатели на странице товара.',
          value: review.reply || '',
          placeholder: 'Спасибо за отзыв! Уточните, пожалуйста…'
        }).then(async function (text) {
          if (text === null) return;
          await db.replyReview(reviewId, text);
          db.audit('Добавлен ответ магазина на отзыв ' + (review.author || 'гостя'), 'admin');
          db.save();
          L.toastOk('Ответ сохранён', 'Готово');
          admin.show('reviews');
        });
        return;
      }
      var editReview = e.target.closest('[data-review-edit]');
      if (editReview) { openReviewEditor(db.review(editReview.getAttribute('data-review-edit'))); return; }
      var deleteReview = e.target.closest('[data-review-delete]');
      if (deleteReview) {
        L.confirm('Удалить отзыв без возможности восстановления?', { danger: true, confirmText: 'Удалить' })
          .then(async function (yes) {
            if (!yes) return;
            await db.deleteReview(deleteReview.getAttribute('data-review-delete'));
            L.toastOk('Отзыв удалён', 'Готово');
            admin.show('reviews');
          });
        return;
      }

      /* Пользователи */
      var viewUser = e.target.closest('[data-user-view]');
      if (viewUser) { openUserCard(db.user(viewUser.getAttribute('data-user-view'))); return; }
      var blockUser = e.target.closest('[data-user-block]');
      if (blockUser) {
        var user = db.user(blockUser.getAttribute('data-user-block'));
        await db.setUserStatus(user.id, user.status === 'blocked' ? 'active' : 'blocked');
        L.toast('Пользователь ' + user.email +
          (user.status === 'blocked' ? ' заблокирован' : ' разблокирован'), 'info');
        admin.show('users');
        return;
      }
      var deleteUser = e.target.closest('[data-user-delete]');
      if (deleteUser) {
        var userTarget = db.user(deleteUser.getAttribute('data-user-delete'));
        L.confirm('Удалить аккаунт ' + userTarget.email + '? Заказы останутся в истории.',
          { danger: true, confirmText: 'Удалить' }).then(async function (yes) {
          if (!yes) return;
          await db.deleteUser(userTarget.id);
          L.toastOk('Аккаунт удалён', 'Готово');
          admin.show('users');
        });
      }
      /* Настройки ИИ: проверка соединения и синхронизация моделей */
      if (e.target.closest('[data-admin-ai-test]')) {
        var testBox = layout.querySelector('[data-admin-ai-result]');
        testBox.innerHTML = L.loading('Проверяю доступные бесплатные модели…');
        BS.ai.test().then(async function (result) {
          testBox.innerHTML = '<div class="alert alert--' + (result.ok ? 'ok' : 'warn') + '">' +
            '<span class="alert__icon">' + (result.ok ? '✅' : '⚠️') + '</span><div class="alert__body">' +
            '<strong>' + (result.ok ? 'Модель выбрана автоматически' : 'Рабочая модель не найдена') +
            '</strong><p>' + U.esc(result.message) + '</p>' +
            ((result.checked || []).length ? '<p class="small muted">Проверено: ' +
              result.checked.map(function (item) {
                return U.esc(BS.ai.shortModel(item.model)) + (item.ok ? ' ✓' : ' ✗');
              }).join(', ') + '</p>' : '') +
            '</div></div>';
          if (result.ok) L.toastOk('Активная модель: ' + BS.ai.shortModel(result.model), 'ИИ готов');
        });
        return;
      }
      /* Дальнейшие действия с модальными окнами обрабатываются в wireModalForms() */
    });
    wireModalForms();
  }

  /** Обработчики модальных окон и живых фильтров админки. */
  function wireModalForms() {
    var layout = admin.layout;
    document.addEventListener('click', async function (e) {
      if (e.target.closest('[data-spec-add]')) {
        var editor = U.$('[data-spec-editor]');
        if (editor) editor.insertAdjacentHTML('beforeend', specRow('', ''));
        return;
      }
      if (e.target.closest('[data-spec-remove]')) { e.target.closest('[data-spec-row]').remove(); return; }
      if (e.target.closest('[data-product-save]')) { saveProductForm(); return; }
      if (e.target.closest('[data-category-save]')) { saveCategoryForm(); return; }
      if (e.target.closest('[data-promo-save]')) { savePromoForm(); return; }
      if (e.target.closest('[data-order-save]')) {
        var saveOrderId = e.target.closest('[data-order-save]').getAttribute('data-order-save');
        var currentOrder = db.order(saveOrderId);
        var commentField = U.$('#ordComment');
        currentOrder.managerComment = commentField ? commentField.value : '';
        if (BS.cloud) await db.updateOrderComment(currentOrder.id, currentOrder.managerComment);
        db.audit('Комментарий к заказу ' + currentOrder.number, 'admin');
        db.save();
        L.toastOk('Комментарий сохранён');
        return;
      }
      if (e.target.closest('[data-order-cancel]')) {
        var cancelId = e.target.closest('[data-order-cancel]').getAttribute('data-order-cancel');
        L.confirm('Отменить заказ? Статус изменится на «Отменён».',
          { danger: true, confirmText: 'Отменить заказ' }).then(async function (yes) {
          if (!yes) return;
          await db.setOrderStatus(cancelId, 'cancelled', 'Отменён администратором');
          L.toast('Заказ отменён', 'info');
          admin.show('orders');
        });
      }
    });

    /* Живые фильтры и переключатели */
    layout.addEventListener('input', async function (e) {
      if (e.target.closest('[data-photo-search]')) {
        ui.photoQuery = e.target.value;
        var normalized = U.norm(ui.photoQuery);
        var visibleCount = 0;
        U.$$('[data-photo-card]', layout).forEach(function (card) {
          var matches = !normalized || card.getAttribute('data-photo-search-text').indexOf(normalized) !== -1;
          card.hidden = !matches;
          if (matches) visibleCount++;
        });
        var countLabel = layout.querySelector('[data-photo-count]');
        if (countLabel) countLabel.textContent = 'Показано: ' + visibleCount;
        return;
      }
      var photoUrlInput = e.target.closest('[data-photo-url]');
      if (photoUrlInput) {
        var card = photoUrlInput.closest('[data-photo-card]');
        var preview = card && card.querySelector('.admin-photo-card__preview');
        var url = photoUrlInput.value.trim();
        if (preview && /^(https?:\/\/|\/(?!\/)|\.\/)/i.test(url)) {
          var image = document.createElement('img');
          image.src = url;
          image.alt = card.getAttribute('data-photo-name') || 'Фото товара';
          image.addEventListener('error', async function () {
            preview.innerHTML = '<span class="admin-photo-preview-fallback">Не удалось загрузить изображение</span>';
          }, { once: true });
          preview.replaceChildren(image);
        }
        return;
      }
      if (e.target.closest('[data-admin-product-search]')) {
        ui.productQuery = e.target.value;
        clearTimeout(admin.searchTimer);
        admin.searchTimer = setTimeout(function () { admin.show('products'); }, 350);
        return;
      }
      if (e.target.closest('[data-admin-order-search]')) {
        ui.orderQuery = e.target.value;
        clearTimeout(admin.searchTimer);
        admin.searchTimer = setTimeout(function () { admin.show('orders'); }, 350);
        return;
      }
      if (e.target.closest('[data-admin-user-search]')) {
        ui.userQuery = e.target.value;
        clearTimeout(admin.searchTimer);
        admin.searchTimer = setTimeout(function () { admin.show('users'); }, 350);
        return;
      }
      if (e.target.closest('[data-admin-ai-temp]')) {
        var tempLabel = layout.querySelector('[data-admin-ai-temp]');
        if (tempLabel) tempLabel.textContent = e.target.value;
      }
    });

    layout.addEventListener('change', async function (e) {
      if (e.target.closest('[data-admin-days]')) {
        ui.days = Number(e.target.value);
        admin.show(ui.panel);
        return;
      }
      if (e.target.closest('[data-admin-product-category]')) {
        ui.productCategory = e.target.value;
        admin.show('products');
        return;
      }
      if (e.target.closest('[data-photo-filter]')) {
        ui.photoFilter = e.target.value;
        admin.show('images');
        return;
      }
      var photoFile = e.target.closest('[data-photo-import]');
      if (photoFile && photoFile.files && photoFile.files[0]) {
        var reader = new FileReader();
        reader.onload = async function () {
          var result = await importPhotoCsv(reader.result);
          if (!result.updated) {
            L.toast('Ссылки не импортированы. Проверьте формат: артикул;ссылка', 'warn', 'CSV не изменён');
          } else {
            L.toastOk('Добавлено ссылок: ' + result.updated +
              (result.unknown ? ' · неизвестных артикулов: ' + result.unknown : '') +
              (result.invalid ? ' · некорректных строк: ' + result.invalid : ''), 'Фотографии обновлены');
          }
          admin.show('images');
        };
        reader.onerror = function () { L.toastError('Не удалось прочитать CSV-файл'); };
        reader.readAsText(photoFile.files[0]);
        photoFile.value = '';
        return;
      }
      var stock = e.target.closest('[data-stock-input]');
      if (stock) {
        await db.updateStock(stock.getAttribute('data-stock-input'), stock.value);
        L.toast('Остаток обновлён: ' + stock.value + ' шт.', 'info');
        return;
      }
      var status = e.target.closest('[data-order-status]');
      if (status) {
        await db.setOrderStatus(status.getAttribute('data-order-status'), status.value);
        L.toast('Статус заказа изменён: ' + db.ORDER_STATUS[status.value].label, 'ok');
      }
    });

    /* Формы: ключ ИИ, смена пароля */
    layout.addEventListener('submit', async function (e) {
      var aiForm = e.target.closest('[data-admin-ai-form]');
      if (aiForm) {
        e.preventDefault();
        var data = new FormData(aiForm);
        var apiKey = String(data.get('apiKey') || '').trim();
        await db.updateAiSettings({
          apiKey: apiKey,
          enabled: data.get('enabled') === 'on',
          verifiedAt: null,        // после смены ключа модель выбирается заново
          failedModels: {}
        });
        db.audit('Обновлён ключ OpenRouter — запущен автоподбор модели', 'admin');
        db.save();
        var resultBox = layout.querySelector('[data-admin-ai-result]');
        if (!apiKey) {
          if (resultBox) {
            resultBox.innerHTML = '<div class="alert alert--info"><span class="alert__icon">ℹ️</span>' +
              '<div class="alert__body"><strong>Ключ удалён</strong><p>Подбор конфигураций и чат работают ' +
              'на встроенном экспертном движке ByteStore.</p></div></div>';
          }
          L.toast('Ключ очищен — используется экспертный движок', 'info');
          return;
        }
        if (resultBox) resultBox.innerHTML = L.loading('Ключ сохранён. Ищу и проверяю бесплатные модели…');
        L.toast('Ключ сохранён, подбираю рабочую модель…', 'info', 'ByteStore AI');
        BS.ai.test().then(async function (result) {
          if (result.ok) L.toastOk('Модель выбрана: ' + BS.ai.shortModel(result.model), 'ИИ готов к работе');
          else L.toastError(result.message, 'Рабочая модель не найдена');
          admin.show('ai');
        });
      }
    });
  }
  /* ------------------------------ Сохранение форм ------------------------- */
  function closeModal() {
    var backdrop = U.$('.modal-backdrop');
    if (backdrop) backdrop.remove();
    document.body.classList.remove('is-locked');
  }

  async function saveProductForm() {
    var form = U.$('[data-product-form]');
    if (!form) return;
    var data = new FormData(form);
    var specs = {};
    U.$$('[data-spec-row]', form).forEach(function (row) {
      var key = row.querySelector('[data-spec-key]').value.trim();
      var value = row.querySelector('[data-spec-value]').value.trim();
      if (!key) return;
      specs[key] = /^-?\d+([.,]\d+)?$/.test(value) ? Number(value.replace(',', '.'))
        : value === 'true' ? true : value === 'false' ? false : value;
    });
    var id = data.get('id');
    var result = await db.saveProduct(Object.assign({}, id ? db.product(id) : {}, {
      id: id || null,
      revision: id && db.product(id) ? db.product(id).revision : null,
      name: data.get('name'),
      categoryId: data.get('categoryId'),
      brand: data.get('brand'),
      price: Number(data.get('price')),
      oldPrice: Number(data.get('oldPrice')) || 0,
      cost: Number(data.get('cost')) || 0,
      stock: Number(data.get('stock')) || 0,
      sku: data.get('sku'),
      status: data.get('status'),
      image: data.get('image'),
      description: data.get('description'),
      key: String(data.get('key') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      badges: String(data.get('badges') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      specs: specs
    }));
    if (!result.ok) { L.toastError(result.message); return; }
    closeModal();
    L.toastOk(result.message, id ? 'Изменения сохранены' : 'Товар добавлен');
    admin.show('products');
  }

  async function saveCategoryForm() {
    var form = U.$('[data-category-form]');
    if (!form) return;
    var data = new FormData(form);
    var result = await db.saveCategory({
      id: data.get('id') || null,
      name: data.get('name'),
      emoji: data.get('emoji'),
      icon: data.get('icon'),
      color: data.get('color'),
      color2: data.get('color2'),
      slot: data.get('slot') || null,
      order: Number(data.get('order')) || 0,
      description: data.get('description')
    });
    if (!result.ok) { L.toastError(result.message); return; }
    closeModal();
    L.toastOk(result.message, 'Категория сохранена');
    renderShell();
  }

  async function savePromoForm() {
    var form = U.$('[data-promo-form]');
    if (!form) return;
    var data = new FormData(form);
    var result = await db.savePromo({
      id: data.get('code'),
      code: data.get('code'),
      type: data.get('type'),
      value: Number(data.get('value')),
      min: Number(data.get('min')) || 0,
      description: data.get('description'),
      active: data.get('active') === 'on'
    });
    if (!result.ok) { L.toastError(result.message); return; }
    closeModal();
    L.toastOk(result.message, 'Промокод сохранён');
    admin.show('promos');
  }
  /** Редактирование отзыва администратором (модерация контента). */
  function openReviewEditor(review) {
    if (!review) return;
    var instance = L.modal({
      title: 'Редактирование отзыва',
      html: '<form data-review-edit-form>' +
        '<div class="field"><label for="reRating">Оценка</label>' +
        '<select class="select" id="reRating" name="rating">' + [5, 4, 3, 2, 1].map(function (value) {
          return '<option value="' + value + '"' + (review.rating === value ? ' selected' : '') + '>' +
            value + ' из 5</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="reText">Текст отзыва</label>' +
        '<textarea class="textarea" id="reText" name="text" rows="5">' + U.esc(review.text) +
        '</textarea></div>' +
        '<div class="field"><label for="reReply">Ответ магазина</label>' +
        '<textarea class="textarea" id="reReply" name="reply" rows="3">' + U.esc(review.reply || '') +
        '</textarea></div></form>',
      footer: '<button class="btn" data-close>Отмена</button>' +
        '<button class="btn btn--primary" data-review-save="' + U.attr(review.id) + '">Сохранить</button>'
    });
    instance.el.addEventListener('click', async function (e) {
      if (!e.target.closest('[data-review-save]')) return;
      var form = instance.el.querySelector('[data-review-edit-form]');
      var data = new FormData(form);
      await db.updateReview(review.id, {
        rating: Number(data.get('rating')),
        text: String(data.get('text')).trim(),
        reply: String(data.get('reply') || '').trim()
      });
      db.audit('Отредактирован отзыв ' + (review.author || 'гостя'), 'admin');
      db.save();
      instance.close();
      L.toastOk('Отзыв обновлён', 'Готово');
      admin.show('reviews');
    });
  }

  /** Смена пароля администратора. */
  function openPasswordForm() {
    var instance = L.modal({
      title: 'Смена пароля администратора',
      size: 'narrow',
      html: '<form data-admin-password-form>' +
        '<div class="field"><label for="apCurrent">Текущий пароль</label>' +
        '<input class="input" id="apCurrent" name="current" type="password" required></div>' +
        '<div class="field"><label for="apNext">Новый пароль</label>' +
        '<input class="input" id="apNext" name="next" type="password" required></div>' +
        '<div class="field"><label for="apNext2">Повторите новый пароль</label>' +
        '<input class="input" id="apNext2" name="next2" type="password" required></div>' +
        '<p class="muted small">Пароль хранится в виде соли и SHA-256 хеша. ' +
        'Для защиты проекта по умолчанию используется Admin / 1234.</p></form>',
      footer: '<button class="btn" data-close>Отмена</button>' +
        '<button class="btn btn--primary" data-password-save>Обновить пароль</button>'
    });
    instance.el.addEventListener('click', async function (e) {
      if (!e.target.closest('[data-password-save]')) return;
      var form = instance.el.querySelector('[data-admin-password-form]');
      var data = new FormData(form);
      if (data.get('next') !== data.get('next2')) { L.toast('Новые пароли не совпадают', 'warn'); return; }
      db.changeAdminPassword(data.get('current'), data.get('next')).then(async function (result) {
        if (!result.ok) { L.toastError(result.message); return; }
        instance.close();
        L.toastOk(result.message, 'Безопасность');
      });
    });
  }
  /** Выгрузка данных: CSV по сущностям либо полный дамп базы в JSON. */
  function exportData(kind) {
    var stamp = U.isoDay(Date.now());
    if (kind === 'products') {
      U.download('bytestore-products-' + stamp + '.csv', U.toCsv(db.productsAll(true).map(function (product) {
        return {
          id: product.id, sku: product.sku, name: product.name,
          category: (db.category(product.categoryId) || {}).name,
          brand: product.brand, price: product.price, oldPrice: product.oldPrice || '',
          cost: product.cost || '', stock: product.stock, sales: product.sales,
          rating: product.rating, reviews: product.reviews, status: product.status
        };
      })));
      L.toastOk('Товары выгружены в CSV', 'Экспорт');
      return;
    }
    if (kind === 'orders') {
      U.download('bytestore-orders-' + stamp + '.csv', U.toCsv(db.orders({}).map(function (order) {
        return {
          number: order.number, date: U.date(order.createdAt, true),
          customer: order.customer.name, phone: order.customer.phone, email: order.customer.email,
          city: order.city, items: order.items.length, subtotal: order.subtotal,
          discount: order.discount, delivery: order.deliveryCost, total: order.total,
          status: (db.ORDER_STATUS[order.status] || {}).label, payment: order.payment,
          source: order.source || ''
        };
      })));
      L.toastOk('Заказы выгружены в CSV', 'Экспорт');
      return;
    }
    if (kind === 'users') {
      U.download('bytestore-users-' + stamp + '.csv', U.toCsv(db.users({}).map(function (user) {
        var stats = db.userStats(user.id);
        return {
          id: user.id, name: user.name, email: user.email, phone: user.phone,
          orders: stats.orders, spent: stats.spent, bonuses: user.bonus || 0,
          status: user.status, registered: U.date(user.createdAt)
        };
      })));
      L.toastOk('Клиенты выгружены в CSV', 'Экспорт');
      return;
    }
    if (kind === 'reviews') {
      U.download('bytestore-reviews-' + stamp + '.csv', U.toCsv(db.reviews({}).map(function (review) {
        return {
          id: review.id, product: review.productName, author: review.author,
          rating: review.rating, status: review.status, text: review.text,
          reply: review.reply || '', date: U.date(review.createdAt)
        };
      })));
      L.toastOk('Отзывы выгружены в CSV', 'Экспорт');
      return;
    }
    var dump = {
      exportedAt: new Date().toISOString(),
      version: U.APP.version,
      totals: db.analytics(90),
      categories: db.categories(),
      products: db.productsAll(true),
      users: db.all('users').map(function (user) {
        return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
      }),
      orders: db.orders({}).slice(0, 300),
      reviews: db.all('reviews'),
      promos: db.promos(false)
    };
    U.download('bytestore-database-' + stamp + '.json', JSON.stringify(dump, null, 2), 'application/json');
    L.toastOk('База выгружена в JSON', 'Экспорт');
  }
})();
