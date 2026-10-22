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
      var stats = db.analytics(30);
      var productsCount = db.productsAll().length;
      var categoriesCount = db.categories().length;

      root.innerHTML =
        this.hero(stats, productsCount, categoriesCount) +
        this.features() +
        '<section class="section section--tight"><div class="container">' +
        L.sectionHead('Каталог', 'Выберите категорию комплектующих',
          'Более ' + productsCount + ' позиций в ' + categoriesCount + ' категориях: от бюджетных сборок до 4K-станций.',
          '<a class="btn btn--outline btn--sm" href="catalog.html">Весь каталог ' +
          BS.icon('arrow-right', { size: 16 }) + '</a>') +
        '<div class="grid-auto">' + db.categories().map(function (c) { return C.categoryTile(c); }).join('') +
        '</div></div></section>' +
        this.hitsAndNew() +
        this.aiBlock() +
        this.readyBuilds() +
        this.reviewsBlock() +
        this.blogAndCta();

      this.wire(root, stats);
    },

    hero: function (stats, productsCount, categoriesCount) {
      var top = db.recommended(1)[0];
      return '<section class="hero"><div class="container"><div class="hero__grid">' +
        '<div><span class="hero__eyebrow">' + BS.icon('sparkles', { size: 14 }) +
        ' ИИ-подбор комплектующих</span>' +
        '<h1>Соберите идеальный компьютер <span class="grad-text">за пару минут</span></h1>' +
        '<p class="hero__lead">ByteStore — магазин компьютерных комплектующих с интеллектуальным конфигуратором. ' +
        'Искусственный интеллект подберёт процессор, видеокарту и память под ваш бюджет и задачи, ' +
        'автоматически проверит совместимость сокетов, тип памяти и мощность блока питания.</p>' +
        '<div class="hero__cta">' +
        '<a class="btn btn--primary btn--lg" href="configurator.html">' +
        BS.icon('tool', { size: 18 }) + 'Открыть конфигуратор</a>' +
        '<a class="btn btn--outline btn--lg" href="catalog.html">Смотреть каталог</a>' +
        '</div>' +
        '<div class="hero__stats">' +
        '<div class="hero__stat"><strong>' + productsCount + '</strong><span>товаров на складе</span></div>' +
        '<div class="hero__stat"><strong>' + categoriesCount + '</strong><span>категорий</span></div>' +
        '<div class="hero__stat"><strong>' + U.num(stats.itemsSold) + '</strong><span>продано за 30 дней</span></div>' +
        '<div class="hero__stat"><strong>' + (stats.avgRating || '4.7') + '★</strong><span>средняя оценка</span></div>' +
        '</div></div>' +
        '<div class="hero__visual"><div class="hero-card">' +
        '<div class="between mb-4"><b>Пример подбора ИИ</b><span class="ai-badge">' +
        BS.icon('robot', { size: 12 }) + ' ByteStore AI</span></div>' +
        (top ? '<div class="hero-card__row"><span>Хит продаж</span><b>' + U.esc(top.name.slice(0, 34)) + '…</b></div>' : '') +
        '<div class="hero-card__row"><span>Бюджет покупателя</span><b>600 000 ₸</b></div>' +
        '<div class="hero-card__row"><span>Задача</span><b>Игры в 1440p</b></div>' +
        '<div class="hero-card__row"><span>Совместимость</span><b class="text-ok">проверена ✓</b></div>' +
        '<div class="hero-card__row"><span>Пиковое потребление</span><b>292 Вт</b></div>' +
        '<div class="hero-card__row"><span>Блок питания</span><b>750 Вт (запас 122 %)</b></div>' +
        '<div class="hero-card__row"><span>Прогноз</span><span class="hero-card__tag">≈ 87 FPS в 1440p</span></div>' +
        '<a class="btn btn--soft btn--block mt-4" href="configurator.html">Собрать так же</a>' +
        '</div></div>' +
        '</div></div></section>';
    },

    features: function () {
      var items = [
        { icon: 'robot', title: 'ИИ-конфигуратор', text: 'Нейросеть объясняет выбор каждой детали и следит за совместимостью.' },
        { icon: 'shield', title: 'Проверка совместимости', text: 'Сокет, DDR4/DDR5, мощность БП и габариты корпуса — 10 правил.' },
        { icon: 'truck', title: 'Доставка 1–2 дня', text: 'Своя логистика по Алматы и Астане, 90+ пунктов выдачи.' },
        { icon: 'award', title: 'Гарантия до 3 лет', text: 'Официальные поставки и бесплатная диагностика при обращении.' }
      ];
      return '<section class="section section--tight"><div class="container"><div class="grid-4">' +
        items.map(function (item) {
          return '<div class="feature reveal"><span class="feature__icon">' + BS.icon(item.icon, { size: 26 }) + '</span>' +
            '<h4>' + U.esc(item.title) + '</h4><p>' + U.esc(item.text) + '</p></div>';
        }).join('') + '</div></div></section>';
    },

    hitsAndNew: function () {
      var hits = db.recommended(8);
      var fresh = db.newArrivals(4);
      return '<section class="section section--tight"><div class="container">' +
        L.sectionHead('Хиты продаж', 'Чаще всего покупают',
          'Товары с лучшими отзывами и стабильным спросом за последние месяцы.',
          '<a class="btn btn--outline btn--sm" href="catalog.html?sort=popular">Все популярные</a>') +
        C.grid(hits) +
        '<div class="mt-8">' + L.sectionHead('Новинки', 'Только что поступило',
          'Свежие поступления склада ByteStore.') + C.grid(fresh) + '</div>' +
        '</div></section>';
    },
    /* ------------------- Живой блок ИИ-подбора на главной ------------------- */
    aiBlock: function () {
      return '<section class="section"><div class="container"><div class="cta-banner">' +
        '<div><span class="hero__eyebrow">' + BS.icon('robot', { size: 14 }) + ' Демонстрация ИИ</span>' +
        '<h2>Опишите задачу — ассистент соберёт конфигурацию</h2>' +
        '<p>Выберите бюджет и назначение ПК — ByteStore подберёт совместимые комплектующие и объяснит ' +
        'выбор каждой детали: сокеты, тип памяти, мощность блока питания и габариты корпуса проверяются автоматически.</p>' +
        '<div class="row gap-3 wrap mt-5" data-home-purposes>' +
        BS.advisor.PURPOSES.map(function (p) {
          return '<button class="chip' + (p.id === 'gaming' ? ' is-active' : '') + '" data-home-purpose="' +
            p.id + '">' + p.emoji + ' ' + U.esc(p.label) + '</button>';
        }).join('') + '</div>' +
        '<div class="field mt-4"><span class="label">Целевое разрешение</span>' +
        '<div class="row gap-2 wrap" data-home-resolutions>' +
        BS.advisor.RESOLUTIONS.map(function (res) {
          return '<button class="chip' + (res.id === '1080p' ? ' is-active' : '') +
            '" data-home-resolution="' + res.id + '">🖥️ ' + U.esc(res.label) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="row gap-4 wrap mt-5 center">' +
        '<div style="min-width:280px;flex:1 1 280px">' +
        '<label class="label" for="homeBudget">Бюджет: <b data-home-budget-label>600 000 ₸</b></label>' +
        '<input type="range" id="homeBudget" min="200000" max="2000000" step="25000" value="600000" data-home-budget></div>' +
        '<button class="btn btn--primary" data-home-build>' + BS.icon('sparkles', { size: 18 }) +
        'Подобрать сборку</button></div></div>' +
        '<div class="cta-banner__art">🤖</div>' +
        '</div>' +
        '<div class="card mt-5" id="homeBuildResult" hidden></div>' +
        '</div></section>';
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
      return '<section class="section section--tight"><div class="container">' +
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
          db.reviews({ status: 'published' }).length + ' отзывам. Все отзывы проходят модерацию в админ-панели.') +
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
        '<div class="cta-banner mt-6"><div><h2>Зарегистрируйтесь и получите 10 000 бонусов</h2>' +
        '<p>Личный кабинет хранит историю заказов, отзывы и избранное. Бонусами можно оплатить до 30 % заказа.</p></div>' +
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
          U.$$('[data-home-purpose]').forEach(function (node) { node.classList.remove('is-active'); });
          chip.classList.add('is-active');
          return;
        }
        var resolution = e.target.closest('[data-home-resolution]');
        if (resolution) {
          U.$$('[data-home-resolution]').forEach(function (node) { node.classList.remove('is-active'); });
          resolution.classList.add('is-active');
          return;
        }
        if (e.target.closest('[data-home-build]')) pages.home.renderHomeBuild();
      });
    }
  };
})();
