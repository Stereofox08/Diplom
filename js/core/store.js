/* ==========================================================================
   ByteStore — Слой данных и бизнес-логика (BS.db)
   Реализует «репозиторий» магазина поверх localStorage: товары, категории,
   пользователи, корзина, избранное, отзывы, заказы, промокоды, события и
   аналитика. Все страницы работают только через этот модуль, поэтому его
   легко заменить на обращения к REST API (см. README).
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util;
  var db = (BS.db = {});

  var STORAGE_KEY = 'db';
  var SCHEMA_VERSION = 1;
  var SESSION_KEY = 'session';
  var ADMIN_SESSION_KEY = 'admin-session';
  var EVENT_LIMIT = 4000;
  var ORDER_STEPS = ['new', 'processing', 'shipped', 'delivered'];

  db.SESSION_KEY = SESSION_KEY;
  db.ADMIN_SESSION_KEY = ADMIN_SESSION_KEY;
  db.ORDER_STEPS = ORDER_STEPS;
  db.ORDER_STATUS = {
    new: { label: 'Новый', cls: 'info', icon: 'bell' },
    processing: { label: 'Комплектуется', cls: 'warn', icon: 'package' },
    shipped: { label: 'В доставке', cls: 'accent', icon: 'truck' },
    delivered: { label: 'Получен', cls: 'ok', icon: 'check-circle' },
    cancelled: { label: 'Отменён', cls: 'danger', icon: 'x-circle' }
  };

  /* ------------------------- Начальное состояние -------------------------- */
  function defaultSettings() {
    return {
      siteName: 'ByteStore',
      currency: '₸',
      deliveryCost: U.APP.deliveryCost,
      freeDeliveryFrom: U.APP.freeDeliveryFrom,
      ai: {
        enabled: true,
        provider: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        model: '',              // заполняется автоматически после проверки моделей
        contextLength: 0,
        verifiedAt: null,       // когда модель проверена в последний раз
        failedModels: {},       // модель -> время «остывания»
        lastError: null,
        autoSelect: true,       // включён автоматический выбор модели
        temperature: 0.4,
        maxTokens: 1200,
        systemPrompt: '',
        useFallback: true,
        lastSync: null,
        freeModels: []
      },
      theme: 'dark',
      recommendations: true,
      maintenance: false
    };
  }

  db.state = null;
  db.ready = null;

  function daysAgo(d) { return Date.now() - d * 86400000; }

  /** Преобразование компактной записи seed.rawProducts в объект товара. */
  function expandProduct(raw) {
    return {
      id: raw[0], name: raw[1], categoryId: raw[2], brand: raw[3],
      price: raw[4], oldPrice: raw[5], cost: raw[6], stock: raw[7],
      rating: raw[8], reviews: raw[9], sales: raw[10],
      badges: raw[11] || [], key: raw[12] || [], specs: raw[13] || {},
      description: raw[14] || '',
      sku: 'BS-' + String(raw[2]).slice(0, 3).toUpperCase() + '-' + raw[0].replace(/[^0-9a-z]/gi, '').slice(-4).toUpperCase(),
      image: '',
      status: 'active',
      views: Math.round((raw[10] || 0) * (2.4 + (raw[8] || 4) / 4)),
      createdAt: daysAgo(120 + (raw[0].length % 90)),
      updatedAt: null
    };
  }

  /* ------------------------------ Загрузка БД ----------------------------- */
  db.load = function () {
    var stored = U.storage.get(STORAGE_KEY, null);
    if (!stored || stored.version !== SCHEMA_VERSION || !stored.products) return null;
    return stored;
  };

  db.save = function () {
    if (!db.state) return false;
    return U.storage.set(STORAGE_KEY, db.state);
  };

  /** Инициализация: чтение существующей БД или генерация демо-данных. */
  db.init = function (force) {
    if (db.ready && !force) return db.ready;
    db.ready = (function () {
      var existing = force ? null : db.load();
      if (existing) {
        db.state = existing;
        if (!db.state.visits) db.state.visits = BS.seed.makeVisits(89, 132, 5150);
        return Promise.resolve(db.state);
      }
      return db.seed().then(function (state) {
        db.state = state;
        db.save();
        return state;
      });
    })();
    return db.ready;
  };

  /** Полный сброс магазина к демонстрационным данным. */
  db.resetDemo = function () {
    U.storage.clearAll();
    db.ready = null;
    return db.init(true);
  };
  /** Формирование демонстрационной базы с нуля. */
  db.seed = function () {
    var products = BS.seed.rawProducts.map(expandProduct);
    var categories = U.deepClone(BS.seed.categories);
    var users = BS.seed.demoUsers.map(function (u, i) {
      return {
        id: u.id, name: u.name, email: u.email, phone: u.phone,
        role: 'user', bonus: 0, status: 'active',
        createdAt: daysAgo(200 - i * 12), lastLogin: daysAgo(i * 2)
      };
    });
    var reviews = BS.seed.demoReviews.map(function (r, i) {
      var product = products.filter(function (p) { return p.id === r.productId; })[0];
      var user = users.filter(function (u) { return u.id === r.userId; })[0];
      return {
        id: 'rev-demo-' + i, productId: r.productId,
        productName: product ? product.name : '',
        categoryId: product ? product.categoryId : '',
        userId: r.userId || null, author: r.author,
        email: user ? user.email : '',
        rating: r.rating, text: r.text, pros: '', cons: '',
        status: r.status, likes: r.likes || 0, verified: !!user,
        reply: r.reply || '', replyAt: r.reply ? daysAgo(Math.max(r.daysAgo - 1, 0)) : null,
        createdAt: daysAgo(r.daysAgo)
      };
    });
    var orders = BS.seed.makeOrders(products, users, { days: 90, count: 210 });
    var pending = reviews.filter(function (r) { return r.status !== 'published'; }).length;
    /* Синтетические события просмотров и добавлений в корзину (воронка) */
    var events = [], rnd = U.rng(4242);
    products.forEach(function (p) {
      var views = Math.min(Math.max(12, Math.round((p.views || 0) * 0.35)), 40);
      var i;
      for (i = 0; i < views; i++) {
        events.push({ id: U.uid('ev'), type: 'view', productId: p.id, categoryId: p.categoryId, value: 0, ts: daysAgo(Math.floor(rnd() * 90)) });
      }
      var carts = Math.min(Math.round(views * (0.10 + rnd() * 0.12)), 14);
      for (i = 0; i < carts; i++) {
        events.push({ id: U.uid('ev'), type: 'add_cart', productId: p.id, categoryId: p.categoryId, value: p.price, ts: daysAgo(Math.floor(rnd() * 90)) });
      }
    });
    events.sort(function (a, b) { return a.ts - b.ts; });
    var state = {
      version: SCHEMA_VERSION,
      createdAt: Date.now(),
      categories: categories,
      products: products,
      users: users,
      reviews: reviews,
      orders: orders,
      promos: U.deepClone(BS.seed.promos),
      carts: {},
      favorites: {},
      events: events,
      visits: BS.seed.makeVisits(89, 132, 5150),
      admin: { login: 'Admin', passHash: '', salt: '', failedAttempts: 0, lockedUntil: 0, lastLogin: null },
      settings: defaultSettings(),
      audit: [
        { id: U.uid('log'), action: 'База данных инициализирована демонстрационными данными', user: 'system', ts: Date.now() },
        { id: U.uid('log'), action: 'Загружено ' + products.length + ' товаров в ' + categories.length + ' категориях', user: 'system', ts: Date.now() },
        { id: U.uid('log'), action: 'Сгенерировано ' + orders.length + ' заказов за 90 дней', user: 'system', ts: Date.now() },
        { id: U.uid('log'), action: 'Отзывов ожидают модерации: ' + pending, user: 'system', ts: Date.now() }
      ]
    };
    /* Пароли демо-пользователей и администратора хешируются (SHA-256 + соль) */
    var tasks = users.map(function (user, idx) {
      user.salt = U.salt();
      return U.hashPassword(BS.seed.demoUsers[idx].password, user.salt).then(function (hash) {
        user.passHash = hash;
      });
    });
    state.admin.salt = U.salt();
    tasks.push(U.hashPassword('1234', state.admin.salt).then(function (hash) { state.admin.passHash = hash; }));
    return Promise.all(tasks).then(function () {
      state.products.forEach(function (p) {
        var list = reviews.filter(function (r) { return r.productId === p.id && r.status === 'published'; });
        if (!list.length) return;
        var sum = list.reduce(function (acc, r) { return acc + r.rating; }, 0);
        p.rating = Math.round((sum / list.length) * 10) / 10;
        p.reviews = list.length;
      });
      return state;
    });
  };

  /* --------------------------- Справочники -------------------------------- */
  db.all = function (collection) { return (db.state && db.state[collection]) || []; };
  db.categories = function () {
    return db.all('categories').slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  };
  db.category = function (id) {
    return db.all('categories').filter(function (c) { return c.id === id; })[0] || null;
  };
  db.categoryBySlot = function (slot) {
    return db.all('categories').filter(function (c) { return c.slot === slot; })[0] || null;
  };
  db.slotCategories = function () {
    return db.categories().filter(function (c) { return !!c.slot; });
  };
  db.productsAll = function (includeHidden) {
    return db.all('products').filter(function (p) { return includeHidden || p.status !== 'hidden'; });
  };
  db.product = function (id) {
    return db.all('products').filter(function (p) { return p.id === id; })[0] || null;
  };
  db.productsByIds = function (ids) { return (ids || []).map(db.product).filter(Boolean); };
  db.byCategory = function (categoryId, limit) {
    var list = db.productsAll().filter(function (p) { return p.categoryId === categoryId; });
    return limit ? list.slice(0, limit) : list;
  };
  db.inStock = function (p) { return !!(p && p.stock > 0); };
  db.discountOf = function (p) {
    if (!p || !p.oldPrice || p.oldPrice <= p.price) return 0;
    return Math.round((1 - p.price / p.oldPrice) * 100);
  };
  db.brands = function () {
    var set = {};
    db.productsAll().forEach(function (p) { set[p.brand] = (set[p.brand] || 0) + 1; });
    return Object.keys(set).sort().map(function (b) { return { value: b, count: set[b] }; });
  };
  /** «Витрина»: рекомендации для главной страницы и блока «с этим берут». */
  db.recommended = function (limit) {
    return db.productsAll().slice().sort(function (a, b) {
      return (b.sales * 0.6 + (b.rating || 0) * 40 + db.discountOf(b) * 8) -
             (a.sales * 0.6 + (a.rating || 0) * 40 + db.discountOf(a) * 8);
    }).slice(0, limit || 8);
  };
  db.newArrivals = function (limit) {
    return db.productsAll().slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, limit || 4);
  };

  /* ------------------------------- Поиск ---------------------------------- */
  /** Оценка релевантности товара запросу (0 — товар не подходит). */
  db.score = function (product, terms) {
    if (!terms || !terms.length) return 1;
    var name = U.norm(product.name);
    var brand = U.norm(product.brand);
    var cat = db.category(product.categoryId);
    var hay = U.norm([
      product.name, product.brand, product.sku,
      (product.key || []).join(' '),
      Object.keys(product.specs || {}).map(function (k) { return k + ' ' + product.specs[k]; }).join(' '),
      cat ? cat.name : ''
    ].join(' '));
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (name.indexOf(t) !== -1) score += 6;
      else if (brand.indexOf(t) !== -1) score += 4;
      else if (hay.indexOf(t) !== -1) score += 2;
      else return 0;
    }
    score += Math.min(product.sales / 60, 5) + (product.rating || 0) / 2;
    return score;
  };

  /** Поиск товаров по релевантности. */
  db.searchProducts = function (query, limit) {
    var terms = U.terms(query);
    var list = db.productsAll().map(function (p) {
      return { product: p, score: db.score(p, terms) };
    }).filter(function (row) { return row.score > 0; });
    list.sort(function (a, b) { return b.score - a.score; });
    var result = list.map(function (row) { return row.product; });
    return limit ? result.slice(0, limit) : result;
  };
  /* ------------------------ Каталог с фильтрами --------------------------- */
  var SORTS = {
    popular: { label: 'Популярные', fn: function (a, b) { return b.sales - a.sales; } },
    'price-asc': { label: 'Сначала дешёвые', fn: function (a, b) { return a.price - b.price; } },
    'price-desc': { label: 'Сначала дорогие', fn: function (a, b) { return b.price - a.price; } },
    rating: { label: 'По рейтингу', fn: function (a, b) { return (b.rating || 0) - (a.rating || 0); } },
    new: { label: 'Сначала новые', fn: function (a, b) { return b.createdAt - a.createdAt; } },
    discount: { label: 'По размеру скидки', fn: function (a, b) { return db.discountOf(b) - db.discountOf(a); } },
    perf: { label: 'По производительности', fn: function (a, b) { return (b.specs.score || 0) - (a.specs.score || 0); } }
  };
  db.SORTS = SORTS;

  /**
   * Выборка товаров каталога с фильтрами, сортировкой и пагинацией.
   * @param {{q:string,category:string,brands:string[],min:number,max:number,
   *          inStock:boolean,sort:string,page:number,perPage:number,
   *          onlyDiscount:boolean,badge:string}} filter
   */
  db.query = function (filter) {
    filter = filter || {};
    var terms = U.terms(filter.q || '');
    var ranks = {};
    var list = db.productsAll().filter(function (p) {
      var sc = db.score(p, terms);
      ranks[p.id] = sc;
      return sc > 0;
    });

    if (filter.category) list = list.filter(function (p) { return p.categoryId === filter.category; });
    if (filter.brands && filter.brands.length) list = list.filter(function (p) { return filter.brands.indexOf(p.brand) !== -1; });
    if (filter.brand) list = list.filter(function (p) { return p.brand === filter.brand; });
    if (filter.min) list = list.filter(function (p) { return p.price >= Number(filter.min); });
    if (filter.max) list = list.filter(function (p) { return p.price <= Number(filter.max); });
    if (filter.inStock) list = list.filter(db.inStock);
    if (filter.onlyDiscount) list = list.filter(function (p) { return db.discountOf(p) > 0; });
    if (filter.badge) list = list.filter(function (p) { return (p.badges || []).indexOf(filter.badge) !== -1; });

    var sortKey = filter.sort || (terms.length ? 'relevance' : 'popular');
    if (sortKey === 'relevance' && terms.length) {
      list.sort(function (a, b) { return (ranks[b.id] - ranks[a.id]) || (b.sales - a.sales); });
    } else {
      list.sort((SORTS[sortKey] || SORTS.popular).fn);
    }

    var total = list.length;
    var perPage = Number(filter.perPage) || 12;
    var pages = Math.max(1, Math.ceil(total / perPage));
    var page = Math.max(1, Math.min(Number(filter.page) || 1, pages));
    var start = (page - 1) * perPage;
    return {
      items: list.slice(start, start + perPage),
      all: list, total: total, page: page, pages: pages, perPage: perPage
    };
  };

  /** Фасеты для сайдбара фильтров (бренды, категории, диапазон цен). */
  db.facets = function (filter) {
    filter = filter || {};
    var base = db.query({ q: filter.q, category: filter.category });
    var brandCounts = {}, priceMin = Infinity, priceMax = 0;
    base.all.forEach(function (p) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
      priceMin = Math.min(priceMin, p.price);
      priceMax = Math.max(priceMax, p.price);
    });
    var catCounts = {};
    db.productsAll().forEach(function (p) { catCounts[p.categoryId] = (catCounts[p.categoryId] || 0) + 1; });
    return {
      brands: Object.keys(brandCounts).sort().map(function (b) { return { value: b, count: brandCounts[b] }; }),
      categories: db.categories().map(function (c) {
        return { value: c.id, name: c.name, icon: c.icon, emoji: c.emoji, count: catCounts[c.id] || 0 };
      }),
      priceMin: priceMin === Infinity ? 0 : priceMin,
      priceMax: priceMax || 100000,
      total: base.total
    };
  };

  /** Похожие товары: сначала из той же категории, затем близкие по цене. */
  db.similar = function (productId, limit) {
    var product = db.product(productId);
    if (!product) return [];
    var same = db.productsAll().filter(function (p) {
      return p.categoryId === product.categoryId && p.id !== product.id;
    }).sort(function (a, b) {
      return Math.abs(a.price - product.price) - Math.abs(b.price - product.price);
    });
    var others = db.productsAll().filter(function (p) {
      return p.categoryId !== product.categoryId && Math.abs(p.price - product.price) / product.price < 0.35;
    }).sort(function (a, b) { return b.sales - a.sales; });
    return same.concat(others).slice(0, limit || 4);
  };
  /* ------------------------------- Корзина -------------------------------- */
  /** Владелец корзины: id пользователя либо 'guest' (для гостей). */
  db.cartOwner = function () {
    var session = U.storage.get(SESSION_KEY, null);
    return session && session.userId ? session.userId : 'guest';
  };
  db.cart = function (owner) {
    var key = owner || db.cartOwner();
    return (db.state.carts[key] = db.state.carts[key] || []);
  };
  db.cartCount = function (owner) {
    return U.sum(db.cart(owner), function (i) { return i.qty; });
  };
  db.addToCart = function (productId, qty, owner) {
    var product = db.product(productId);
    if (!product) return { ok: false, message: 'Товар не найден' };
    if (product.stock <= 0) return { ok: false, message: 'Товара нет в наличии' };
    var cart = db.cart(owner);
    var line = cart.filter(function (i) { return i.productId === productId; })[0];
    var amount = Math.max(1, Number(qty) || 1);
    if (line) line.qty = Math.min(line.qty + amount, product.stock);
    else cart.push({ productId: productId, qty: Math.min(amount, product.stock), addedAt: Date.now() });
    db.track('add_cart', { productId: productId, categoryId: product.categoryId, value: product.price * amount });
    db.save();
    return { ok: true, message: product.name + ' — добавлен в корзину', product: product };
  };
  db.setCartQty = function (productId, qty, owner) {
    var line = db.cart(owner).filter(function (i) { return i.productId === productId; })[0];
    var product = db.product(productId);
    if (!line || !product) return false;
    line.qty = Math.max(1, Math.min(Number(qty) || 1, product.stock || 99));
    db.save();
    return true;
  };
  db.removeFromCart = function (productId, owner) {
    var key = owner || db.cartOwner();
    var cart = db.cart(key);
    if (cart.filter(function (i) { return i.productId === productId; }).length) {
      db.track('remove_cart', { productId: productId });
    }
    db.state.carts[key] = cart.filter(function (i) { return i.productId !== productId; });
    db.save();
    return true;
  };
  db.clearCart = function (owner) {
    db.state.carts[owner || db.cartOwner()] = [];
    db.save();
    return true;
  };
  db.cartLines = function (owner) {
    return db.cart(owner).map(function (line) {
      var product = db.product(line.productId);
      if (!product) return null;
      return {
        product: product, qty: line.qty, price: product.price,
        sum: product.price * line.qty,
        oldSum: (product.oldPrice || product.price) * line.qty
      };
    }).filter(Boolean);
  };
  /** Итоги корзины: сумма, скидка по промокоду, доставка и итог. */
  db.cartTotals = function (owner, promo) {
    var lines = db.cartLines(owner);
    var subtotal = U.sum(lines, function (l) { return l.sum; });
    var discount = 0;
    if (promo && subtotal >= (promo.min || 0)) {
      discount = promo.type === 'percent'
        ? Math.round(subtotal * promo.value / 100)
        : Math.min(promo.value, subtotal);
    }
    var settings = db.settings();
    var delivery = (subtotal - discount) >= settings.freeDeliveryFrom || !subtotal ? 0 : settings.deliveryCost;
    return {
      lines: lines,
      count: U.sum(lines, function (l) { return l.qty; }),
      subtotal: subtotal,
      oldSubtotal: U.sum(lines, function (l) { return l.oldSum; }),
      discount: discount,
      delivery: delivery,
      total: Math.max(subtotal - discount + delivery, 0),
      freeDeliveryLeft: Math.max(settings.freeDeliveryFrom - subtotal, 0)
    };
  };
  /** Перенос корзины гостя в аккаунт после входа. */
  db.transferCart = function (fromOwner, toOwner) {
    if (!fromOwner || !toOwner || fromOwner === toOwner) return;
    var source = db.cart(fromOwner), target = db.cart(toOwner);
    source.forEach(function (line) {
      var exist = target.filter(function (i) { return i.productId === line.productId; })[0];
      if (exist) exist.qty += line.qty;
      else target.push(line);
    });
    db.state.carts[fromOwner] = [];
    db.save();
  };

  /* --------------------- Избранное и сравнение ---------------------------- */
  db.favorites = function (owner) {
    var key = owner || db.cartOwner();
    return (db.state.favorites[key] = db.state.favorites[key] || []);
  };
  db.isFavorite = function (productId, owner) {
    return db.favorites(owner).indexOf(productId) !== -1;
  };
  db.toggleFavorite = function (productId, owner) {
    var key = owner || db.cartOwner();
    var list = db.favorites(key);
    var idx = list.indexOf(productId);
    if (idx === -1) { list.push(productId); db.track('favorite', { productId: productId }); }
    else list.splice(idx, 1);
    db.state.favorites[key] = list;
    db.save();
    return idx === -1;
  };
  db.favoriteProducts = function (owner) { return db.productsByIds(db.favorites(owner)); };

  /* Сравнение товаров живёт в памяти (не требует сохранения между заходами) */
  var compare = [];
  db.compare = {
    list: function () { return compare.slice(); },
    has: function (id) { return compare.indexOf(id) !== -1; },
    count: function () { return compare.length; },
    toggle: function (id) {
      var idx = compare.indexOf(id);
      if (idx === -1) {
        if (compare.length >= 4) return { ok: false, message: 'Можно сравнить не более 4 товаров' };
        compare.push(id);
        db.track('compare', { productId: id });
        return { ok: true, message: 'Товар добавлен к сравнению' };
      }
      compare.splice(idx, 1);
      return { ok: true, message: 'Товар убран из сравнения' };
    },
    remove: function (id) {
      compare = compare.filter(function (x) { return x !== id; });
    },
    clear: function () { compare = []; },
    products: function () { return db.productsByIds(compare); }
  };
  /* -------------------------------- Отзывы -------------------------------- */
  db.reviews = function (filter) {
    filter = filter || {};
    var list = db.all('reviews').slice();
    if (filter.productId) list = list.filter(function (r) { return r.productId === filter.productId; });
    if (filter.status) list = list.filter(function (r) { return r.status === filter.status; });
    if (filter.statuses) list = list.filter(function (r) { return filter.statuses.indexOf(r.status) !== -1; });
    if (filter.categoryId) list = list.filter(function (r) { return r.categoryId === filter.categoryId; });
    if (filter.rating) list = list.filter(function (r) { return r.rating === Number(filter.rating); });
    if (filter.q) {
      var terms = U.terms(filter.q);
      list = list.filter(function (r) {
        var hay = U.norm(r.text + ' ' + r.author + ' ' + (r.productName || ''));
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    var sort = filter.sort || 'new';
    list.sort(function (a, b) {
      if (sort === 'old') return a.createdAt - b.createdAt;
      if (sort === 'high') return b.rating - a.rating;
      if (sort === 'low') return a.rating - b.rating;
      if (sort === 'likes') return (b.likes || 0) - (a.likes || 0);
      return b.createdAt - a.createdAt;
    });
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  };
  db.review = function (id) {
    return db.all('reviews').filter(function (r) { return r.id === id; })[0] || null;
  };
  db.pendingReviewsCount = function () {
    return db.all('reviews').filter(function (r) { return r.status === 'pending'; }).length;
  };
  /** Сводка рейтинга товара: средний балл и распределение по звёздам. */
  db.ratingStats = function (productId) {
    var list = db.reviews({ productId: productId, status: 'published' });
    var dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    list.forEach(function (r) { dist[r.rating] = (dist[r.rating] || 0) + 1; });
    var avg = list.length ? U.sum(list, function (r) { return r.rating; }) / list.length : 0;
    return {
      count: list.length,
      average: Math.round(avg * 10) / 10,
      distribution: dist,
      recommended: list.length
        ? Math.round(list.filter(function (r) { return r.rating >= 4; }).length / list.length * 100) : 0
    };
  };
  /** Пересчёт среднего рейтинга и количества отзывов товара. */
  db.recalcProductRating = function (productId) {
    var product = db.product(productId);
    if (!product) return;
    var list = db.reviews({ productId: productId, status: 'published' });
    product.reviews = list.length;
    product.rating = list.length ? Math.round(U.avg(list, function (r) { return r.rating; }) * 10) / 10 : 0;
  };
  /* ------------------------- Создание и модерация ------------------------- */
  db.addReview = function (data) {
    if (!data || !data.productId) return { ok: false, message: 'Не указан товар' };
    var rating = Math.min(5, Math.max(1, Number(data.rating) || 0));
    if (!rating) return { ok: false, message: 'Поставьте оценку от 1 до 5' };
    if (!data.text || String(data.text).trim().length < 10) {
      return { ok: false, message: 'Отзыв должен содержать не менее 10 символов' };
    }
    var product = db.product(data.productId);
    var existing = db.all('reviews').filter(function (r) {
      return r.productId === data.productId && data.userId && r.userId === data.userId;
    })[0];
    if (existing) return { ok: false, message: 'Вы уже оставляли отзыв на этот товар' };
    var autoPublish = db.settings().autoPublishReviews === true;
    var review = {
      id: U.uid('rev'), productId: data.productId,
      productName: product ? product.name : '',
      categoryId: product ? product.categoryId : '',
      userId: data.userId || null, author: data.author || 'Гость', email: data.email || '',
      rating: rating, text: String(data.text).trim(),
      pros: String(data.pros || '').trim(), cons: String(data.cons || '').trim(),
      status: autoPublish ? 'published' : 'pending',
      likes: 0, verified: !!data.userId, reply: '', replyAt: null, createdAt: Date.now()
    };
    db.state.reviews.unshift(review);
    db.track('review', { productId: data.productId, value: rating });
    db.audit('Новый отзыв на «' + review.productName + '»: ' + rating + '/5', review.author);
    db.recalcProductRating(data.productId);
    db.save();
    return {
      ok: true, review: review,
      message: autoPublish ? 'Спасибо! Отзыв опубликован' : 'Спасибо! Отзыв отправлен на модерацию'
    };
  };
  db.setReviewStatus = function (id, status) {
    var review = db.review(id);
    if (!review) return false;
    review.status = status;
    review.moderatedAt = Date.now();
    db.recalcProductRating(review.productId);
    db.audit('Отзыв «' + (review.author || 'гость') + '» → статус ' + status, 'admin');
    db.save();
    return true;
  };
  db.updateReview = function (id, patch) {
    var review = db.review(id);
    if (!review) return false;
    Object.keys(patch || {}).forEach(function (k) { review[k] = patch[k]; });
    db.recalcProductRating(review.productId);
    db.save();
    return true;
  };
  db.deleteReview = function (id) {
    var review = db.review(id);
    if (!review) return false;
    db.state.reviews = db.state.reviews.filter(function (r) { return r.id !== id; });
    db.recalcProductRating(review.productId);
    db.audit('Удалён отзыв «' + (review.author || 'гость') + '» на ' + review.productName, 'admin');
    db.save();
    return true;
  };
  db.replyReview = function (id, text) {
    var review = db.review(id);
    if (!review) return false;
    review.reply = String(text || '').trim();
    review.replyAt = review.reply ? Date.now() : null;
    db.save();
    return true;
  };
  db.likeReview = function (id) {
    var review = db.review(id);
    if (!review) return false;
    var liked = U.storage.get('liked-reviews', []);
    var idx = liked.indexOf(id);
    if (idx === -1) { review.likes = (review.likes || 0) + 1; liked.push(id); }
    else { review.likes = Math.max(0, (review.likes || 0) - 1); liked.splice(idx, 1); }
    U.storage.set('liked-reviews', liked);
    db.save();
    return { liked: idx === -1, likes: review.likes };
  };
  /* -------------------------------- Заказы -------------------------------- */
  db.order = function (id) {
    return db.all('orders').filter(function (o) { return o.id === id || o.number === id; })[0] || null;
  };
  db.orders = function (filter) {
    filter = filter || {};
    var list = db.all('orders').slice();
    if (filter.userId) list = list.filter(function (o) { return o.userId === filter.userId; });
    if (filter.status) list = list.filter(function (o) { return o.status === filter.status; });
    if (filter.statuses) list = list.filter(function (o) { return filter.statuses.indexOf(o.status) !== -1; });
    if (filter.from) list = list.filter(function (o) { return o.createdAt >= filter.from; });
    if (filter.to) list = list.filter(function (o) { return o.createdAt <= filter.to; });
    if (filter.q) {
      var terms = U.terms(filter.q);
      list = list.filter(function (o) {
        var hay = U.norm([o.number, o.customer.name, o.customer.email, o.customer.phone, o.city,
          o.items.map(function (i) { return i.name; }).join(' ')].join(' '));
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    list.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return filter.limit ? list.slice(0, filter.limit) : list;
  };
  /** Следующий номер заказа вида BS-24000. */
  db.nextOrderNumber = function () {
    var max = 24000;
    db.all('orders').forEach(function (o) {
      var n = parseInt(String(o.number || '').replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
    return 'BS-' + (max + 1);
  };
  /**
   * Оформление заказа из текущей корзины.
   * @param {{customer:{name,email,phone},city,address,deliveryType,payment,comment,promoCode,userId}} data
   */
  db.createOrder = function (data) {
    var totals = db.cartTotals(null, data.promo || null);
    if (!totals.lines.length) return { ok: false, message: 'Корзина пуста' };
    if (!data.customer || !data.customer.name || !data.customer.phone) {
      return { ok: false, message: 'Укажите имя и телефон получателя' };
    }
    var order = {
      id: U.uid('ord'),
      number: db.nextOrderNumber(),
      userId: data.userId || null,
      customer: {
        name: data.customer.name,
        email: data.customer.email || '',
        phone: data.customer.phone
      },
      city: data.city || '',
      address: data.address || '',
      items: totals.lines.map(function (l) {
        return {
          productId: l.product.id, name: l.product.name,
          categoryId: l.product.categoryId, price: l.price, qty: l.qty
        };
      }),
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryCost: totals.delivery,
      total: totals.total,
      promoCode: data.promoCode || '',
      payment: data.payment || 'Картой онлайн',
      deliveryType: data.deliveryType || 'Курьер до двери',
      status: 'new',
      comment: data.comment || '',
      source: data.source || 'Каталог',
      createdAt: Date.now(),
      history: [{ status: 'new', ts: Date.now() }]
    };
    /* Списание остатков и рост счётчика продаж */
    order.items.forEach(function (item) {
      var product = db.product(item.productId);
      if (!product) return;
      product.stock = Math.max(0, product.stock - item.qty);
      product.sales += item.qty;
      db.track('purchase', { productId: product.id, categoryId: product.categoryId, value: item.price * item.qty });
    });
    db.state.orders.push(order);
    if (data.promo) {
      var promo = db.state.promos.filter(function (p) { return p.code === data.promo.code; })[0];
      if (promo) promo.used = (promo.used || 0) + 1;
    }
    db.clearCart();
    db.audit('Оформлен заказ ' + order.number + ' на ' + U.money(order.total), order.customer.name);
    db.save();
    return { ok: true, order: order, message: 'Заказ ' + order.number + ' оформлен' };
  };
  db.setOrderStatus = function (id, status, comment) {
    var order = db.order(id);
    if (!order) return false;
    order.status = status;
    order.history = order.history || [];
    order.history.push({ status: status, ts: Date.now(), comment: comment || '' });
    if (comment) order.managerComment = comment;
    db.audit('Заказ ' + order.number + ' → ' + (db.ORDER_STATUS[status] || {}).label || status, 'admin');
    db.save();
    return true;
  };
  db.deleteOrder = function (id) {
    var order = db.order(id);
    if (!order) return false;
    db.state.orders = db.state.orders.filter(function (o) { return o.id !== order.id; });
    db.audit('Удалён заказ ' + order.number, 'admin');
    db.save();
    return true;
  };
  /** Шаги статуса заказа для визуального таймлайна. */
  db.orderTimeline = function (order) {
    var current = order.status === 'cancelled' ? 'cancelled' : order.status;
    var chain = current === 'cancelled' ? ORDER_STEPS.concat(['cancelled']) : ORDER_STEPS;
    var currentIndex = chain.indexOf(current);
    var reached = {};
    (order.history || []).forEach(function (h) {
      reached[h.status] = h.ts;
    });
    return chain.map(function (status, idx) {
      var meta = db.ORDER_STATUS[status] || { label: status, icon: 'info', cls: 'info' };
      return {
        status: status,
        label: meta.label,
        icon: meta.icon,
        cls: meta.cls,
        ts: reached[status] || null,
        done: idx <= currentIndex && current !== 'cancelled' ? idx < currentIndex : true,
        current: status === current
      };
    });
  };
  /* ------------------------------ Промокоды ------------------------------- */
  db.promos = function (onlyActive) {
    var list = db.all('promos').slice();
    return onlyActive ? list.filter(function (p) { return p.active; }) : list;
  };
  db.findPromo = function (code) {
    var needle = String(code || '').trim().toUpperCase();
    if (!needle) return null;
    return db.all('promos').filter(function (p) { return p.code === needle; })[0] || null;
  };
  db.promoLabel = function (promo) {
    if (!promo) return '';
    return promo.type === 'percent' ? '−' + promo.value + '%' : '−' + U.money(promo.value);
  };
  db.savePromo = function (data) {
    var code = String(data.code || '').trim().toUpperCase();
    if (!code) return { ok: false, message: 'Укажите промокод' };
    var existing = db.findPromo(code);
    if (existing && !data.id) return { ok: false, message: 'Такой промокод уже существует' };
    var payload = {
      code: code,
      type: data.type === 'fixed' ? 'fixed' : 'percent',
      value: Math.max(1, Number(data.value) || 0),
      min: Math.max(0, Number(data.min) || 0),
      description: data.description || '',
      active: data.active !== false,
      used: existing ? existing.used : 0
    };
    if (existing) Object.keys(payload).forEach(function (k) { existing[k] = payload[k]; });
    else db.state.promos.push(payload);
    db.audit('Сохранён промокод ' + code, 'admin');
    db.save();
    return { ok: true, promo: payload, message: 'Промокод сохранён' };
  };
  db.deletePromo = function (code) {
    db.state.promos = db.state.promos.filter(function (p) { return p.code !== code; });
    db.audit('Удалён промокод ' + code, 'admin');
    db.save();
    return true;
  };

  /* ------------------------- События аналитики ---------------------------- */
  var saveTimer = null;
  /** Регистрация события: view, add_cart, remove_cart, purchase, search, chat, ai_build... */
  db.track = function (type, meta) {
    if (!db.state) return;
    meta = meta || {};
    db.state.events.push({
      id: U.uid('ev'),
      type: type,
      productId: meta.productId || null,
      categoryId: meta.categoryId || null,
      value: Number(meta.value) || 0,
      label: meta.label || '',
      ts: Date.now()
    });
    if (db.state.events.length > EVENT_LIMIT) {
      db.state.events.splice(0, db.state.events.length - EVENT_LIMIT);
    }
    /* Сохранение с задержкой, чтобы не писать в localStorage на каждое событие */
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { db.save(); }, 800);
  };
  db.events = function (filter) {
    filter = filter || {};
    var list = db.all('events');
    if (filter.type) list = list.filter(function (e) { return e.type === filter.type; });
    if (filter.types) list = list.filter(function (e) { return filter.types.indexOf(e.type) !== -1; });
    if (filter.since) list = list.filter(function (e) { return e.ts >= filter.since; });
    if (filter.productId) list = list.filter(function (e) { return e.productId === filter.productId; });
    list = list.slice().sort(function (a, b) { return b.ts - a.ts; });
    return filter.limit ? list.slice(0, filter.limit) : list;
  };
  db.visit = function () {
    if (!db.state.visits) db.state.visits = [];
    var last = U.storage.get('last-visit', 0);
    if (Date.now() - last < 1800000) return false;
    db.state.visits.push(Date.now());
    U.storage.set('last-visit', Date.now());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { db.save(); }, 1200);
    return true;
  };

  /* ------------------------------- Настройки ------------------------------ */
  db.settings = function () { return db.state.settings; };
  db.aiSettings = function () { return db.state.settings.ai; };
  db.updateSettings = function (patch) {
    var settings = db.state.settings;
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'ai' && patch.ai) {
        settings.ai = Object.assign({}, settings.ai, patch.ai);
      } else {
        settings[k] = patch[k];
      }
    });
    db.save();
    return settings;
  };
  db.updateAiSettings = function (patch) {
    db.updateSettings({ ai: patch });
    return db.state.settings.ai;
  };

  /* ---------------------- Журнал действий (аудит) ------------------------- */
  db.audit = function (action, user) {
    if (!db.state) return;
    db.state.audit.unshift({ id: U.uid('log'), action: action, user: user || 'system', ts: Date.now() });
    if (db.state.audit.length > 300) db.state.audit.length = 300;
  };
  db.auditLog = function (limit) {
    var list = db.all('audit');
    return limit ? list.slice(0, limit) : list;
  };
  /* --------------------------- Управление товарами ------------------------ */
  /** Создание или обновление товара (админ-панель). */
  db.saveProduct = function (data) {
    if (!data || !String(data.name || '').trim()) return { ok: false, message: 'Укажите название товара' };
    var category = db.category(data.categoryId);
    if (!category) return { ok: false, message: 'Выберите категорию' };
    var isNew = !data.id || !db.product(data.id);
    var payload = {
      name: String(data.name).trim(),
      categoryId: data.categoryId,
      brand: String(data.brand || 'ByteStore').trim(),
      price: Math.max(0, Math.round(Number(data.price) || 0)),
      oldPrice: data.oldPrice ? Math.round(Number(data.oldPrice)) : 0,
      cost: Math.max(0, Math.round(Number(data.cost) || 0)),
      stock: Math.max(0, Math.round(Number(data.stock) || 0)),
      sku: String(data.sku || '').trim(),
      description: String(data.description || '').trim(),
      image: String(data.image || '').trim(),
      key: (data.key || []).filter(Boolean),
      badges: (data.badges || []).filter(Boolean),
      specs: data.specs || {},
      status: data.status === 'hidden' ? 'hidden' : 'active',
      updatedAt: Date.now()
    };
    if (isNew) {
      var id = data.id || U.slug(payload.name).slice(0, 28) || U.uid('p');
      var base = id, n = 1;
      while (db.product(id)) { id = base + '-' + (n++); }
      payload.id = id;
      payload.sku = payload.sku || 'BS-' + category.id.slice(0, 3).toUpperCase() + '-' +
        id.replace(/[^0-9a-z]/gi, '').slice(-4).toUpperCase();
      payload.rating = Number(data.rating) || 0;
      payload.reviews = 0;
      payload.sales = Math.max(0, Number(data.sales) || 0);
      payload.views = 0;
      payload.createdAt = Date.now();
      db.state.products.push(payload);
      db.audit('Добавлен товар «' + payload.name + '»', 'admin');
    } else {
      var target = db.product(data.id);
      Object.keys(payload).forEach(function (k) { target[k] = payload[k]; });
      db.audit('Обновлён товар «' + target.name + '»', 'admin');
    }
    db.save();
    return { ok: true, message: isNew ? 'Товар добавлен' : 'Товар сохранён' };
  };
  db.deleteProduct = function (id) {
    var product = db.product(id);
    if (!product) return false;
    db.state.products = db.state.products.filter(function (p) { return p.id !== id; });
    db.state.reviews = db.state.reviews.filter(function (r) { return r.productId !== id; });
    db.audit('Удалён товар «' + product.name + '»', 'admin');
    db.save();
    return true;
  };
  db.duplicateProduct = function (id) {
    var product = db.product(id);
    if (!product) return false;
    var copy = U.deepClone(product);
    copy.id = product.id + '-copy-' + Math.random().toString(36).slice(2, 5);
    copy.name = product.name + ' (копия)';
    copy.sales = 0;
    copy.views = 0;
    copy.createdAt = Date.now();
    db.state.products.push(copy);
    db.audit('Дублирован товар «' + product.name + '»', 'admin');
    db.save();
    return copy;
  };
  /** Быстрое изменение остатка из таблицы товаров. */
  db.updateStock = function (id, stock) {
    var product = db.product(id);
    if (!product) return false;
    product.stock = Math.max(0, Math.round(Number(stock) || 0));
    product.updatedAt = Date.now();
    db.save();
    return true;
  };

  /* -------------------------- Управление категориями ---------------------- */
  db.saveCategory = function (data) {
    if (!data || !String(data.name || '').trim()) return { ok: false, message: 'Укажите название категории' };
    var existing = data.id ? db.category(data.id) : null;
    var payload = {
      name: String(data.name).trim(),
      icon: data.icon || 'box',
      emoji: data.emoji || '📦',
      color: data.color || '#22d3ee',
      color2: data.color2 || '#8b5cf6',
      slot: data.slot || null,
      description: data.description || '',
      order: Number(data.order) || db.categories().length + 1
    };
    if (existing) {
      Object.keys(payload).forEach(function (k) { existing[k] = payload[k]; });
      db.audit('Обновлена категория «' + existing.name + '»', 'admin');
    } else {
      payload.id = data.id || U.slug(payload.name);
      if (db.category(payload.id)) return { ok: false, message: 'Категория с таким кодом уже есть' };
      db.state.categories.push(payload);
      db.audit('Добавлена категория «' + payload.name + '»', 'admin');
    }
    db.save();
    return { ok: true, message: 'Категория сохранена', category: payload };
  };
  db.deleteCategory = function (id) {
    var category = db.category(id);
    if (!category) return { ok: false, message: 'Категория не найдена' };
    var used = db.productsAll(true).filter(function (p) { return p.categoryId === id; }).length;
    if (used) return { ok: false, message: 'В категории ' + used + ' товаров — сначала перенесите или удалите их' };
    db.state.categories = db.state.categories.filter(function (c) { return c.id !== id; });
    db.audit('Удалена категория «' + category.name + '»', 'admin');
    db.save();
    return { ok: true, message: 'Категория удалена' };
  };
  /* --------------------------- Пользователи ------------------------------- */
  db.users = function (filter) {
    filter = filter || {};
    var list = db.all('users').slice();
    if (filter.q) {
      var terms = U.terms(filter.q);
      list = list.filter(function (u) {
        var hay = U.norm(u.name + ' ' + u.email + ' ' + (u.phone || ''));
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
    }
    if (filter.status) list = list.filter(function (u) { return u.status === filter.status; });
    list.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return list;
  };
  db.user = function (id) {
    return db.all('users').filter(function (u) { return u.id === id; })[0] || null;
  };
  db.userByEmail = function (email) {
    var needle = U.norm(email);
    return db.all('users').filter(function (u) { return U.norm(u.email) === needle; })[0] || null;
  };
  db.userStats = function (userId) {
    var orders = db.orders({ userId: userId });
    return {
      orders: orders.length,
      spent: U.sum(orders.filter(function (o) { return o.status !== 'cancelled'; }), function (o) { return o.total; }),
      reviews: db.reviews({}).filter(function (r) { return r.userId === userId; }).length,
      lastOrder: orders.length ? orders[0].createdAt : null
    };
  };
  db.setUserStatus = function (id, status) {
    var user = db.user(id);
    if (!user) return false;
    user.status = status;
    db.audit('Пользователь ' + user.email + ' → ' + status, 'admin');
    db.save();
    return true;
  };
  db.deleteUser = function (id) {
    var user = db.user(id);
    if (!user) return false;
    db.state.users = db.state.users.filter(function (u) { return u.id !== id; });
    db.audit('Удалён пользователь ' + user.email, 'admin');
    db.save();
    return true;
  };

  /* --------------------- Администратор и сессия --------------------------- */
  db.adminSession = function () { return U.storage.get(ADMIN_SESSION_KEY, null); };
  db.isAdmin = function () {
    var session = db.adminSession();
    return !!(session && session.login === db.state.admin.login && Date.now() - session.ts < 8 * 3600000);
  };
  /** Проверка пары логин/пароль администратора с защитой от подбора. */
  db.adminLogin = function (login, password) {
    var admin = db.state.admin;
    if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
      var left = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
      return Promise.resolve({ ok: false, message: 'Вход временно заблокирован. Повторите через ' + left + ' мин.' });
    }
    return U.hashPassword(password, admin.salt).then(function (hash) {
      if (String(login).trim().toLowerCase() === admin.login.toLowerCase() && hash === admin.passHash) {
        admin.failedAttempts = 0;
        admin.lockedUntil = 0;
        admin.lastLogin = Date.now();
        U.storage.set(ADMIN_SESSION_KEY, { login: admin.login, ts: Date.now() });
        db.audit('Успешный вход администратора', admin.login);
        db.save();
        return { ok: true, message: 'Добро пожаловать, ' + admin.login };
      }
      admin.failedAttempts = (admin.failedAttempts || 0) + 1;
      if (admin.failedAttempts >= 5) {
        admin.lockedUntil = Date.now() + 5 * 60000;
        admin.failedAttempts = 0;
      }
      db.audit('Неудачная попытка входа в панель: ' + login, 'security');
      db.save();
      var left = 5 - (admin.failedAttempts || 0);
      return { ok: false, message: 'Неверный логин или пароль' + (left < 3 && left > 0 ? '. Осталось попыток: ' + left : '') };
    });
  };
  db.adminLogout = function () {
    U.storage.remove(ADMIN_SESSION_KEY);
    db.audit('Выход администратора из панели', db.state.admin.login);
    db.save();
    return true;
  };
  db.changeAdminPassword = function (current, next) {
    var admin = db.state.admin;
    if (String(next || '').length < 4) return Promise.resolve({ ok: false, message: 'Пароль слишком короткий' });
    return U.hashPassword(current, admin.salt).then(function (hash) {
      if (hash !== admin.passHash) return { ok: false, message: 'Текущий пароль указан неверно' };
      var salt = U.salt();
      return U.hashPassword(next, salt).then(function (newHash) {
        admin.salt = salt;
        admin.passHash = newHash;
        db.audit('Пароль администратора изменён', admin.login);
        db.save();
        return { ok: true, message: 'Пароль обновлён' };
      });
    });
  };
  /* ------------------------------ Аналитика -------------------------------- */
  /**
   * Полная сводка для дашборда администратора.
   * @param {number} days период в днях (7 | 30 | 90)
   */
  db.analytics = function (days) {
    days = Number(days) || 30;
    var now = Date.now();
    var from = now - days * 86400000;
    var prevFrom = from - days * 86400000;
    var orders = db.all('orders');
    var paid = orders.filter(function (o) { return o.status !== 'cancelled'; });
    var current = paid.filter(function (o) { return o.createdAt >= from; });
    var previous = paid.filter(function (o) { return o.createdAt >= prevFrom && o.createdAt < from; });

    var revenue = U.sum(current, function (o) { return o.total; });
    var prevRevenue = U.sum(previous, function (o) { return o.total; });
    var itemsSold = U.sum(current, function (o) { return U.sum(o.items, function (i) { return i.qty; }); });
    var customers = {}, prevCustomers = {};
    current.forEach(function (o) { if (o.userId) customers[o.userId] = true; });
    previous.forEach(function (o) { if (o.userId) prevCustomers[o.userId] = true; });

    var visits = (db.state.visits || []).filter(function (t) { return t >= from; }).length;
    var prevVisits = (db.state.visits || []).filter(function (t) { return t >= prevFrom && t < from; }).length;
    var pendingOrders = orders.filter(function (o) { return o.status === 'new' || o.status === 'processing'; }).length;
    var ordersToday = orders.filter(function (o) {
      return o.status !== 'cancelled' && U.isoDay(o.createdAt) === U.isoDay(now);
    });

    /* Дневные ряды: выручка, заказы, посещаемость */
    var series = [];
    for (var d = days - 1; d >= 0; d--) {
      var dayStart = new Date(now - d * 86400000);
      dayStart.setHours(0, 0, 0, 0);
      var start = dayStart.getTime(), end = start + 86400000;
      var dayOrders = paid.filter(function (o) { return o.createdAt >= start && o.createdAt < end; });
      var dayVisits = (db.state.visits || []).filter(function (t) { return t >= start && t < end; }).length;
      series.push({
        ts: start,
        label: U.pad(dayStart.getDate()) + '.' + U.pad(dayStart.getMonth() + 1),
        short: String(dayStart.getDate()),
        revenue: U.sum(dayOrders, function (o) { return o.total; }),
        orders: dayOrders.length,
        visits: dayVisits
      });
    }

    /* Статусы заказов */
    var statuses = {};
    Object.keys(db.ORDER_STATUS).forEach(function (key) {
      statuses[key] = { label: db.ORDER_STATUS[key].label, cls: db.ORDER_STATUS[key].cls, count: 0, sum: 0 };
    });
    orders.forEach(function (o) {
      if (!statuses[o.status]) return;
      statuses[o.status].count++;
      statuses[o.status].sum += o.total;
    });

    /* Агрегация по товарам и категориям */
    var productAgg = {}, categoryAgg = {};
    current.forEach(function (o) {
      o.items.forEach(function (item) {
        var row = productAgg[item.productId] = productAgg[item.productId] ||
          { id: item.productId, name: item.name, qty: 0, revenue: 0, categoryId: item.categoryId };
        row.qty += item.qty;
        row.revenue += item.price * item.qty;
        var cat = categoryAgg[item.categoryId] = categoryAgg[item.categoryId] ||
          { id: item.categoryId, qty: 0, revenue: 0 };
        cat.qty += item.qty;
        cat.revenue += item.price * item.qty;
      });
    });
    var topProducts = Object.keys(productAgg).map(function (k) { return productAgg[k]; })
      .sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 8);
    var categoryRevenue = Object.keys(categoryAgg).map(function (k) {
      var row = categoryAgg[k];
      var cat = db.category(k);
      row.name = cat ? cat.name : k;
      row.color = cat ? cat.color : '#22d3ee';
      row.emoji = cat ? cat.emoji : '📦';
      row.share = revenue ? Math.round(row.revenue / revenue * 100) : 0;
      return row;
    }).sort(function (a, b) { return b.revenue - a.revenue; });
    /* Источники заказов и воронка продаж */
    var sources = {};
    current.forEach(function (o) {
      var key = o.source || 'Каталог';
      sources[key] = (sources[key] || 0) + 1;
    });
    var ev = db.events({ since: from });
    function countEvents(type) {
      return ev.filter(function (e) { return e.type === type; }).length;
    }
    var funnel = [
      { label: 'Визиты', value: visits, icon: 'eye' },
      { label: 'Просмотры товаров', value: countEvents('view'), icon: 'search' },
      { label: 'В корзину', value: countEvents('add_cart'), icon: 'cart' },
      { label: 'Заказы', value: current.length, icon: 'check-circle' }
    ];

    /* Низкий остаток и лучшие покупатели */
    var lowStock = db.productsAll().filter(function (p) { return p.stock <= 8; })
      .sort(function (a, b) { return a.stock - b.stock; }).slice(0, 8);
    var perUser = {};
    paid.forEach(function (o) {
      if (!o.userId) return;
      var row = perUser[o.userId] = perUser[o.userId] || { id: o.userId, orders: 0, spent: 0 };
      row.orders++;
      row.spent += o.total;
    });
    var topCustomers = Object.keys(perUser).map(function (id) {
      var user = db.user(id);
      return {
        id: id, name: user ? user.name : 'Покупатель', email: user ? user.email : '',
        orders: perUser[id].orders, spent: perUser[id].spent
      };
    }).sort(function (a, b) { return b.spent - a.spent; }).slice(0, 6);

    var reviewsAll = db.all('reviews');
    var publishedReviews = reviewsAll.filter(function (r) { return r.status === 'published'; });

    function delta(currentValue, previousValue) {
      if (!previousValue) return currentValue ? 100 : 0;
      return Math.round((currentValue - previousValue) / previousValue * 1000) / 10;
    }

    return {
      days: days,
      from: from,
      revenue: revenue,
      prevRevenue: prevRevenue,
      revenueDelta: delta(revenue, prevRevenue),
      orders: current.length,
      prevOrders: previous.length,
      ordersDelta: delta(current.length, previous.length),
      ordersToday: ordersToday.length,
      itemsSold: itemsSold,
      avgOrder: current.length ? Math.round(revenue / current.length) : 0,
      prevAvgOrder: previous.length ? Math.round(prevRevenue / previous.length) : 0,
      customers: Object.keys(customers).length,
      prevCustomers: Object.keys(prevCustomers).length,
      customersDelta: delta(Object.keys(customers).length, Object.keys(prevCustomers).length),
      visits: visits,
      visitsDelta: delta(visits, prevVisits),
      conversion: visits ? Math.round(current.length / visits * 1000) / 10 : 0,
      prevConversion: prevVisits ? Math.round(previous.length / prevVisits * 1000) / 10 : 0,
      margin: U.sum(current, function (o) {
        return U.sum(o.items, function (i) {
          var p = db.product(i.productId);
          return p ? (i.price - (p.cost || i.price * 0.8)) * i.qty : 0;
        });
      }),
      pendingOrders: pendingOrders,
      pendingReviews: db.pendingReviewsCount(),
      reviewsTotal: reviewsAll.length,
      avgRating: publishedReviews.length
        ? Math.round(U.avg(publishedReviews, function (r) { return r.rating; }) * 10) / 10 : 0,
      series: series,
      statuses: statuses,
      topProducts: topProducts,
      categoryRevenue: categoryRevenue,
      sources: Object.keys(sources).map(function (k) { return { label: k, value: sources[k] }; })
        .sort(function (a, b) { return b.value - a.value; }),
      funnel: funnel,
      lowStock: lowStock,
      topCustomers: topCustomers,
      recentOrders: db.orders({ limit: 8 }),
      recentEvents: ev.slice(0, 12),
      aiUsage: {
        builds: countEvents('ai_build'),
        chats: countEvents('chat'),
        configurator: countEvents('configurator')
      },
      avgCheckByCategory: categoryRevenue.map(function (c) {
        var ordersCount = current.filter(function (o) {
          return o.items.some(function (i) { return i.categoryId === c.id; });
        }).length;
        return { name: c.name, avg: ordersCount ? Math.round(c.revenue / ordersCount) : 0, emoji: c.emoji };
      })
    };
  };

  /* __PART13__ */

})();
