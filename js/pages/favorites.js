/* ==========================================================================
   ByteStore — Избранное: сохранённые товары гостя и пользователя
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});

  pages.favorites = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      this.root = root;
      this.render();
      var self = this;
      L.onFavoritesChange = function () { self.render(); };
    },

    render: function () {
      var products = db.favoriteProducts();
      var user = BS.auth.user();
      var compareCount = db.compare.count();
      this.root.innerHTML = '<div class="container">' +
        C.breadcrumbs([{ label: 'Главная', href: 'index.html' }, { label: 'Избранное' }]) +
        '<div class="section-head mt-5"><div>' +
        '<div class="kicker">' + BS.icon('heart', { size: 14 }) + ' Список желаний</div>' +
        '<h1 style="font-size:var(--fs-2xl)">Избранное</h1>' +
        '<p>' + (user
          ? 'Товары сохраняются в вашем аккаунте и доступны с любого устройства.'
          : 'Вы не авторизованы — избранное хранится в этом браузере. ' +
            '<a href="login.html?next=favorites.html">Войдите</a>, чтобы сохранить список в аккаунте.') + '</p></div>' +
        (products.length ? '<div class="btn-group">' +
          '<button class="btn btn--outline btn--sm" data-fav-clear>' + BS.icon('trash', { size: 15 }) +
          'Очистить список</button>' +
          (compareCount ? '<button class="btn btn--soft btn--sm" data-cmp-show>Сравнить выбранные</button>' : '') +
          '</div>' : '') + '</div>' +
        (products.length
          ? C.grid(products) + this.summary(products)
          : L.emptyState({
            emoji: '💜', title: 'Список пуст',
            text: 'Нажимайте на сердечко в каталоге, чтобы сохранить товары и вернуться к ним позже.',
            action: '<a class="btn btn--primary" href="catalog.html">Перейти в каталог</a>'
          })) +
        '</div>';
      this.wire();
    },

    /** Итоговая смета по избранному — удобно планировать апгрейд. */
    summary: function (products) {
      var total = U.sum(products, function (p) { return p.price; });
      var inStock = products.filter(function (p) { return p.stock > 0; });
      var bestCategory = '';
      var counts = U.groupBy(products, function (p) { return p.categoryId; });
      Object.keys(counts).forEach(function (key) {
        if (!bestCategory || counts[key].length > counts[bestCategory].length) bestCategory = key;
      });
      return '<div class="card mt-6"><div class="panel-head"><h3>План покупки</h3>' +
        '<button class="btn btn--primary btn--sm" data-fav-add-all>Добавить всё в корзину</button></div>' +
        '<div class="grid-4">' +
        '<div><div class="muted small">Товаров в списке</div><b>' + products.length + '</b></div>' +
        '<div><div class="muted small">В наличии</div><b class="text-ok">' + inStock.length + '</b></div>' +
        '<div><div class="muted small">Суммарная стоимость</div><b>' + U.money(total) + '</b></div>' +
        '<div><div class="muted small">Больше всего</div><b>' +
        U.esc((db.category(bestCategory) || {}).name || '—') + '</b></div>' +
        '</div>' +
        '<div class="muted small mt-4">Совет: соберите из этих товаров конфигурацию в ' +
        '<a href="configurator.html">ИИ-конфигураторе</a> — движок проверит совместимость сокетов, памяти и БП.</div>' +
        '</div>';
    },

    wire: function () {
      var self = this;
      var root = this.root;
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-fav-clear]')) {
          L.confirm('Удалить все товары из избранного?', { danger: true, confirmText: 'Очистить' })
            .then(function (yes) {
              if (!yes) return;
              db.favorites().slice().forEach(function (id) { db.toggleFavorite(id); });
              L.refreshCounters();
              self.render();
              L.toast('Избранное очищено', 'info');
            });
          return;
        }
        if (e.target.closest('[data-fav-add-all]')) {
          var added = 0;
          db.favoriteProducts().forEach(function (product) {
            if (!db.inStock(product)) return;
            db.addToCart(product.id, 1);
            added++;
          });
          L.refreshCounters();
          L.toastOk(added ? 'Добавлено товаров: ' + added : 'Нет товаров в наличии', 'Корзина обновлена');
        }
      });
    }
  };
})();
