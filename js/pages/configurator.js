/* ==========================================================================
   ByteStore — ИИ-конфигуратор ПК: подбор под бюджет и ручная сборка
   Два режима: автоматический подбор (ИИ + встроенный экспертный движок) и
   ручная сборка с живой проверкой совместимости комплектующих.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout, ad = BS.advisor;
  var pages = (BS.pages = BS.pages || {});
  var MANUAL_KEY = 'manual-build';

  var ui = {
    tab: 'manual',
    prefs: {
      budget: 600000, purpose: 'gaming', resolution: '1440p',
      brandPref: 'any', cooler: 'auto',
      needMonitor: false, needPeripherals: false
    },
    build: {},
    result: null,
    manual: {},
    loading: false
  };

  pages.configurator = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      this.root = root;
      ui.manual = this.resolveBuild(U.storage.get(MANUAL_KEY, {}) || {});
      var params = U.qsAll();
      if (params.tab === 'manual') ui.tab = 'manual';
      ui.fromChat = params.from === 'chat';
      root.innerHTML = this.shell();
      this.syncTabs();
      this.render();
      this.wire();
      if (ui.fromChat) this.announceChatTransfer();
    },

    /** Приведение вкладок к состоянию ui.tab (используется при ?tab=manual). */
    syncTabs: function () {
      var root = this.root;
      U.$$('[data-cfg-tab]', root).forEach(function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-cfg-tab') === ui.tab);
      });
      U.$$('[data-cfg-panel]', root).forEach(function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-cfg-panel') === ui.tab);
      });
    },

    /** Сообщение о переносе сборки из чата. */
    announceChatTransfer: function () {
      var meta = U.storage.get('manual-build-meta', null);
      var count = Object.keys(ui.manual).length;
      if (count) {
        L.toastOk('Из чата перенесено ' + count + ' ' +
          U.plural(count, 'позиция', 'позиции', 'позиций') +
          '. Проверьте совместимость и добавьте сборку в корзину.', 'Комплектующие в конфигураторе');
      }
      if (meta && meta.skipped && meta.skipped.length) {
        L.toast('Не перенесено: ' + meta.skipped.slice(0, 2).join('; ') +
          (meta.skipped.length > 2 ? ' и ещё ' + (meta.skipped.length - 2) : ''), 'warn');
      }
      U.storage.remove('manual-build-meta');
      /* Убираем служебный параметр, чтобы баннер и тосты не повторялись при обновлении */
      U.setQs({ from: null, tab: ui.tab });
    },

    /** Восстановление сборки из localStorage: id → товар (удалённые пропускаем). */
    resolveBuild: function (stored) {
      var build = {};
      Object.keys(stored || {}).forEach(function (slot) {
        var product = db.product(stored[slot]);
        /* Корпус всегда хранится в ручной сборке под ключом 'case' */
        if (product) build[slot === 'pcCase' ? 'case' : slot] = product;
      });
      return build;
    },

    shell: function () {
      var status = BS.ai.status();
      return '<div class="container">' +
        C.breadcrumbs([{ label: 'Главная', href: 'index.html' }, { label: 'Конфигуратор ПК' }]) +
        '<div class="section-head mt-5">' +
        '<div><div class="kicker">' + BS.icon('tool', { size: 14 }) + ' Конфигуратор ByteStore</div>' +
        '<h1 style="font-size:var(--fs-2xl)">Соберите компьютер под свои задачи</h1>' +
        '<p>Выбирайте комплектующие вручную — совместимость сокета, памяти, блока питания и корпуса ' +
        'проверяется автоматически. Хотите сэкономить время? Нажмите «Доверить подбор ИИ».</p></div>' +
        '<span class="ai-badge' + (status.cls ? ' ' + status.cls : '') + '">' +
        BS.icon('robot', { size: 13 }) + ' ' + U.esc(status.label) + '</span></div>' +
        '<div class="tabs" data-cfg-tabs>' +
        '<button class="tab is-active" data-cfg-tab="manual">' + BS.icon('tool', { size: 16 }) +
        ' Ручная сборка</button></div>' +
        '<div class="tab-panel" data-cfg-panel="ai"><div id="cfgAi"></div></div>' +
        '<div class="tab-panel is-active" data-cfg-panel="manual"><div id="cfgManual"></div></div>' +
        '</div>';
    },

    render: function () {
      if (ui.tab === 'ai') this.renderAi(); else this.renderManual();
    },
    /* ----------------------------- Вкладка «ИИ» ----------------------------- */
    renderAi: function () {
      var host = U.$('#cfgAi');
      if (!host) return;
      var p = ui.prefs;
      host.innerHTML = '<div class="grid-2 mt-5">' +
        '<div class="card builder-form"><h3>Параметры подбора</h3>' +
        '<p class="muted small">Чем точнее описание — тем лучше сборка: учитываются задача, разрешение и запас бюджета.</p>' +
        '<div class="field"><label>Бюджет: <b data-cfg-budget-label>' + U.money(p.budget) + '</b></label>' +
        '<input type="range" min="200000" max="2000000" step="25000" value="' + p.budget + '" data-cfg-budget>' +
        '<div class="row gap-2 mt-2 wrap">' +
        [400000, 600000, 900000, 1300000].map(function (preset) {
          return '<button class="chip' + (p.budget === preset ? ' is-active' : '') +
            '" data-cfg-preset="' + preset + '">' + U.num(preset / 1000) + ' тыс ₸</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>Для чего нужен ПК</label><div class="row gap-2 wrap">' +
        ad.PURPOSES.map(function (item) {
          return '<button class="chip' + (p.purpose === item.id ? ' is-active' : '') +
            '" data-cfg-purpose="' + item.id + '" title="' + U.attr(item.hint) + '">' + item.emoji + ' ' +
            U.esc(item.label) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>Целевое разрешение</label><div class="row gap-2 wrap">' +
        ad.RESOLUTIONS.map(function (res) {
          return '<button class="chip' + (p.resolution === res.id ? ' is-active' : '') +
            '" data-cfg-resolution="' + res.id + '">🖥️ ' + U.esc(res.label) + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>Процессор</label><div class="row gap-2 wrap">' +
        [['any', 'Любой бренд'], ['intel', 'Intel'], ['amd', 'AMD']].map(function (pair) {
          return '<button class="chip' + (p.brandPref === pair[0] ? ' is-active' : '') +
            '" data-cfg-brand="' + pair[0] + '">' + pair[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>Охлаждение</label><div class="row gap-2 wrap">' +
        [['auto', 'Автоматически'], ['air', 'Воздушное'], ['liquid', 'СЖО']].map(function (pair) {
          return '<button class="chip' + (p.cooler === pair[0] ? ' is-active' : '') +
            '" data-cfg-cooler="' + pair[0] + '">' + pair[1] + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>Дополнительно</label>' +
        '<label class="switch mb-3"><input type="checkbox" data-cfg-monitor' + (p.needMonitor ? ' checked' : '') +
        '><span>Подобрать монитор</span></label>' +
        '<label class="switch mb-3"><input type="checkbox" data-cfg-peripherals' + (p.needPeripherals ? ' checked' : '') +
        '><span>Подобрать клавиатуру и мышь</span></label>' +
        '</div>' +
        '<div class="btn-group mt-5">' +
        '<button class="btn btn--primary btn--lg" data-cfg-run' + (ui.loading ? ' disabled' : '') + '>' +
        BS.icon('sparkles', { size: 18 }) + 'Подобрать сборку</button>' +
        '<button class="btn btn--outline" data-cfg-to-manual>Изменить вручную</button></div>' +
        '<p class="muted small mt-4">' + BS.icon('info', { size: 14 }) +
        ' Подбор выполняется автоматически: ByteStore собирает совместимую конфигурацию под ваш бюджет ' +
        'и объясняет выбор каждой детали.</p></div>' +
        '<div id="cfgResult">' + this.resultHtml() + '</div></div>';
    },
    /** Результат подбора: состав, обоснование, совместимость, прогноз. */
    resultHtml: function () {
      if (ui.loading) return '<div class="card">' + L.loading('Идёт подбор конфигурации…') + '</div>';
      if (!ui.result) {
        return '<div class="card">' + L.emptyState({
          emoji: '🧩', title: 'Сборка ещё не подобрана',
          text: 'Укажите бюджет и задачи слева и нажмите «Подобрать сборку» — конфигуратор соберёт совместимый ПК ' +
            'и объяснит выбор каждой детали.',
          action: '<button class="btn btn--primary" data-cfg-run>Подобрать сборку</button>'
        }) + '</div>';
      }
      var result = ui.result;
      var check = result.check;
      var overBudget = result.total > ui.prefs.budget;
      var budgetStatus = overBudget
        ? 'превышение бюджета на ' + U.money(result.total - ui.prefs.budget)
        : 'остаток ' + U.money(ui.prefs.budget - result.total);
      var complete = ad.buildIsComplete(result.build);
      var sourceLabel = result.source === 'ai'
        ? '<span class="ai-badge">' + BS.icon('robot', { size: 12 }) + ' ByteStore AI</span>'
        : '<span class="ai-badge">' + BS.icon('sparkles', { size: 12 }) + ' Подбор ByteStore</span>';
      var slots = ad.buildList(result.build).map(function (row) {
        var product = row.product;
        return '<div class="slot' + (product ? ' is-filled' : '') + '">' +
          '<span class="slot__icon">' + BS.icon(row.meta.icon, { size: 24 }) + '</span>' +
          '<span><span class="slot__label">' + U.esc(row.meta.label) + '</span>' +
          (product
            ? '<a class="slot__name" href="product.html?id=' + U.attr(product.id) + '">' +
              U.esc(product.name) + '</a><div class="muted small">' +
              U.esc((product.key || []).join(' · ')) + '</div>'
            : '<div class="slot__empty">Не подобрано</div>') + '</span>' +
          (product ? '<span class="slot__price">' + U.money(product.price) + '</span>' : '') + '</div>';
      }).join('');
      var extras = ['monitor', 'keyboard', 'mouse'].map(function (slot) {
        var product = result.build[slot];
        if (!product) return '';
        var labelMap = { monitor: 'Монитор', keyboard: 'Клавиатура', mouse: 'Мышь' };
        return '<div class="slot is-filled"><span class="slot__icon">' +
          BS.icon(slot === 'monitor' ? 'monitor' : 'keyboard', { size: 24 }) + '</span>' +
          '<span><span class="slot__label">' + labelMap[slot] + '</span>' +
          '<a class="slot__name" href="product.html?id=' + U.attr(product.id) + '">' + U.esc(product.name) +
          '</a></span><span class="slot__price">' + U.money(product.price) + '</span></div>';
      }).join('');
      return '<div class="card">' +
        '<div class="panel-head"><h3>Сборка ByteStore</h3>' + sourceLabel + '</div>' +
        '<div class="builder-slots">' + slots + extras + '</div>' +
        '<div class="summary-row summary-row--total"><span>Итого</span><span>' + U.money(result.total) +
        '</span></div>' +
        '<div class="muted small mb-4">Бюджет ' + U.money(ui.prefs.budget) + ' · ' + budgetStatus +
        ' · пиковое потребление ' + check.power.peak +
        ' Вт · рекомендуемый БП от ' + check.power.recommended + ' Вт</div>' +
        (overBudget ? '<div class="compat-note compat-note--warn mb-4">Сборка превышает лимит. Отключите монитор или периферию либо увеличьте бюджет.</div>' : '') +
        (result.comment ? '<div class="ai-answer mb-4"><h4>' + BS.icon('sparkles', { size: 16 }) +
          ' Заключение ИИ</h4><p>' + U.esc(result.comment) + '</p>' +
          (result.fps ? '<p class="small muted">Производительность: ' + U.esc(result.fps) + '</p>' : '') +
          (result.upgrade ? '<p class="small muted">Апгрейд: ' + U.esc(result.upgrade) + '</p>' : '') + '</div>' : '') +
        this.compatHtml(check) +
        '<div class="card card--flat mt-4"><h4>' + BS.icon('chart', { size: 17 }) +
        ' Прогноз производительности</h4>' +
        '<div class="grid-3 mt-3">' +
        '<div><div class="muted small">Разрешение</div><b>' + U.esc(result.estimate.resolution) + '</b></div>' +
        '<div><div class="muted small">Ожидаемый FPS</div><b>≈ ' + result.estimate.fps + '</b></div>' +
        '<div><div class="muted small">Ограничитель</div><b>' + U.esc(result.estimate.bottleneck.device) +
        '</b></div></div>' +
        '<p class="muted small mt-3">' + U.esc(result.estimate.level) + '</p>' +
        '<div class="row gap-2 wrap mt-2">' + result.estimate.tags.map(function (tag) {
          return '<span class="badge badge--accent">' + U.esc(tag) + '</span>';
        }).join('') + '</div></div>' +
        '<div class="btn-group mt-5">' +
        '<button class="btn btn--primary" data-cfg-add-all' + (overBudget || !complete ? ' disabled' : '') +
        '>Добавить сборку в корзину</button>' +
        '<button class="btn btn--outline" data-cfg-download>Скачать спецификацию</button>' +
        '</div></div>';
    },

    /** Блок проверки совместимости. */
    compatHtml: function (check) {
      var rows = '';
      if (check.ok) {
        rows += '<div class="compat-note compat-note--ok">✔️ Конфликтов нет: сокет, память, питание и габариты согласованы</div>';
      }
      check.errors.forEach(function (item) {
        rows += '<div class="compat-note compat-note--err">❌ ' + U.esc(item.text) + '</div>';
      });
      check.warnings.forEach(function (item) {
        rows += '<div class="compat-note compat-note--warn">⚠️ ' + U.esc(item.text) + '</div>';
      });
      check.notes.forEach(function (item) {
        rows += '<div class="compat-note compat-note--ok">ℹ️ ' + U.esc(item.text) + '</div>';
      });
      return '<div class="card card--flat"><h4>' + BS.icon('shield', { size: 17 }) +
        ' Проверка совместимости</h4><div class="col gap-2 mt-3">' + rows + '</div></div>';
    },
    /* --------------------------- Вкладка «Вручную» -------------------------- */
    renderManual: function () {
      var host = U.$('#cfgManual');
      if (!host) return;
      var self = this;
      var check = ad.checkCompatibility(ui.manual);
      var total = ad.buildTotal(ui.manual);
      var slots = ad.SLOTS.map(function (meta) {
        var product = ui.manual[meta.slot];
        var hasError = check.errors.some(function (err) {
          return err.slot === meta.slot || (err.slot === 'pcCase' && meta.slot === 'case');
        });
        return '<div class="slot' + (product ? ' is-filled' : '') + (hasError ? ' is-error' : '') + '">' +
          '<span class="slot__icon">' + BS.icon(meta.icon, { size: 24 }) + '</span>' +
          '<span><span class="slot__label">' + U.esc(meta.label) + (meta.required ? ' *' : '') + '</span>' +
          (product
            ? '<span class="slot__name">' + U.esc(product.name) + '</span><div class="muted small">' +
              U.esc((product.key || []).join(' · ')) + '</div>'
            : '<span class="slot__empty">Не выбрано — нажмите, чтобы добавить</span>') + '</span>' +
          '<span class="row gap-2 center">' +
          (product ? '<span class="slot__price">' + U.money(product.price) + '</span>' : '') +
          '<button class="btn btn--soft btn--sm" data-cfg-slot="' + meta.slot + '">' +
          (product ? 'Заменить' : 'Выбрать') + '</button>' +
          (product ? '<button class="btn btn--ghost btn--icon btn--sm" data-cfg-slot-remove="' + meta.slot +
            '" title="Убрать">' + BS.icon('x', { size: 16 }) + '</button>' : '') +
          '</span></div>';
      }).join('');

      /* Дополнительные устройства: монитор, клавиатура, мышь, гарнитура */
      var extras = ad.EXTRA_SLOTS.map(function (meta) {
        var extra = ui.manual[meta.slot];
        return '<div class="slot' + (extra ? ' is-filled' : '') + '">' +
          '<span class="slot__icon">' + BS.icon(meta.icon, { size: 24 }) + '</span>' +
          '<span><span class="slot__label">' + U.esc(meta.label) + '</span>' +
          (extra
            ? '<span class="slot__name">' + U.esc(extra.name) + '</span><div class="muted small">' +
              U.esc((extra.key || []).join(' · ')) + '</div>'
            : '<span class="slot__empty">Не выбрано</span>') + '</span>' +
          '<span class="row gap-2 center">' +
          (extra ? '<span class="slot__price">' + U.money(extra.price) + '</span>' : '') +
          '<button class="btn btn--soft btn--sm" data-cfg-slot="' + meta.slot + '">' +
          (extra ? 'Заменить' : 'Выбрать') + '</button>' +
          (extra ? '<button class="btn btn--ghost btn--icon btn--sm" data-cfg-slot-remove="' + meta.slot +
            '" title="Убрать">' + BS.icon('x', { size: 16 }) + '</button>' : '') +
          '</span></div>';
      }).join('');

      var coreCount = ad.SLOTS.filter(function (meta) { return !!ui.manual[meta.slot]; }).length;
      var extraCount = Object.keys(ui.manual).length - coreCount;
      var filled = Object.keys(ui.manual).length > 0;

      host.innerHTML = '<div class="builder-layout mt-5">' +
        '<div class="card builder-form">' +
        (ui.fromChat ? '<div class="alert alert--ok mb-4"><span class="alert__icon">🤖</span>' +
          '<div class="alert__body"><strong>Сборка перенесена из чата с ИИ</strong>' +
          '<p>Проверьте состав, при необходимости замените любую деталь, затем добавьте сборку в корзину. ' +
          'Совместимость пересчитывается автоматически.</p></div></div>' : '') +
        '<div class="panel-head"><h3>Компоненты сборки</h3>' +
        '<button class="btn btn--ghost btn--sm" data-cfg-manual-clear>Очистить</button></div>' +
        '<div class="builder-slots">' + slots + '</div>' +
        '<div class="panel-head mt-6"><h4>Дополнительные устройства</h4>' +
        '<span class="muted small">в корзину попадут вместе со сборкой</span></div>' +
        '<div class="builder-slots">' + extras + '</div>' +
        '<p class="muted small mt-4">Комплектующие выбираются из каталога ByteStore. Проверка совместимости ' +
        'обновляется автоматически: сокет, тип памяти, TDP охлаждения, мощность БП и габариты корпуса.</p>' +
        '</div>' +
        '<div><div class="card"><h3>Проверка сборки</h3>' +
        '<div class="summary-row"><span>Компонентов выбрано</span><b>' + coreCount + ' из ' + ad.SLOTS.length +
        (extraCount ? ' + ' + extraCount + ' доп.' : '') + '</b></div>' +
        '<div class="summary-row summary-row--total"><span>Стоимость</span><span>' + U.money(total) + '</span></div>' +
        '<div class="summary-row"><span>Пиковое потребление</span><b>' + check.power.peak + ' Вт</b></div>' +
        '<div class="summary-row"><span>Рекомендуемый БП</span><b>от ' + check.power.recommended + ' Вт</b></div>' +
        '<div class="summary-row"><span>Оценка производительности</span><b>≈ ' +
        ad.estimate(ui.manual, {}).fps + ' FPS</b></div>' +
        '<div class="col gap-2 mt-4">' + self.compatRows(check) + '</div>' +
        (filled && !ad.buildIsComplete(ui.manual)
          ? '<div class="compat-note compat-note--warn">Заполнены не все обязательные слоты. ' +
            'Можно добавить в корзину уже выбранное или добрать остальные компоненты.</div>' : '') +
        '<div class="btn-group mt-5">' +
        '<button class="btn btn--primary btn--block" data-cfg-manual-add' +
        (filled && check.ok && total ? '' : ' disabled') +
        '>Добавить сборку в корзину</button>' +
        '<button class="btn btn--outline btn--block" data-cfg-manual-ai>Доверить подбор ИИ</button>' +
        '</div></div></div></div>';
    },

    compatRows: function (check) {
      var rows = '';
      if (!Object.keys(ui.manual).length) {
        return '<div class="compat-note compat-note--warn">Выберите комплектующие — проверка начнётся автоматически</div>';
      }
      if (check.ok) rows += '<div class="compat-note compat-note--ok">✔️ Совместимость подтверждена</div>';
      check.errors.forEach(function (item) {
        rows += '<div class="compat-note compat-note--err">❌ ' + U.esc(item.text) + '</div>';
      });
      check.warnings.forEach(function (item) {
        rows += '<div class="compat-note compat-note--warn">⚠️ ' + U.esc(item.text) + '</div>';
      });
      check.notes.forEach(function (item) {
        rows += '<div class="compat-note compat-note--ok">ℹ️ ' + U.esc(item.text) + '</div>';
      });
      return rows;
    },
    /** Модальное окно выбора комплектующего для слота (включая доп. устройства). */
    openPicker: function (slot) {
      var self = this;
      var meta = ad.slotMeta(slot) || ad.extraMeta(slot);
      if (!meta) return;
      var products = ad.pickerCandidates(slot, meta.categoryId);
      var best = products.slice().sort(function (a, b) {
        return ad.valueRatio(b, 1) - ad.valueRatio(a, 1);
      })[0];
      var instance = L.modal({
        title: 'Выбор: ' + meta.label,
        size: 'wide',
        html: '<label class="input-icon mb-4">' + BS.icon('search', { size: 16 }) +
          '<input class="input" placeholder="Поиск по названию, бренду или характеристикам" data-picker-search></label>' +
          '<div class="pick-list" data-picker-list>' + this.pickerRows(products, best) + '</div>',
        footer: '<button class="btn" data-close>Закрыть</button>'
      });
      var list = instance.el.querySelector('[data-picker-list]');
      var search = instance.el.querySelector('[data-picker-search]');
      search.addEventListener('input', U.debounce(function () {
        var query = db.query({ q: search.value, category: meta.categoryId, perPage: 50 });
        var rows = query.all.filter(function (product) {
          if (slot === 'keyboard' || slot === 'mouse' || slot === 'headset') {
            return (product.specs && product.specs.kind) === slot;
          }
          return true;
        });
        list.innerHTML = self.pickerRows(rows, best);
      }, 200));
      instance.el.addEventListener('click', function (e) {
        var row = e.target.closest('[data-pick]');
        if (!row) return;
        var product = db.product(row.getAttribute('data-pick'));
        if (!product) return;
        ui.manual[slot] = product;
        self.saveManual();
        instance.close();
        self.renderManual();
        var check = ad.checkCompatibility(ui.manual);
        if (check.errors.length) L.toast('Добавлено с замечанием: ' + check.errors[0].text, 'warn');
        else L.toastOk(product.name + ' — добавлено в сборку');
      });
    },

    /** Строки списка выбора: подсвечиваем модель с лучшим соотношением цены и качества. */
    pickerRows: function (products, best) {
      if (!products.length) return '<p class="muted">Ничего не найдено</p>';
      var current = ui.manual;
      return products.map(function (p) {
        var selected = Object.keys(current).some(function (slot) { return current[slot].id === p.id; });
        return '<button class="pick' + (best && best.id === p.id ? ' is-rec' : '') + '" data-pick="' +
          U.attr(p.id) + '">' +
          '<span class="pick__body"><span class="pick__name">' + U.esc(p.name) + '</span>' +
          '<span class="pick__meta">' + U.esc((p.key || []).join(' · ')) + ' · ' + p.stock +
          ' шт.</span></span>' +
          (selected ? '<span class="badge badge--ok">в сборке</span>' : '') +
          (best && best.id === p.id ? '<span class="badge badge--accent">лучший выбор</span>' : '') +
          '<span class="pick__price">' + U.money(p.price) + '</span></button>';
      }).join('');
    },

    saveManual: function () {
      var ids = {};
      Object.keys(ui.manual).forEach(function (slot) { ids[slot] = ui.manual[slot].id; });
      U.storage.set(MANUAL_KEY, ids);
    },

    /** Добавление всей сборки в корзину. */
    addBuildToCart: function (build) {
      var count = 0, total = 0;
      Object.keys(build || {}).forEach(function (slot) {
        var product = build[slot];
        if (!product || !db.inStock(product)) return;
        db.addToCart(product.id, 1);
        count++;
        total += product.price;
      });
      L.refreshCounters();
      if (!count) { L.toast('В сборке нет товаров в наличии', 'warn'); return; }
      L.toastOk('Добавлено ' + count + ' ' + U.plural(count, 'позиция', 'позиции', 'позиций') +
        ' на ' + U.money(total), 'Сборка в корзине');
    },

    /** Запуск автоматического подбора конфигурации. */
    runAi: function () {
      var self = this;
      ui.loading = true;
      var host = U.$('#cfgResult');
      if (host) host.innerHTML = '<div class="card">' + L.loading('Подбираю конфигурацию…') + '</div>';
      BS.advisor.aiBuild(Object.assign({}, ui.prefs), { fast: true }).then(function (result) {
        ui.loading = false;
        ui.result = result;
        ui.build = result.build;
        self.renderAi();
        db.track('ai_build', { label: ui.prefs.purpose + '/' + ui.prefs.resolution, value: result.total });
      });
    },

    /** Скачивание спецификации сборки текстовым файлом. */
    downloadBuild: function (build, title) {
      var lines = ['ByteStore — ' + (title || 'спецификация сборки'), 'Дата: ' + U.date(Date.now(), true), ''];
      BS.advisor.buildList(build).forEach(function (row) {
        if (row.product) {
          lines.push(row.meta.label + ': ' + row.product.name + ' — ' + U.money(row.product.price) +
            ' (арт. ' + row.product.sku + ')');
        }
      });
      ['monitor', 'keyboard', 'mouse'].forEach(function (slot) {
        if (build[slot]) lines.push(slot + ': ' + build[slot].name + ' — ' + U.money(build[slot].price));
      });
      lines.push('');
      lines.push('ИТОГО: ' + U.money(ad.buildTotal(build)));
      var check = ad.checkCompatibility(build);
      lines.push('Пиковое потребление: ' + check.power.peak + ' Вт, рекомендуемый БП от ' + check.power.recommended + ' Вт');
      lines.push(check.ok ? 'Совместимость: проверена, конфликтов нет' : 'Совместимость: требуются правки');
      U.download('bytestore-build.txt', lines.join('\n'));
      L.toastOk('Спецификация сохранена', 'Готово');
    },
    /* ------------------------------ Обработчики ----------------------------- */
    wire: function () {
      var self = this;
      var root = this.root;

      root.addEventListener('click', function (e) {
        /* Переключение вкладок */
        var tab = e.target.closest('[data-cfg-tab]');
        if (tab) {
          ui.tab = tab.getAttribute('data-cfg-tab');
          U.$$('[data-cfg-tab]', root).forEach(function (node) { node.classList.remove('is-active'); });
          U.$$('[data-cfg-panel]', root).forEach(function (node) { node.classList.remove('is-active'); });
          tab.classList.add('is-active');
          var panel = root.querySelector('[data-cfg-panel="' + ui.tab + '"]');
          if (panel) panel.classList.add('is-active');
          self.render();
          return;
        }
        /* Копирование подобранной сборки в ручной режим */
        if (e.target.closest('[data-cfg-to-manual]')) {
          if (ui.result) {
            /* Сборка ИИ использует ключ pcCase — приводим к ключам ручного режима */
            ui.manual = {};
            Object.keys(ui.result.build || {}).forEach(function (slot) {
              var product = ui.result.build[slot];
              if (product) ui.manual[slot === 'pcCase' ? 'case' : slot] = product;
            });
            self.saveManual();
          }
          ui.tab = 'manual';
          self.render();
          U.$$('[data-cfg-tab]', root).forEach(function (node) {
            node.classList.toggle('is-active', node.getAttribute('data-cfg-tab') === 'manual');
          });
          U.$$('[data-cfg-panel]', root).forEach(function (node) {
            node.classList.toggle('is-active', node.getAttribute('data-cfg-panel') === 'manual');
          });
          L.toast('Сборку можно доработать вручную', 'info');
          return;
        }
        /* Параметры подбора */
        var preset = e.target.closest('[data-cfg-preset]');
        if (preset) { ui.prefs.budget = Number(preset.getAttribute('data-cfg-preset')); self.renderAi(); return; }
        var purpose = e.target.closest('[data-cfg-purpose]');
        if (purpose) { ui.prefs.purpose = purpose.getAttribute('data-cfg-purpose'); self.renderAi(); return; }
        var resolution = e.target.closest('[data-cfg-resolution]');
        if (resolution) { ui.prefs.resolution = resolution.getAttribute('data-cfg-resolution'); self.renderAi(); return; }
        var brand = e.target.closest('[data-cfg-brand]');
        if (brand) { ui.prefs.brandPref = brand.getAttribute('data-cfg-brand'); self.renderAi(); return; }
        var cooler = e.target.closest('[data-cfg-cooler]');
        if (cooler) { ui.prefs.cooler = cooler.getAttribute('data-cfg-cooler'); self.renderAi(); return; }

        if (e.target.closest('[data-cfg-run]')) { self.runAi(); return; }
        if (e.target.closest('[data-cfg-add-all]')) { self.addBuildToCart(ui.build); return; }
        if (e.target.closest('[data-cfg-download]')) {
          self.downloadBuild(ui.build, 'подбор под ' + ui.prefs.purpose + '/' + ui.prefs.resolution);
          return;
        }
        /* Ручной режим */
        var slotButton = e.target.closest('[data-cfg-slot]');
        if (slotButton) { self.openPicker(slotButton.getAttribute('data-cfg-slot')); return; }
        var removeSlot = e.target.closest('[data-cfg-slot-remove]');
        if (removeSlot) {
          delete ui.manual[removeSlot.getAttribute('data-cfg-slot-remove')];
          self.saveManual();
          self.renderManual();
          return;
        }
        if (e.target.closest('[data-cfg-manual-add]')) { self.addBuildToCart(ui.manual); return; }
        if (e.target.closest('[data-cfg-manual-ai]')) {
          ui.prefs.budget = Math.max(ad.buildTotal(ui.manual) || ui.prefs.budget, 200000);
          ui.tab = 'ai';
          self.render();
          U.$$('[data-cfg-tab]', root).forEach(function (node) {
            node.classList.toggle('is-active', node.getAttribute('data-cfg-tab') === 'ai');
          });
          U.$$('[data-cfg-panel]', root).forEach(function (node) {
            node.classList.toggle('is-active', node.getAttribute('data-cfg-panel') === 'ai');
          });
          self.runAi();
          return;
        }
        if (e.target.closest('[data-cfg-manual-clear]')) {
          ui.manual = {};
          self.saveManual();
          self.renderManual();
          L.toast('Сборка очищена', 'info');
        }
      });

      root.addEventListener('input', function (e) {
        if (e.target.closest('[data-cfg-budget]')) {
          ui.prefs.budget = Number(e.target.value);
          var label = root.querySelector('[data-cfg-budget-label]');
          if (label) label.textContent = U.money(ui.prefs.budget);
        }
      });
      root.addEventListener('change', function (e) {
        if (e.target.closest('[data-cfg-monitor]')) { ui.prefs.needMonitor = e.target.checked; }
        if (e.target.closest('[data-cfg-peripherals]')) { ui.prefs.needPeripherals = e.target.checked; }
      });
    }
  };
})();
