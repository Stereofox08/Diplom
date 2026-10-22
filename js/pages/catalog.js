/* ==========================================================================
   ByteStore — Каталог: фильтры, сортировка, пагинация, поиск
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});
  var PER_PAGE = 12;

  pages.catalog = {
    filter: null,
    filtersOpen: false,

    init: function () {
      var params = U.qsAll();
      this.filter = {
        q: params.q || '',
        category: params.category || '',
        brands: params.brand ? String(params.brand).split(',') : [],
        min: params.min ? Number(params.min) : 0,
        max: params.max ? Number(params.max) : 0,
        sort: params.sort || '',
        page: Number(params.page) || 1,
        inStock: params.stock === '1',
        onlyDiscount: params.discount === '1'
      };
      var root = U.$('#pageContent');
      if (!root) return;
      this.filtersOpen = false;
      this.filterMedia = window.matchMedia('(max-width: 1080px)');
      var title = this.filter.q ? 'Результаты поиска: «' + U.esc(this.filter.q) + '»'
        : this.filter.category ? U.esc((db.category(this.filter.category) || {}).name || 'Каталог')
          : 'Все комплектующие';
      root.innerHTML =
        '<div class="container">' + C.breadcrumbs([
          { label: 'Главная', href: 'index.html' },
          { label: this.filter.category ? (db.category(this.filter.category) || {}).name || 'Каталог' : 'Каталог' }
        ]) +
        '<div class="section-head mt-5 catalog-heading">' +
        '<div><div class="kicker">' + BS.icon('grid', { size: 14 }) + ' Каталог ByteStore</div>' +
        '<h1 style="font-size:var(--fs-2xl)">' + title + '</h1>' +
        '<p>' + (this.filter.category
          ? U.esc((db.category(this.filter.category) || {}).description || '')
          : 'Фильтруйте по категории, бренду, цене и наличию. Подобрать совместимую сборку поможет ИИ-конфигуратор.') +
        '</p></div>' +
        '<div class="btn-group">' +
        '<a class="btn btn--outline btn--sm" href="configurator.html">' + BS.icon('sparkles', { size: 16 }) +
        'Собрать ПК</a></div></div>' +
        '<div class="catalog-layout">' +
        '<div class="catalog-filter-column">' +
        '<button class="catalog-filter-toggle" type="button" data-filters-toggle ' +
        'aria-controls="catalogFilters" aria-expanded="false">' +
        BS.icon('sliders', { size: 18 }) + '<span>Фильтры</span>' +
        '<span class="catalog-filter-toggle__count" data-filter-count hidden></span>' +
        '<span class="catalog-filter-toggle__chevron">' + BS.icon('chevron-down', { size: 18 }) + '</span></button>' +
        '<aside class="card card--pad-sm filters" id="catalogFilters" aria-label="Фильтры каталога"></aside></div>' +
        '<div class="catalog-results"><div class="catalog-toolbar" id="catalogToolbar"></div>' +
        '<div class="active-filters" id="activeFilters"></div>' +
        '<div id="catalogGrid"></div>' +
        '<div id="catalogPagination"></div></div>' +
        '</div></div>';
      this.render();
      this.wire(root);
      var self = this;
      this.filterMedia.addEventListener('change', function () { self.syncFilterPanel(); });
    },
    render: function () {
      var self = this;
      var focused = document.activeElement;
      var focusAttr = focused && focused.getAttributeNames ? focused.getAttributeNames().filter(function (name) {
        return name.indexOf('data-filter') === 0;
      })[0] : '';
      var focusValue = focusAttr ? focused.getAttribute(focusAttr) : '';
      var selectionStart = focusAttr === 'data-filter-q' ? focused.selectionStart : null;
      var result = db.query(Object.assign({}, this.filter, { perPage: PER_PAGE }));
      var facets = db.facets(this.filter);

      /* --------------------------- Сайдбар фильтров --------------------------- */
      var categoryItems = facets.categories.map(function (cat) {
        return '<button class="filters__item' + (self.filter.category === cat.value ? ' is-active' : '') +
          '" data-filter-category="' + U.attr(cat.value) + '">' +
          '<span>' + cat.emoji + ' ' + U.esc(cat.name) + '</span>' +
          '<span class="filters__count">' + cat.count + '</span></button>';
      }).join('');
      var brandItems = facets.brands.map(function (brand) {
        var checked = self.filter.brands.indexOf(brand.value) !== -1;
        return '<label class="check"><input type="checkbox" data-filter-brand="' + U.attr(brand.value) + '"' +
          (checked ? ' checked' : '') + '><span class="grow">' + U.esc(brand.value) + '</span>' +
          '<span class="filters__count">' + brand.count + '</span></label>';
      }).join('');
      U.$('#catalogFilters').innerHTML =
        '<div class="panel-head"><b>Фильтры</b>' +
        '<button class="btn btn--ghost btn--xs" data-filters-reset>Сбросить</button></div>' +
        '<div class="filters__group"><div class="filters__title">Категории</div>' +
        '<div class="filters__list">' +
        '<button class="filters__item' + (!this.filter.category ? ' is-active' : '') + '" data-filter-category="">' +
        '<span>Все категории</span><span class="filters__count">' + db.productsAll().length + '</span></button>' +
        categoryItems + '</div></div>' +
        '<div class="filters__group"><div class="filters__title">Цена, ₸</div>' +
        '<div class="catalog-price-range"><input class="input input--sm" type="number" min="0" aria-label="Цена от, тенге" placeholder="от ' + facets.priceMin +
        '" value="' + (this.filter.min || '') + '" data-filter-min>' +
        '<input class="input input--sm" type="number" min="0" aria-label="Цена до, тенге" placeholder="до ' + facets.priceMax + '" value="' +
        (this.filter.max || '') + '" data-filter-max></div>' +
        '<button class="btn btn--soft btn--sm btn--block mt-3" data-filter-price>Применить цену</button></div>' +
        (brandItems ? '<div class="filters__group"><div class="filters__title">Бренды</div>' +
          '<div class="filters__list">' + brandItems + '</div></div>' : '') +
        '<div class="filters__group"><div class="filters__title">Наличие</div>' +
        '<label class="switch"><input type="checkbox" data-filter-stock' + (this.filter.inStock ? ' checked' : '') +
        '><span>Только в наличии</span></label>' +
        '<label class="switch mt-3"><input type="checkbox" data-filter-discount' +
        (this.filter.onlyDiscount ? ' checked' : '') + '><span>Со скидкой</span></label></div>' +
        '<div class="catalog-filter-apply"><button class="btn btn--primary btn--block" type="button" data-filters-close>' +
        'Показать ' + result.total + ' ' + U.plural(result.total, 'товар', 'товара', 'товаров') + '</button></div>';

      /* ------------------------- Панель сортировки --------------------------- */
      var sortOptions = Object.keys(db.SORTS).map(function (key) {
        return '<option value="' + key + '"' + (self.filter.sort === key ? ' selected' : '') + '>' +
          U.esc(db.SORTS[key].label) + '</option>';
      }).join('');
      U.$('#catalogToolbar').innerHTML =
        '<div class="catalog-toolbar__info" role="status">Найдено <b>' + result.total + '</b> ' +
        U.plural(result.total, 'товар', 'товара', 'товаров') +
        (result.pages > 1 ? ' · страница ' + result.page + ' из ' + result.pages : '') + '</div>' +
        '<div class="catalog-toolbar__controls">' +
        '<label class="input-icon catalog-search"><span class="visually-hidden">Поиск в каталоге</span>' + BS.icon('search', { size: 16 }) +
        '<input class="input input--sm" type="search" ' +
        'placeholder="Название, модель или бренд" value="' + U.attr(this.filter.q) + '" data-filter-q></label>' +
        '<label class="catalog-sort"><span class="catalog-sort__label">Сортировка</span>' +
        '<select class="select input--sm" data-filter-sort>' + sortOptions + '</select></label></div>';

      this.renderResults(result);
      this.syncFilterPanel();
      if (focusAttr) {
        var replacement = Array.prototype.find.call(document.querySelectorAll('[' + focusAttr + ']'), function (el) {
          return el.getAttribute(focusAttr) === focusValue;
        });
        if (replacement) {
          replacement.focus({ preventScroll: true });
          if (selectionStart !== null) replacement.setSelectionRange(selectionStart, selectionStart);
        }
      }
    },
    /** На узких экранах фильтры раскрываются по запросу, на широких видны всегда. */
    syncFilterPanel: function () {
      var panel = U.$('#catalogFilters');
      var toggle = U.$('[data-filters-toggle]');
      if (!panel || !toggle) return;
      var expanded = !this.filterMedia.matches || this.filtersOpen;
      panel.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      var count = (this.filter.category ? 1 : 0) + this.filter.brands.length +
        (this.filter.min || this.filter.max ? 1 : 0) + (this.filter.inStock ? 1 : 0) +
        (this.filter.onlyDiscount ? 1 : 0);
      var counter = toggle.querySelector('[data-filter-count]');
      counter.textContent = count;
      counter.hidden = !count;
    },
    closeFilters: function () {
      this.filtersOpen = false;
      this.syncFilterPanel();
      var toggle = U.$('[data-filters-toggle]');
      if (toggle) toggle.focus({ preventScroll: true });
    },
    /** Активные фильтры, сетка товаров и пагинация. */
    renderResults: function (result) {
      var chips = [];
      if (this.filter.q) chips.push({ label: 'Поиск: ' + this.filter.q, key: 'q' });
      if (this.filter.category) {
        chips.push({ label: 'Категория: ' + ((db.category(this.filter.category) || {}).name || ''), key: 'category' });
      }
      this.filter.brands.forEach(function (brand) {
        chips.push({ label: 'Бренд: ' + brand, key: 'brand', value: brand });
      });
      if (this.filter.min || this.filter.max) {
        chips.push({ label: 'Цена: ' + U.num(this.filter.min || 0) + '–' +
          (this.filter.max ? U.num(this.filter.max) : '∞') + ' ₸', key: 'price' });
      }
      if (this.filter.inStock) chips.push({ label: 'Только в наличии', key: 'stock' });
      if (this.filter.onlyDiscount) chips.push({ label: 'Со скидкой', key: 'discount' });
      U.$('#activeFilters').innerHTML = chips.map(function (chip) {
        return '<button class="chip chip--removable" data-remove-filter="' + U.attr(chip.key) + '" ' +
          'data-remove-value="' + U.attr(chip.value || '') + '">' + U.esc(chip.label) +
          ' <span data-remove>×</span></button>';
      }).join('');

      U.$('#catalogGrid').innerHTML = C.grid(result.items);

      var pagination = U.$('#catalogPagination');
      if (result.pages <= 1) { pagination.innerHTML = ''; return; }
      var buttons = ['<button data-page="' + (result.page - 1) + '"' +
        (result.page === 1 ? ' disabled' : '') + '>←</button>'];
      var dots = false;
      for (var i = 1; i <= result.pages; i++) {
        if (result.pages > 7 && Math.abs(i - result.page) > 2 && i !== 1 && i !== result.pages) {
          if (!dots) { buttons.push('<button disabled>…</button>'); dots = true; }
          continue;
        }
        dots = false;
        buttons.push('<button data-page="' + i + '"' +
          (i === result.page ? ' class="is-active"' : '') + '>' + i + '</button>');
      }
      buttons.push('<button data-page="' + (result.page + 1) + '"' +
        (result.page === result.pages ? ' disabled' : '') + '>→</button>');
      pagination.innerHTML = '<div class="pagination">' + buttons.join('') + '</div>';
    },

    /** Синхронизация состояния фильтров с адресной строкой. */
    syncUrl: function () {
      var f = this.filter;
      U.setQs({
        q: f.q || '', category: f.category || '',
        brand: f.brands.length ? f.brands.join(',') : '',
        min: f.min || '', max: f.max || '',
        sort: f.sort || '', page: f.page > 1 ? f.page : '',
        stock: f.inStock ? '1' : '', discount: f.onlyDiscount ? '1' : ''
      });
    },

    change: function (patch) {
      Object.assign(this.filter, patch);
      if (!('page' in patch)) this.filter.page = 1;
      this.syncUrl();
      this.render();
      var grid = U.$('#catalogGrid');
      if (grid && !(this.filterMedia.matches && this.filtersOpen)) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    /* ------------------------------ Обработчики ----------------------------- */
    wire: function (root) {
      var self = this;
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-filters-toggle]')) {
          self.filtersOpen = !self.filtersOpen;
          self.syncFilterPanel();
          return;
        }
        if (e.target.closest('[data-filters-close]')) { self.closeFilters(); return; }
        var category = e.target.closest('[data-filter-category]');
        if (category) { self.change({ category: category.getAttribute('data-filter-category') }); return; }

        if (e.target.closest('[data-filter-price]')) {
          self.change({
            min: Number(root.querySelector('[data-filter-min]').value) || 0,
            max: Number(root.querySelector('[data-filter-max]').value) || 0
          });
          return;
        }
        if (e.target.closest('[data-filters-reset]')) {
          self.filter = {
            q: '', category: '', brands: [], min: 0, max: 0,
            sort: '', page: 1, inStock: false, onlyDiscount: false
          };
          self.syncUrl();
          self.render();
          L.toast('Фильтры сброшены', 'info');
          return;
        }
        var removeChip = e.target.closest('[data-remove-filter]');
        if (removeChip) {
          var key = removeChip.getAttribute('data-remove-filter');
          var value = removeChip.getAttribute('data-remove-value');
          if (key === 'brand') {
            self.change({ brands: self.filter.brands.filter(function (b) { return b !== value; }) });
          } else if (key === 'price') {
            self.change({ min: 0, max: 0 });
          } else if (key === 'stock') {
            self.change({ inStock: false });
          } else if (key === 'discount') {
            self.change({ onlyDiscount: false });
          } else {
            var patch = {};
            patch[key] = '';
            self.change(patch);
          }
          return;
        }
        var page = e.target.closest('[data-page]');
        if (page && !page.disabled) {
          var number = Number(page.getAttribute('data-page'));
          if (number >= 1) self.change({ page: number });
        }
      });

      root.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.filterMedia.matches && self.filtersOpen) {
          e.preventDefault();
          self.closeFilters();
        }
      });

      root.addEventListener('change', function (e) {
        var brand = e.target.closest('[data-filter-brand]');
        if (brand) {
          var value = brand.getAttribute('data-filter-brand');
          var brands = self.filter.brands.slice();
          var index = brands.indexOf(value);
          if (brand.checked && index === -1) brands.push(value);
          if (!brand.checked && index !== -1) brands.splice(index, 1);
          self.change({ brands: brands });
          return;
        }
        if (e.target.closest('[data-filter-stock]')) { self.change({ inStock: e.target.checked }); return; }
        if (e.target.closest('[data-filter-discount]')) { self.change({ onlyDiscount: e.target.checked }); return; }
        if (e.target.closest('[data-filter-sort]')) { self.change({ sort: e.target.value }); }
      });

      var searchTimer = null;
      root.addEventListener('input', function (e) {
        if (!e.target.closest('[data-filter-q]')) return;
        clearTimeout(searchTimer);
        var value = e.target.value;
        searchTimer = setTimeout(function () { self.change({ q: value }); }, 380);
      });
    }
  };
})();
