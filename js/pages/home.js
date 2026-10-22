/* ==========================================================================
   ByteStore — Главная страница: hero, категории, хиты, ИИ-блок, отзывы
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});

  pages.home = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      var productsCount = db.productsAll().length;
      var categoriesCount = db.categories().length;

      root.classList.add('home-page');
      root.innerHTML =
        this.hero(productsCount, categoriesCount) +
        this.features() +
        this.categoriesBlock(productsCount, categoriesCount) +
        this.hitsAndNew() +
        this.aiBlock() +
        this.readyBuilds() +
        this.reviewsBlock() +
        this.blogAndCta();

      this.wire(root);
    },

    hero: function (productsCount, categoriesCount) {
      var builds = db.byCategory('prebuilt');
      var featured = builds.filter(function (product) { return product.id === 'pc-gaming-pro'; })[0] || builds[0];
      var available = db.productsAll().filter(function (product) { return product.stock > 0; }).length;
      return '<section class="home-hero"><div class="container"><div class="home-hero__grid">' +
        '<div class="home-hero__copy"><span class="home-kicker">' + BS.icon('sparkles', { size: 15 }) +
        ' Комплектующие. Возможности. Ваш ПК.</span>' +
        '<h1>Больше мощности.<br><span class="grad-text">Больше вашего.</span></h1>' +
        '<p class="home-hero__lead">Для побед, больших идей и работы без пауз. Найдите нужную деталь ' +
        'или соберите компьютер под свои задачи — с проверкой совместимости.</p>' +
        '<div class="home-hero__actions">' +
        '<a class="btn btn--primary btn--lg" href="catalog.html">Перейти в каталог ' +
        BS.icon('arrow-right', { size: 18 }) + '</a>' +
        '<a class="btn btn--outline btn--lg" href="configurator.html">' + BS.icon('tool', { size: 18 }) + 'Собрать свой ПК</a></div>' +
        '<div class="home-hero__facts">' +
        '<div><strong>' + productsCount + '</strong><span>товаров в каталоге</span></div>' +
        '<div><strong>' + categoriesCount + '</strong><span>категорий</span></div>' +
        '<div><strong>' + available + '</strong><span>позиций в наличии</span></div></div></div>' +
        (featured ? '<a class="home-showcase" href="product.html?id=' + U.attr(featured.id) + '">' +
          '<div class="home-showcase__head"><span>Готов к следующему уровню</span>' +
          '<span class="home-showcase__label">ByteStore PC</span></div>' +
          '<div class="home-showcase__art">' + BS.art(featured) + '</div>' +
          '<div class="home-showcase__info"><div><span class="home-kicker">Готовая сборка</span>' +
          '<h2>' + U.esc(featured.name.replace(/^Игровой ПК /, '').split(':')[0]) + '</h2>' +
          '<p>' + U.esc((featured.key || []).slice(0, 3).join(' / ')) + '</p></div>' +
          '<div class="home-showcase__price"><strong>' + U.money(featured.price) + '</strong>' +
          '<span>Подробнее ' + BS.icon('arrow-right', { size: 16 }) + '</span></div></div></a>' : '') +
        '</div></div></section>';
    },

    features: function () {
      var items = [
        { icon: 'check-circle', title: 'Детали подружатся', text: 'Проверяем совместимость вашей сборки.' },
        { icon: 'truck', title: 'Бережная доставка', text: 'По Алматы, Астане и всему Казахстану.' },
        { icon: 'shield', title: 'Гарантия до 3 лет', text: 'Поможем с диагностикой и обращением.' },
        { icon: 'robot', title: 'Помощь с выбором', text: 'Подберём комплектующие под ваш бюджет.' }
      ];
      return '<section class="home-services" aria-label="Преимущества ByteStore"><div class="container">' +
        '<div class="home-services__grid">' + items.map(function (item) {
          return '<div class="home-service"><span class="home-service__icon">' + BS.icon(item.icon, { size: 22 }) +
            '</span><div><h3>' + U.esc(item.title) + '</h3><p>' + U.esc(item.text) + '</p></div></div>';
        }).join('') + '</div></div></section>';
    },

    categoriesBlock: function (productsCount, categoriesCount) {
      return '<section class="section home-categories"><div class="container">' +
        L.sectionHead('Всё для вашего ПК', 'Начните с нужной детали',
          productsCount + ' товаров в ' + categoriesCount + ' категориях. От первого апгрейда до новой сборки.',
          '<a class="btn btn--outline btn--sm" href="catalog.html">Весь каталог ' + BS.icon('arrow-right', { size: 16 }) + '</a>') +
        '<div class="home-categories__grid">' + db.categories().map(function (category) {
          var products = db.byCategory(category.id);
          var minPrice = products.length ? Math.min.apply(null, products.map(function (product) { return product.price; })) : 0;
          return '<a class="home-category" href="catalog.html?category=' + U.attr(category.id) + '">' +
            '<span class="home-category__icon">' + BS.icon(category.icon, { size: 25 }) + '</span>' +
            '<span class="home-category__body"><strong>' + U.esc(category.name) + '</strong>' +
            '<span>' + products.length + ' ' + U.plural(products.length, 'товар', 'товара', 'товаров') +
            (minPrice ? ' · от ' + U.money(minPrice) : '') + '</span></span>' +
            BS.icon('arrow-right', { size: 16, cls: 'home-category__arrow' }) + '</a>';
        }).join('') +
        '<a class="home-category home-category--builder" href="configurator.html">' +
        '<span class="home-category__icon">' + BS.icon('sparkles', { size: 25 }) + '</span>' +
        '<span class="home-category__body"><strong>Собрать всё вместе</strong><span>Открыть конфигуратор</span></span>' +
        BS.icon('arrow-right', { size: 16, cls: 'home-category__arrow' }) + '</a>' +
        '</div></div></section>';
    },

    hitsAndNew: function () {
      var hits = db.recommended(4);
      var fresh = db.newArrivals(4);
      return '<section class="section home-products"><div class="container">' +
        L.sectionHead('Проверенный выбор', 'В центре внимания',
          'Популярные комплектующие для следующего апгрейда.',
          '<a class="btn btn--outline btn--sm" href="catalog.html?sort=popular">Все популярные</a>') +
        C.grid(hits) +
        '<div class="home-new-arrivals">' + L.sectionHead('Новинки', 'Только что поступило',
          'Свежие поступления склада ByteStore.') + C.grid(fresh) + '</div>' +
        '</div></section>';
    },
    /* ------------------- Живой блок ИИ-подбора на главной ------------------- */
    aiBlock: function () {
      return '<section class="section home-advisor"><div class="container"><div class="home-advisor__panel">' +
        '<div class="home-advisor__intro"><span class="home-kicker">' + BS.icon('sparkles', { size: 15 }) + ' Конфигуратор ByteStore</span>' +
        '<h2>Ваши задачи.<br>Наша сборка.</h2>' +
        '<p>Игры, работа или творчество — подберём совместимые детали в пределах бюджета и объясним выбор.</p>' +
        '<a href="configurator.html" class="home-text-link">Настроить каждую деталь ' + BS.icon('arrow-right', { size: 16 }) + '</a>' +
        '<div class="home-advisor__note">' + BS.icon('check-circle', { size: 19 }) +
        '<span>Сокет, память, питание и габариты проверяются автоматически</span></div></div>' +
        '<div class="home-advisor__form"><div class="field"><span class="label">Для чего нужен компьютер?</span>' +
        '<div class="home-advisor__chips" data-home-purposes>' +
        BS.advisor.PURPOSES.map(function (purpose) {
          return '<button type="button" class="chip' + (purpose.id === 'gaming' ? ' is-active' : '') +
            '" aria-pressed="' + (purpose.id === 'gaming' ? 'true' : 'false') + '" data-home-purpose="' + purpose.id + '">' + U.esc(purpose.label) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><span class="label">Разрешение экрана</span>' +
        '<div class="home-advisor__chips" data-home-resolutions>' +
        BS.advisor.RESOLUTIONS.map(function (resolution) {
          return '<button type="button" class="chip' + (resolution.id === '1080p' ? ' is-active' : '') +
            '" aria-pressed="' + (resolution.id === '1080p' ? 'true' : 'false') + '" data-home-resolution="' + resolution.id + '">' + U.esc(resolution.label) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field home-advisor__budget"><label class="label" for="homeBudget">Ваш бюджет</label>' +
        '<strong data-home-budget-label>600 000 ₸</strong>' +
        '<input type="range" id="homeBudget" min="200000" max="2000000" step="25000" value="600000" data-home-budget>' +
        '<div class="home-advisor__range"><span>200 000 ₸</span><span>2 000 000 ₸</span></div></div>' +
        '<button class="btn btn--primary btn--block" data-home-build>' + BS.icon('sparkles', { size: 18 }) +
        'Подобрать мою сборку</button></div></div>' +
        '<div class="card mt-5" id="homeBuildResult" hidden></div></div></section>';
    },
    /** Запуск подбора и отрисовка результата прямо на главной странице. */
    renderHomeBuild: function () {
      var root = U.$('#homeBuildResult');
      if (!root) return;
      var budget = Number(U.$('[data-home-budget]').value);
      var activeChip = U.$('[data-home-purpose].is-active');
      var purpose = activeChip ? activeChip.getAttribute('data-home-purpose') : 'universal';
      var activeResolution = U.$('[data-home-resolution].is-active');
      var resolution = activeResolution ? activeResolution.getAttribute('data-home-resolution') : '1080p';
      root.hidden = false;
      root.innerHTML = L.loading('Подбираю совместимые комплектующие…');
      var started = Date.now();
      BS.advisor.aiBuild({ budget: budget, purpose: purpose, resolution: resolution }, { fast: true }).then(function (result) {
        var rows = BS.advisor.buildList(result.build).filter(function (row) {
          return row.product;
        }).map(function (row) {
          return '<div class="order-line"><span>' + BS.icon(row.meta.icon, { size: 15 }) + ' ' +
            U.esc(row.meta.label) + ' — <a href="product.html?id=' + U.attr(row.product.id) + '">' +
            U.esc(row.product.name) + '</a></span><b>' + U.money(row.product.price) + '</b></div>';
        }).join('');
        var extra = '';
        ['monitor', 'keyboard', 'mouse'].forEach(function (slot) {
          var item = result.build[slot];
          if (item) {
            extra += '<div class="order-line"><span>' + U.esc(item.name) + '</span><b>' +
              U.money(item.price) + '</b></div>';
          }
        });
        var sourceLabel = result.source === 'ai'
          ? '<span class="ai-badge">' + BS.icon('robot', { size: 12 }) + ' ByteStore AI</span>'
          : '<span class="ai-badge">' + BS.icon('sparkles', { size: 12 }) + ' Подбор ByteStore</span>';
        root.innerHTML = '<div class="panel-head"><h3>Персональная сборка ByteStore</h3>' +
          sourceLabel + '</div>' +
          '<div class="grid-2">' +
          '<div><div class="between mb-4"><b>Состав сборки</b>' +
          '<span class="muted small">бюджет ' + U.money(budget) + '</span></div>' +
          rows + extra +
          '<div class="summary-row summary-row--total"><span>Итого</span><span>' + U.money(result.total) + '</span></div>' +
          '<div class="muted small">Остаток бюджета: ' + U.money(Math.max(budget - result.total, 0)) + '</div></div>' +
          '<div class="col gap-4">' +
          '<div class="ai-answer"><h4>' + BS.icon('sparkles', { size: 16 }) + ' Что получилось</h4>' +
          '<p>' + U.esc(result.comment || result.estimate.summary) + '</p>' +
          (result.fps ? '<p class="small muted">Прогноз: ' + U.esc(result.fps) + '</p>' : '') +
          (result.upgrade ? '<p class="small muted">Апгрейд в будущем: ' + U.esc(result.upgrade) + '</p>' : '') + '</div>' +
          '<div class="ai-answer"><h4>' + BS.icon('check-circle', { size: 16 }) + ' Проверка совместимости</h4>' +
          (result.check.errors.length
            ? result.check.errors.map(function (err) {
                return '<div class="compat-note compat-note--err">' + U.esc(err.text) + '</div>';
              }).join('')
            : '<div class="compat-note compat-note--ok">Ошибок нет: сокет, память, БП и габариты согласованы</div>') +
          (result.check.warnings || []).map(function (warn) {
            return '<div class="compat-note compat-note--warn">' + U.esc(warn.text) + '</div>';
          }).join('') +
          '<div class="muted small mt-3">Пиковое потребление ' + result.check.power.peak +
          ' Вт · рекомендуемый БП от ' + result.check.power.recommended + ' Вт · подбор за ' +
          (Math.round((Date.now() - started) / 100) / 10) + ' с</div></div>' +
          '<div class="btn-group">' +
          '<button class="btn btn--primary" data-home-to-cart>Добавить сборку в корзину</button>' +
          '<a class="btn btn--outline" href="configurator.html">Открыть конфигуратор</a>' +
          '</div></div></div>';
        var toCart = root.querySelector('[data-home-to-cart]');
        if (toCart) {
          toCart.addEventListener('click', function () {
            var count = 0;
            Object.keys(result.build).forEach(function (slot) {
              var item = result.build[slot];
              if (item && db.inStock(item)) { db.addToCart(item.id, 1); count++; }
            });
            L.refreshCounters();
            L.toastOk('Добавлено позиций: ' + count + ' на ' + U.money(result.total), 'Сборка в корзине');
          });
        }
        db.track('ai_build', { label: purpose, value: result.total });
      }).catch(function () {
        root.innerHTML = '<div class="alert alert--danger"><span class="alert__icon">⚠️</span>' +
          '<div class="alert__body"><strong>Не удалось подобрать сборку</strong>' +
          '<p>Попробуйте ещё раз или откройте конфигуратор.</p></div></div>';
      });
    },
    /* -------------------------- Готовые сборки ------------------------------ */
    readyBuilds: function () {
      var ready = db.byCategory('prebuilt').slice(0, 3);
      if (!ready.length) return '';
      return '<section class="section section--tight home-ready-builds"><div class="container">' +
        L.sectionHead('Готовые решения', 'Собрано, протестировано, готово к работе',
          'Специалисты ByteStore собирают ПК, устанавливают драйверы и тестируют под нагрузкой 24 часа.',
          '<a class="btn btn--outline btn--sm" href="catalog.html?category=prebuilt">Все сборки</a>') +
        C.grid(ready) + '</div></section>';
    },

    reviewsBlock: function () {
      var reviews = db.reviews({ status: 'published', sort: 'likes', limit: 6 });
      if (!reviews.length) return '';
      return '<section class="section section--tight"><div class="container">' +
        L.sectionHead('Отзывы', 'Что говорят покупатели',
          'Средняя оценка ' + (db.analytics(90).avgRating || '4.7') + ' из 5 по ' +
          db.reviews({ status: 'published' }).length + ' отзывам покупателей ByteStore.') +
        '<div class="grid-3">' + reviews.map(function (r) {
          return '<div class="card">' + C.review(r, {
            actions: '<a class="small" href="product.html?id=' + U.attr(r.productId) + '">К товару →</a>'
          }) + '</div>';
        }).join('') + '</div></div></section>';
    },

    blogAndCta: function () {
      return '<section class="section"><div class="container"><div class="grid-2">' +
        '<div class="card"><h3>Гид по сборке ПК</h3>' +
        '<p class="muted">Коротко о том, как выбрать комплектующие и не переплатить.</p>' +
        '<div class="col gap-3 mt-4">' +
        '<a href="configurator.html">Как подобрать процессор к материнской плате →</a>' +
        '<a href="catalog.html?category=psu">Сколько ватт нужно блоку питания →</a>' +
        '<a href="catalog.html?category=ram">DDR4 или DDR5: что выбрать в 2026 году →</a>' +
        '<a href="catalog.html?category=gpu">Видеокарта для 1080p, 1440p и 4K →</a>' +
        '</div></div>' +
        '<div class="card"><h3>Поддержка покупателей</h3>' +
        '<p class="muted">ИИ-ассистент отвечает мгновенно, инженеры — в рабочее время.</p>' +
        '<div class="col gap-3 mt-4">' +
        '<div class="between"><span>Телефон</span><b>' + U.APP.phone + '</b></div>' +
        '<div class="between"><span>E-mail</span><b>' + U.APP.email + '</b></div>' +
        '<div class="between"><span>Режим работы</span><b>' + U.APP.workHours + '</b></div>' +
        '<div class="between"><span>Магазин</span><b>' + U.APP.address + '</b></div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="cta-banner home-account-cta mt-6"><div><span class="home-kicker">Личный кабинет</span><h2>Всё о ваших покупках — в одном месте</h2>' +
        '<p>Создайте аккаунт, чтобы оформлять заказы, следить за их статусом и делиться отзывами.</p></div>' +
        '<div class="col gap-3"><a class="btn btn--primary" href="register.html">Создать аккаунт</a>' +
        '<a class="btn btn--outline" href="login.html">У меня уже есть аккаунт</a></div></div>' +
        '</div></section>';
    },

    /* ------------------------------- Обработчики ---------------------------- */
    wire: function (root) {
      var budgetInput = root.querySelector('[data-home-budget]');
      var label = root.querySelector('[data-home-budget-label]');
      if (budgetInput) {
        budgetInput.addEventListener('input', function () { label.textContent = U.money(budgetInput.value); });
      }
      root.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-home-purpose]');
        if (chip) {
          U.$$('[data-home-purpose]').forEach(function (node) {
            node.classList.remove('is-active');
            node.setAttribute('aria-pressed', 'false');
          });
          chip.classList.add('is-active');
          chip.setAttribute('aria-pressed', 'true');
          return;
        }
        var resolution = e.target.closest('[data-home-resolution]');
        if (resolution) {
          U.$$('[data-home-resolution]').forEach(function (node) {
            node.classList.remove('is-active');
            node.setAttribute('aria-pressed', 'false');
          });
          resolution.classList.add('is-active');
          resolution.setAttribute('aria-pressed', 'true');
          return;
        }
        if (e.target.closest('[data-home-build]')) pages.home.renderHomeBuild();
      });
    }
  };
})();
