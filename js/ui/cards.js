/* ==========================================================================
   ByteStore — Переиспользуемые шаблоны интерфейса: карточки товаров,
   плитки категорий, отзывы, заказы, скелетоны загрузки.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var C = (BS.cards = {});

  /** Набор бейджей товара: скидка, хит продаж, новинка, собственные метки. */
  C.badges = function (product) {
    var out = [];
    var discount = db.discountOf(product);
    if (discount >= 5) out.push({ text: '−' + discount + '%', type: 'danger' });
    if (product.sales >= 250) out.push({ text: 'Хит продаж', type: 'solid' });
    else if (product.sales >= 150) out.push({ text: 'Популярное', type: 'accent' });
    if (Date.now() - product.createdAt < 30 * 86400000) out.push({ text: 'Новинка', type: 'ok' });
    if (product.stock === 0) out.push({ text: 'Нет в наличии', type: 'warn' });
    (product.badges || []).forEach(function (label) {
      if (out.length < 3) out.push({ text: label, type: 'violet' });
    });
    return out.slice(0, 3).map(function (b) {
      return '<span class="badge badge--' + b.type + '">' + U.esc(b.text) + '</span>';
    }).join('');
  };

  /**
   * Карточка товара.
   * @param {Object} product
   * @param {{compact:boolean}} [opts]
   */
  C.product = function (product, opts) {
    opts = opts || {};
    if (!product) return '';
    var category = db.category(product.categoryId) || { name: 'Комплектующие' };
    var isFav = db.isFavorite(product.id);
    var inCompare = db.compare.has(product.id);
    var inStock = product.stock > 0;
    var specs = (product.key || []).slice(0, 3).map(function (item) {
      return '<span class="pc__spec">' + U.esc(item) + '</span>';
    }).join('');
    return '' +
      '<article class="pc' + (inStock ? '' : ' is-out') + '" data-product-card="' + U.attr(product.id) + '">' +
      '<div class="pc__media">' +
      '<div class="pc__badges">' + C.badges(product) + '</div>' +
      '<div class="pc__actions">' +
      '<button class="pc__fav tip' + (isFav ? ' is-on' : '') + '" data-fav-toggle="' + U.attr(product.id) +
      '" data-tip="В избранное" aria-label="В избранное">' + BS.icon('heart', { size: 16 }) + '</button>' +
      '<button class="pc__cmp tip' + (inCompare ? ' is-on' : '') + '" data-cmp-toggle="' + U.attr(product.id) +
      '" data-tip="К сравнению" aria-label="К сравнению">' + BS.icon('sliders', { size: 16 }) + '</button>' +
      '</div>' +
      '<a href="product.html?id=' + U.attr(product.id) + '" aria-label="' + U.attr(product.name) + '">' +
      BS.art(product) + '</a>' +
      '</div>' +
      '<div class="pc__body">' +
      '<div class="pc__cat">' + U.esc(category.name) + '</div>' +
      '<h3 class="pc__title clamp-2"><a href="product.html?id=' + U.attr(product.id) + '">' +
      U.esc(product.name) + '</a></h3>' +
      '<div class="pc__specs">' + specs + '</div>' +
      '<div class="between">' + BS.stars(product.rating, { size: 14 }) +
      '<span class="muted small">' + (product.reviews ? product.rating + ' · ' + product.reviews + ' отз.' : 'нет отзывов') +
      '</span></div>' +
      '<div class="pc__foot">' +
      '<div class="pc__price">' +
      (db.discountOf(product) ? '<span class="pc__old">' + U.money(product.oldPrice) + '</span>' : '') +
      '<span class="pc__now">' + U.money(product.price) + '</span>' +
      '</div>' +
      '<button class="btn btn--primary btn--sm" data-add-cart="' + U.attr(product.id) + '"' +
      (inStock ? '' : ' disabled') + '>' +
      BS.icon('cart', { size: 16 }) + 'Купить</button>' +
      '</div>' +
      '<div class="pc__stock ' + (inStock ? 'text-ok' : 'text-warn') + '">' +
      (inStock ? 'В наличии: ' + product.stock + ' шт.' : 'Ожидается поставка') + '</div>' +
      '</div></article>';
  };

  /** Сетка карточек товаров. */
  C.grid = function (products, opts) {
    if (!products || !products.length) {
      return BS.layout.emptyState({
        emoji: '🕵️', title: 'Товары не найдены',
        text: 'Попробуйте изменить фильтры или воспользуйтесь ИИ-конфигуратором.',
        action: '<a class="btn btn--primary" href="configurator.html">Подобрать сборку</a>'
      });
    }
    return '<div class="grid-cards">' + products.map(function (p) { return C.product(p, opts); }).join('') + '</div>';
  };
  C.skeletonGrid = function (count) {
    var cards = '';
    for (var i = 0; i < (count || 8); i++) {
      cards += '<div class="pc"><div class="pc__media"><div class="skeleton" style="width:100%;height:100%"></div></div>' +
        '<div class="pc__body"><div class="skeleton skeleton--text" style="width:40%"></div>' +
        '<div class="skeleton skeleton--title"></div>' +
        '<div class="skeleton skeleton--text" style="width:80%"></div>' +
        '<div class="skeleton skeleton--text" style="width:60%"></div>' +
        '<div class="skeleton skeleton--btn" style="margin-top:12px"></div></div></div>';
    }
    return '<div class="grid-cards">' + cards + '</div>';
  };

  /** Плитка категории для главной страницы. */
  C.categoryTile = function (category) {
    var products = db.byCategory(category.id);
    var minPrice = products.length ? Math.min.apply(null, products.map(function (p) { return p.price; })) : 0;
    return '<a class="cat-tile" href="catalog.html?category=' + U.attr(category.id) + '">' +
      '<span class="cat-tile__icon">' + (BS.icon(category.icon, { size: 26 }) || category.emoji) + '</span>' +
      '<span class="cat-tile__name">' + U.esc(category.name) + '</span>' +
      '<span class="muted small clamp-2">' + U.esc(category.description || '') + '</span>' +
      '<span class="cat-tile__count">' + products.length + ' товаров' +
      (minPrice ? ' · от ' + U.money(minPrice) : '') + '</span>' +
      '<span class="cat-tile__mouse">' + category.emoji + '</span>' +
      '</a>';
  };
  /* ------------------------------- Отзывы --------------------------------- */
  C.ratingSummary = function (stats) {
    var rows = '';
    [5, 4, 3, 2, 1].forEach(function (star) {
      var count = stats.distribution[star] || 0;
      var percent = stats.count ? Math.round(count / stats.count * 100) : 0;
      rows += '<div class="rating-row"><span class="nowrap">' + star + ' ★</span>' +
        '<span class="rating-row__bar"><span class="rating-row__fill" style="width:' + percent + '%"></span></span>' +
        '<span class="nowrap">' + count + '</span></div>';
    });
    return '<div class="rating-summary">' +
      '<div><div class="rating-summary__num">' + (stats.average || '—') + '</div>' +
      BS.stars(stats.average, { size: 18, cls: 'rating-lg' }) +
      '<div class="muted mt-2">' + stats.count + ' ' +
      U.plural(stats.count, 'отзыв', 'отзыва', 'отзывов') + '</div>' +
      (stats.count ? '<div class="small text-ok mt-2">' + stats.recommended + '% рекомендуют</div>' : '') +
      '</div><div>' + rows + '</div></div>';
  };

  C.review = function (review, opts) {
    opts = opts || {};
    var liked = (U.storage.get('liked-reviews', []) || []).indexOf(review.id) !== -1;
    var statusLabel = { published: 'Опубликован', pending: 'На модерации', rejected: 'Отклонён' }[review.status] || review.status;
    var statusClass = { published: 'ok', pending: 'warn', rejected: 'danger' }[review.status] || 'info';
    return '<div class="review" data-review="' + U.attr(review.id) + '">' +
      '<div class="review__ava">' + U.esc((review.author || 'Гость').slice(0, 1).toUpperCase()) + '</div>' +
      '<div class="grow">' +
      '<div class="review__head">' + BS.stars(review.rating, { size: 14 }) +
      '<span class="review__name">' + U.esc(review.author || 'Гость') + '</span>' +
      (review.verified ? '<span class="badge badge--ok">Покупка подтверждена</span>' : '') +
      (opts.showStatus ? '<span class="badge badge--' + statusClass + '">' + statusLabel + '</span>' : '') +
      '<span class="review__date">' + U.date(review.createdAt) + '</span>' +
      (opts.showProduct && review.productName
        ? '<a class="small" href="product.html?id=' + U.attr(review.productId) + '">' +
          U.esc(review.productName) + '</a>'
        : '') +
      '</div>' +
      '<p class="review__text">' + U.esc(review.text) + '</p>' +
      (review.pros ? '<p class="review__text text-ok"><b>Плюсы:</b> ' + U.esc(review.pros) + '</p>' : '') +
      (review.cons ? '<p class="review__text text-warn"><b>Минусы:</b> ' + U.esc(review.cons) + '</p>' : '') +
      (review.reply ? '<div class="review__reply"><b>Ответ ByteStore</b>' + U.esc(review.reply) + '</div>' : '') +
      (opts.actions || ('<div class="row gap-3 mt-3">' +
        '<button class="btn btn--ghost btn--xs' + (liked ? ' text-accent' : '') + '" data-review-like="' +
        U.attr(review.id) + '">' + BS.icon('thumbs-up', { size: 14 }) + 'Полезно · ' +
        (review.likes || 0) + '</button></div>')) +
      '</div></div>';
  };

  /* ------------------------------- Заказы --------------------------------- */
  C.order = function (order, opts) {
    opts = opts || {};
    var items = order.items.map(function (item) {
      return '<div class="order-line"><span>' + U.esc(item.name) + ' × ' + item.qty + '</span>' +
        '<b>' + U.money(item.price * item.qty) + '</b></div>';
    }).join('');
    var timeline = '';
    if (opts.timeline && order.status !== 'cancelled') {
      timeline = '<div class="timeline">' + db.orderTimeline(order).map(function (step) {
        return '<div class="timeline__step' + (step.done ? ' is-done' : '') +
          (step.current ? ' is-current' : '') + '">' +
          '<div class="timeline__dot">' + BS.icon(step.icon, { size: 12 }) + '</div>' +
          '<span>' + U.esc(step.label) + '</span></div>';
      }).join('') + '</div>';
    }
    return '<div class="order-card">' +
      '<div class="order-card__head">' +
      '<div><span class="order-card__num">' + U.esc(order.number) + '</span> ' +
      '<span class="muted small">от ' + U.date(order.createdAt, true) + '</span></div>' +
      '<div class="row gap-2 center">' + BS.layout.statusBadge(order.status) +
      '<b>' + U.money(order.total) + '</b></div>' +
      '</div>' +
      '<div class="order-card__body">' + items + timeline +
      '<div class="between mt-4 small muted">' +
      '<span>' + U.esc(order.deliveryType) + (order.city ? ' · ' + U.esc(order.city) : '') + '</span>' +
      '<span>Оплата: ' + U.esc(order.payment) + '</span>' +
      '</div>' + (opts.actions || '') +
      '</div></div>';
  };
  /* --------------------------- Прочие фрагменты ---------------------------- */
  /** Подсказка «сколько не хватает до бесплатной доставки». */
  C.freeDeliveryHint = function (totals) {
    if (!totals.freeDeliveryLeft) {
      return '<div class="alert alert--ok"><span class="alert__icon">🚚</span><div class="alert__body">' +
        '<strong>Доставка бесплатная</strong><p>Сумма заказа превышает порог бесплатной доставки.</p></div></div>';
    }
    var percent = Math.min(100, Math.round(totals.subtotal / (totals.subtotal + totals.freeDeliveryLeft) * 100));
    return '<div class="alert alert--info"><span class="alert__icon">🚚</span><div class="alert__body">' +
      '<strong>До бесплатной доставки ' + U.money(totals.freeDeliveryLeft) + '</strong>' +
      '<div class="progress progress--thin mt-2"><div class="progress__bar" style="width:' + percent + '%"></div></div>' +
      '</div></div>';
  };

  /** Таблица характеристик товара с человекочитаемыми названиями полей. */
  var SPEC_LABELS = {
    socket: 'Сокет', cores: 'Ядра', threads: 'Потоки', base: 'Базовая частота', boost: 'Turbo-частота',
    tdp: 'TDP', ram: 'Тип памяти', igpu: 'Встроенная графика', vcache: '3D V-Cache', unlocked: 'Разгон',
    chipset: 'Чипсет', formFactor: 'Форм-фактор', ramType: 'Тип памяти', ramSlots: 'Слотов памяти',
    maxRam: 'Максимум памяти, ГБ', m2: 'Слотов M.2', usb: 'USB', wifi: 'Wi-Fi', chip: 'Графический чип',
    vram: 'Видеопамять, ГБ', length: 'Длина, мм', recommendedPsu: 'Рекомендуемый БП, Вт', ports: 'Видеовыходы',
    type: 'Тип', capacity: 'Объём', modules: 'Модулей', speed: 'Частота, МГц', latency: 'Тайминги', rgb: 'Подсветка',
    interface: 'Интерфейс', read: 'Чтение, МБ/с', write: 'Запись, МБ/с', wattage: 'Мощность, Вт',
    efficiency: 'Сертификат', modular: 'Модульность', pcie: 'Разъёмы PCIe', formFactors: 'Форм-факторы',
    maxGpuLength: 'Видеокарта до, мм', maxCoolerHeight: 'Кулер до, мм', psuFormFactor: 'Формат БП',
    fans: 'Вентиляторы', radiator: 'Радиатор, мм', tdpRating: 'Рассеиваемая мощность, Вт',
    height: 'Высота, мм', noise: 'Шум', sockets: 'Поддерживаемые сокеты', diagonal: 'Диагональ',
    resolution: 'Разрешение', refresh: 'Частота обновления, Гц', panel: 'Матрица', response: 'Отклик',
    hdr: 'HDR', kind: 'Тип устройства', connection: 'Подключение', backlight: 'Подсветка',
    layout: 'Раскладка', switch: 'Свитчи', dpi: 'Разрешение сенсора, DPI', buttons: 'Кнопок', weight: 'Вес',
    surround: 'Объёмный звук', mic: 'Микрофон', cpu: 'Процессор', gpu: 'Видеокарта', psu: 'Блок питания',
    cooling: 'Охлаждение', warranty: 'Гарантия', storage: 'Накопитель'
  };
  C.specLabel = function (key) { return SPEC_LABELS[key] || key; };

  C.specGrid = function (product) {
    var items = '';
    Object.keys(product.specs || {}).forEach(function (key) {
      if (key === 'score') return;
      var value = product.specs[key];
      if (value === undefined || value === null || value === '') return;
      if (typeof value === 'boolean') value = value ? 'да' : 'нет';
      if (Object.prototype.toString.call(value) === '[object Array]') value = value.join(', ');
      items += '<div class="spec-item"><div class="spec-item__key">' + U.esc(C.specLabel(key)) + '</div>' +
        '<div class="spec-item__val">' + U.esc(value) + '</div></div>';
    });
    return '<div class="spec-grid">' + items + '</div>';
  };

  /** Хлебные крошки. */
  C.breadcrumbs = function (trail) {
    return '<nav class="breadcrumbs" aria-label="Навигация">' + trail.map(function (item, index) {
      if (index === trail.length - 1 || !item.href) return '<span>' + U.esc(item.label) + '</span>';
      return '<a href="' + U.attr(item.href) + '">' + U.esc(item.label) + '</a><span class="sep">/</span>';
    }).join('') + '</nav>';
  };
})();
