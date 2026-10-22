/* ==========================================================================
   ByteStore — Страница товара: галерея, характеристики, отзывы, похожие
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});

  pages.product = {
    product: null,

    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      var product = db.product(U.qs('id'));
      if (!product) {
        root.innerHTML = '<div class="container section">' + L.emptyState({
          emoji: '🔍', title: 'Товар не найден',
          text: 'Возможно, он был удалён или ссылка устарела.',
          action: '<a class="btn btn--primary" href="catalog.html">Вернуться в каталог</a>'
        }) + '</div>';
        return;
      }
      this.product = product;
      product.views = (product.views || 0) + 1;
      db.track('view', { productId: product.id, categoryId: product.categoryId });
      db.save();

      var category = db.category(product.categoryId) || { name: 'Комплектующие', id: '' };
      var stats = db.ratingStats(product.id);
      var similar = db.similar(product.id, 4);
      var inStock = product.stock > 0;
      var discount = db.discountOf(product);

      root.innerHTML = '<div class="container">' +
        C.breadcrumbs([
          { label: 'Главная', href: 'index.html' },
          { label: 'Каталог', href: 'catalog.html' },
          { label: category.name, href: 'catalog.html?category=' + category.id },
          { label: product.name }
        ]) +
        '<div class="product-page mt-6" data-product-block="' + U.attr(product.id) + '">' +
        '<div><div class="gallery">' +
        '<div class="gallery__badges">' + C.badges(product) + '</div>' + BS.art(product) + '</div></div>' +
        '<div class="product-info">' +
        '<div class="product-info__brand">' + U.esc(product.brand) + ' · Арт. ' + U.esc(product.sku) + '</div>' +
        '<h1>' + U.esc(product.name) + '</h1>' +
        '<div class="product-info__meta">' + BS.stars(product.rating, { size: 16 }) +
        '<span>' + (product.rating || '—') + ' из 5 · ' + stats.count + ' ' +
        U.plural(stats.count, 'отзыв', 'отзыва', 'отзывов') + '</span>' +
        '<span>' + BS.icon('award', { size: 15 }) + ' Гарантия ' +
        (product.categoryId === 'prebuilt' ? '3 года' : 'от 1 года') + '</span>' +
        '<span>' + BS.icon('eye', { size: 15 }) + ' ' + U.num(product.views) + ' просмотров</span></div>' +
        '<div class="price-block">' +
        '<div><div class="price-block__now">' + U.money(product.price) + '</div>' +
        (discount ? '<div class="row gap-3 center"><span class="price-block__old">' + U.money(product.oldPrice) +
          '</span><span class="badge badge--danger">Выгода ' + U.money(product.oldPrice - product.price) +
          '</span></div>' : '') +
        '</div>' +
        '<span class="badge badge--' + (inStock ? 'ok' : 'warn') + '">' +
        (inStock ? 'В наличии: ' + product.stock + ' шт.' : 'Нет в наличии') + '</span>' +
        '</div>' +
        '<div class="buy-row">' +
        '<div class="qty"><button data-qty="-1" aria-label="Меньше">−</button>' +
        '<input type="text" value="1" data-qty-input aria-label="Количество">' +
        '<button data-qty="1" aria-label="Больше">+</button></div>' +
        '<button class="btn btn--primary btn--lg" data-add-cart="' + U.attr(product.id) + '"' +
        (inStock ? '' : ' disabled') + '>' + BS.icon('cart', { size: 18 }) + 'В корзину</button>' +
        '<div class="buy-row__tools">' +
        '<button class="btn btn--outline tip" data-fav-toggle="' + U.attr(product.id) + '" data-tip="Избранное">' +
        BS.icon('heart', { size: 18 }) + '</button>' +
        '<button class="btn btn--outline tip" data-cmp-toggle="' + U.attr(product.id) + '" data-tip="Сравнить">' +
        BS.icon('sliders', { size: 18 }) + '</button>' +
        '<button class="btn btn--outline tip" data-share="' + U.attr(window.location.href) +
        '" data-tip="Скопировать ссылку">' + BS.icon('link', { size: 18 }) + '</button></div>' +
        '</div>' +
        '<div class="alert alert--info"><span class="alert__icon">' + BS.icon('truck', { size: 18 }) + '</span>' +
        '<div class="alert__body"><strong>Доставка 1–2 дня</strong>' +
        '<p>Бесплатно от ' + U.money(db.settings().freeDeliveryFrom) + '. Самовывоз со склада: ' +
        U.APP.address + '.</p></div></div>' +
        '<div class="trust-row">' +
        '<span class="trust-item">' + BS.icon('shield', { size: 17 }) + 'Официальная гарантия</span>' +
        '<span class="trust-item">' + BS.icon('refresh', { size: 17 }) + 'Возврат 14 дней</span>' +
        '<span class="trust-item">' + BS.icon('card', { size: 17 }) + 'Оплата частями</span>' +
        '<span class="trust-item">' + BS.icon('tool', { size: 17 }) + 'Сервисный центр</span>' +
        '</div></div></div>' +
        this.tabs(product, stats, similar) + '</div>';
      this.wire(root, product);
    },
    /** Табы: описание, характеристики, отзывы, доставка + похожие товары. */
    tabs: function (product, stats, similar) {
      var reviews = db.reviews({ productId: product.id, status: 'published' });
      var user = BS.auth.user();
      return '<section class="section section--tight"><div class="container">' +
        '<div class="tabs" data-tabs>' +
        '<button class="tab is-active" data-tab="desc">Описание</button>' +
        '<button class="tab" data-tab="specs">Характеристики</button>' +
        '<button class="tab" data-tab="reviews">Отзывы (' + reviews.length + ')</button>' +
        '<button class="tab" data-tab="delivery">Доставка и оплата</button>' +
        '</div>' +
        '<div class="card card--pad-lg mt-4">' +
        '<div class="tab-panel is-active" data-panel="desc">' +
        '<h3>Об этом товаре</h3><p>' + U.esc(product.description) + '</p>' +
        '<div class="grid-3 mt-5">' +
        (product.key || []).map(function (key) {
          return '<div class="card card--flat"><div class="muted small">Ключевая характеристика</div>' +
            '<div class="strong">' + U.esc(key) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="alert alert--info mt-5"><span class="alert__icon">🤖</span><div class="alert__body">' +
        '<strong>Подбор с ИИ</strong><p>Не уверены в совместимости? ИИ-конфигуратор подберёт остальные детали ' +
        'под этот товар и проверит сокет, память и мощность БП.</p></div></div>' +
        '</div>' +
        '<div class="tab-panel" data-panel="specs"><h3>Характеристики</h3>' + C.specGrid(product) +
        '<div class="muted small mt-4">Артикул: ' + U.esc(product.sku) + ' · Категория: ' +
        U.esc((db.category(product.categoryId) || {}).name || '') + ' · Бренд: ' + U.esc(product.brand) + '</div></div>' +
        '<div class="tab-panel" data-panel="reviews">' +
        '<div class="grid-2">' +
        '<div>' + C.ratingSummary(stats) + '</div>' +
        '<div>' + (user
          ? '<h4>Оставить отзыв</h4>' +
            '<form data-review-form>' +
            '<div class="field"><label>Оценка</label><div class="stars-input" data-stars>' +
            [1, 2, 3, 4, 5].map(function (n) {
              return '<span data-star="' + n + '">' + BS.icon('star', { size: 26 }) + '</span>';
            }).join('') + '</div><input type="hidden" name="rating" value="5"></div>' +
            '<div class="field"><label for="rvText">Ваш отзыв</label>' +
            '<textarea class="textarea" id="rvText" name="text" placeholder="Расскажите о товаре: ' +
            'производительность, температуры, шум, совместимость…"></textarea></div>' +
            '<div class="row gap-3"><div class="field grow"><label>Плюсы</label>' +
            '<input class="input" name="pros" placeholder="Что понравилось"></div>' +
            '<div class="field grow"><label>Минусы</label>' +
            '<input class="input" name="cons" placeholder="Что не понравилось"></div></div>' +
            '<button class="btn btn--primary" type="submit">Отправить на модерацию</button></form>'
          : '<div class="card card--flat"><h4>Поделитесь мнением</h4>' +
            '<p class="muted small">Отзывы могут оставлять только авторизованные покупатели — так мы ' +
            'гарантируем честность оценок.</p>' +
            '<a class="btn btn--primary btn--sm" href="login.html?next=product.html?id=' +
            U.attr(product.id) + '">Войти и написать отзыв</a></div>') +
        '</div></div>' +
        '<div class="mt-6" id="reviewsList">' +
        (reviews.length ? reviews.map(function (r) {
          return C.review(r, { actions: '<div class="row gap-3 mt-3">' +
            '<button class="btn btn--ghost btn--xs" data-review-like="' + U.attr(r.id) + '">' +
            BS.icon('thumbs-up', { size: 14 }) + 'Полезно · ' + (r.likes || 0) + '</button></div>' });
        }).join('') : '<p class="muted">Отзывов пока нет — станьте первым, кто оценит этот товар.</p>') +
        '</div></div>' +
        '<div class="tab-panel" data-panel="delivery">' +
        '<div class="grid-2"><div><h3>Доставка</h3><ul class="col gap-3">' +
        '<li>Курьер до двери — 1 день (Алматы, Астана), 2–4 дня по Казахстану.</li>' +
        '<li>Пункты выдачи — более 90 адресов в 20 городах, срок 2–4 дня.</li>' +
        '<li>Стоимость ' + U.money(db.settings().deliveryCost) + ', бесплатно от ' +
        U.money(db.settings().freeDeliveryFrom) + '.</li>' +
        '<li>Жёсткие комплектующие упаковываются в дополнительную защиту.</li></ul></div>' +
        '<div><h3>Оплата</h3><ul class="col gap-3">' +
        '<li>Банковская карта онлайн, Единый QR, рассрочка 0-0-6 / 0-0-12 / 0-0-24.</li>' +
        '<li>Оплата при получении курьеру или в пункте выдачи.</li>' +
        '<li>Безналичный расчёт для юридических лиц.</li>' +
        '<li>Чек и гарантийный талон приходят на e-mail.</li></ul></div></div></div>' +
        '</div></section>' +
        (similar.length ? '<section class="section section--tight"><div class="container">' +
          L.sectionHead('Похожие товары', 'С этим товаром сравнивают') + C.grid(similar) +
          '</div></section>' : '');
    },
    /* ------------------------------ Обработчики ----------------------------- */
    wire: function (root, product) {
      var self = this;
      root.addEventListener('click', function (e) {
        var qtyBtn = e.target.closest('[data-qty]');
        if (qtyBtn) {
          var block = qtyBtn.closest('[data-product-block]') || root;
          var input = block.querySelector('[data-qty-input]');
          var next = Math.max(1, Math.min(Number(input.value) + Number(qtyBtn.getAttribute('data-qty')),
            product.stock || 99));
          input.value = next;
          return;
        }
        var tab = e.target.closest('[data-tab]');
        if (tab) {
          var name = tab.getAttribute('data-tab');
          U.$$('[data-tab]', root).forEach(function (node) { node.classList.remove('is-active'); });
          U.$$('[data-panel]', root).forEach(function (node) { node.classList.remove('is-active'); });
          tab.classList.add('is-active');
          var panel = root.querySelector('[data-panel="' + name + '"]');
          if (panel) panel.classList.add('is-active');
          return;
        }
        var star = e.target.closest('[data-star]');
        if (star) {
          var value = Number(star.getAttribute('data-star'));
          var form = root.querySelector('[data-review-form]');
          if (!form) return;
          form.querySelector('[name="rating"]').value = value;
          U.$$('[data-star]', form).forEach(function (node) {
            node.firstChild.classList.toggle('is-on', Number(node.getAttribute('data-star')) <= value);
          });
          return;
        }
        var like = e.target.closest('[data-review-like]');
        if (like) {
          var result = db.likeReview(like.getAttribute('data-review-like'));
          if (result) {
            like.classList.toggle('text-accent', result.liked);
            like.innerHTML = BS.icon('thumbs-up', { size: 14 }) + 'Полезно · ' + result.likes;
          }
        }
      });

      root.addEventListener('submit', function (e) {
        var form = e.target.closest('[data-review-form]');
        if (!form) return;
        e.preventDefault();
        var user = BS.auth.user();
        if (!user) return;
        var data = new FormData(form);
        var result = db.addReview({
          productId: product.id,
          userId: user.id,
          author: user.name,
          email: user.email,
          rating: Number(data.get('rating')) || 5,
          text: data.get('text'),
          pros: data.get('pros'),
          cons: data.get('cons')
        });
        if (!result.ok) { L.toast(result.message, 'warn'); return; }
        L.toastOk(result.message, 'Отзыв принят');
        self.init();
      });
    }
  };
})();
