/* ==========================================================================
   ByteStore — Личный кабинет: профиль, заказы, отзывы, избранное, ИИ-ключ
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});

  pages.account = {
    section: 'orders',

    init: function () {
      if (!BS.auth.requireLogin('account.html')) return;
      var root = U.$('#pageContent');
      if (!root) return;
      this.root = root;
      var hash = (window.location.hash || '').replace('#', '');
      if (['profile', 'orders', 'reviews', 'favorites', 'bonuses'].indexOf(hash) !== -1) {
        this.section = hash;
      }
      this.render();
      this.wire();
    },

    render: function () {
      var self = this;
      var user = BS.auth.user();
      var stats = db.userStats(user.id);
      var orders = db.orders({ userId: user.id });
      var reviews = db.reviews({}).filter(function (r) { return r.userId === user.id; });
      var favorites = db.favoriteProducts();
      var ai = db.aiSettings();

      this.root.innerHTML = '<div class="container">' +
        C.breadcrumbs([{ label: 'Главная', href: 'index.html' }, { label: 'Личный кабинет' }]) +
        '<div class="section-head mt-5"><div>' +
        '<div class="kicker">' + BS.icon('user', { size: 14 }) + ' Личный кабинет</div>' +
        '<h1 style="font-size:var(--fs-2xl)">Здравствуйте, ' + U.esc(BS.auth.firstName()) + '!</h1>' +
        '<p>Здесь хранится история заказов, отзывы, избранные товары и настройки ИИ-конфигуратора.</p></div>' +
        '<a class="btn btn--outline btn--sm" href="configurator.html">' + BS.icon('sparkles', { size: 16 }) +
        'Собрать новый ПК</a></div>' +
        '<div class="account-layout">' +
        '<aside class="card card--pad-sm account-side">' +
        '<div class="account-user"><span class="account-user__ava">' + BS.auth.initials(user.name) + '</span>' +
        '<div class="grow"><b>' + U.esc(user.name) + '</b>' +
        '<div class="muted small">' + U.esc(user.email) + '</div>' +
        '<div class="badge badge--accent mt-2">Бонусов: ' + U.num(user.bonus || 0) + '</div></div></div>' +
        '<nav class="account-nav">' +
        [['orders', 'package', 'Заказы', orders.length],
         ['profile', 'user', 'Профиль', null],
         ['reviews', 'thumbs-up', 'Мои отзывы', reviews.length],
         ['favorites', 'heart', 'Избранное', favorites.length],
         ['bonuses', 'gift', 'Бонусы и скидки', null]].map(function (row) {
          return '<button class="' + (self.section === row[0] ? 'is-active' : '') + '" data-account-nav="' +
            row[0] + '">' + BS.icon(row[1], { size: 18 }) + row[2] +
            (row[3] !== null ? '<span class="count-pill">' + row[3] + '</span>' : '') + '</button>';
        }).join('') +
        '</nav>' +
        '<hr>' +
        '<button class="btn btn--ghost btn--block" data-logout>' + BS.icon('logout', { size: 17 }) +
        'Выйти из аккаунта</button>' +
        '</aside>' +
        '<div id="accountBody">' + this.sectionHtml() + '</div>' +
        '</div></div>';
    },

    sectionHtml: function () {
      switch (this.section) {
        case 'profile': return this.profileHtml();
        case 'reviews': return this.reviewsHtml();
        case 'favorites': return this.favoritesHtml();
        case 'bonuses': return this.bonusesHtml();
        default: return this.ordersHtml();
      }
    },
    /* ------------------------------- Заказы --------------------------------- */
    ordersHtml: function () {
      var user = BS.auth.user();
      var stats = db.userStats(user.id);
      var orders = db.orders({ userId: user.id });
      return '<div class="grid-4 mb-5">' +
        this.kpi('Всего заказов', String(stats.orders), 'package') +
        this.kpi('Сумма покупок', U.kilo(stats.spent), 'wallet') +
        this.kpi('Отзывов оставлено', String(stats.reviews), 'thumbs-up') +
        this.kpi('Бонусов на счету', U.num(user.bonus || 0), 'gift') +
        '</div>' +
        (orders.length
          ? orders.map(function (order) {
            return C.order(order, {
              timeline: true,
              actions: order.status === 'shipped'
                ? '<button class="btn btn--soft btn--sm mt-3" data-order-received="' + U.attr(order.id) +
                  '">Подтвердить получение</button>'
                : (order.status === 'delivered'
                  ? '<div class="muted small mt-3">Заказ получен ' + U.date(order.createdAt, false) +
                    '. Спасибо за покупку!</div>' : '')
            });
          }).join('')
          : L.emptyState({
            emoji: '📦', title: 'Заказов пока нет',
            text: 'Соберите ПК с ИИ-конфигуратором или выберите готовую сборку — доставка от одного дня.',
            action: '<div class="btn-group"><a class="btn btn--primary" href="catalog.html">В каталог</a>' +
              '<a class="btn btn--outline" href="configurator.html">ИИ-подбор</a></div>'
          }));
    },

    kpi: function (label, value, icon) {
      return '<div class="kpi"><div class="kpi__label">' + BS.icon(icon, { size: 15 }) + ' ' + U.esc(label) +
        '</div><div class="kpi__value">' + value + '</div></div>';
    },

    /* ------------------------------- Профиль -------------------------------- */
    profileHtml: function () {
      var user = BS.auth.user();
      return '<div class="card"><div class="panel-head"><h3>Профиль</h3>' +
        '<span class="muted small">В базе с ' + U.date(user.createdAt) + '</span></div>' +
        '<form data-profile-form>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="pfName">Имя и фамилия</label>' +
        '<input class="input" id="pfName" name="name" value="' + U.attr(user.name) + '" required></div>' +
        '<div class="field"><label for="pfPhone">Телефон</label>' +
        '<input class="input" id="pfPhone" name="phone" value="' + U.attr(user.phone || '') + '"></div></div>' +
        '<div class="field"><label for="pfEmail">E-mail</label>' +
        '<input class="input" id="pfEmail" name="email" type="email" value="' + U.attr(user.email) + '" required></div>' +
        '<label class="check mb-4"><input type="checkbox" name="newsletter"' +
        (user.newsletter ? ' checked' : '') + '><span class="grow">Присылать скидки и новости ByteStore</span></label>' +
        '<button class="btn btn--primary" type="submit">Сохранить профиль</button>' +
        '</form>' +
        '<hr>' +
        '<h4>Смена пароля</h4>' +
        '<form data-password-form>' +
        '<div class="field"><label for="pwCurrent">Текущий пароль</label>' +
        '<input class="input" id="pwCurrent" name="current" type="password" required></div>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="pwNext">Новый пароль</label>' +
        '<input class="input" id="pwNext" name="next" type="password" required></div>' +
        '<div class="field"><label for="pwNext2">Повторите пароль</label>' +
        '<input class="input" id="pwNext2" name="next2" type="password" required></div></div>' +
        '<button class="btn btn--outline" type="submit">Изменить пароль</button>' +
        '</form></div>';
    },

    /* ------------------------------- Отзывы --------------------------------- */
    reviewsHtml: function () {
      var user = BS.auth.user();
      var reviews = db.reviews({}).filter(function (r) { return r.userId === user.id; });
      return '<div class="card"><div class="panel-head"><h3>Мои отзывы</h3>' +
        '<span class="muted small">Всего: ' + reviews.length + '</span></div>' +
        (reviews.length
          ? reviews.map(function (review) {
            return C.review(review, {
              showStatus: true, showProduct: true,
              actions: '<div class="row gap-3 mt-3">' +
                '<a class="btn btn--ghost btn--xs" href="product.html?id=' + U.attr(review.productId) +
                '">К товару</a>' +
                '<button class="btn btn--ghost btn--xs text-danger" data-review-delete="' + U.attr(review.id) +
                '">Удалить</button></div>'
            });
          }).join('')
          : L.emptyState({
            emoji: '✍️', title: 'Отзывов пока нет',
            text: 'Купили товар? Расскажите о нём — это помогает другим покупателям выбирать.',
            action: '<a class="btn btn--primary" href="catalog.html">Выбрать товар</a>'
          })) + '</div>';
    },

    /* ------------------------------ Избранное ------------------------------- */
    favoritesHtml: function () {
      var products = db.favoriteProducts();
      return '<div class="card"><div class="panel-head"><h3>Избранное</h3>' +
        '<a class="btn btn--outline btn--sm" href="favorites.html">Открыть страницу избранного</a></div>' +
        (products.length ? C.grid(products.slice(0, 6))
          : L.emptyState({
            emoji: '💜', title: 'Список пуст',
            text: 'Добавляйте товары сердечком в каталоге, чтобы сравнить их позже.',
            action: '<a class="btn btn--primary" href="catalog.html">В каталог</a>'
          })) + '</div>';
    },
    /* --------------------------- Бонусы и скидки ---------------------------- */
    bonusesHtml: function () {
      var user = BS.auth.user();
      var promos = db.promos(true);
      return '<div class="grid-2">' +
        '<div class="card"><h3>' + BS.icon('gift', { size: 20 }) + ' Бонусный счёт</h3>' +
        '<div class="kpi__value">' + U.num(user.bonus || 0) + ' бонусов</div>' +
        '<p class="muted">1 бонус = 1 ₸. Бонусами можно оплатить до 30 % стоимости заказа, ' +
        'они начисляются за покупки (2 % от суммы) и за отзывы с фото (5 000 бонусов).</p>' +
        '<div class="progress"><div class="progress__bar" style="width:' +
        Math.min(100, Math.round((user.bonus || 0) / 15000 * 100)) + '%"></div></div>' +
        '<p class="muted small mt-2">До максимальной скидки 15 000 ₸ осталось ' +
        U.money(Math.max(15000 - (user.bonus || 0), 0)) + '</p></div>' +
        '<div class="card"><h3>' + BS.icon('tag', { size: 20 }) + ' Ваши промокоды</h3>' +
        '<p class="muted small">Введите код в корзине при оформлении.</p>' +
        '<div class="col gap-3 mt-4">' + promos.map(function (promo) {
          return '<div class="between"><span class="promo-tag">' + U.esc(promo.code) + '</span>' +
            '<span class="grow small">' + U.esc(promo.description) + '</span>' +
            '<b>' + U.esc(db.promoLabel(promo)) + '</b></div>';
        }).join('') + '</div></div></div>';
    },

    /* ------------------------------ Обработчики ----------------------------- */
    wire: function () {
      var self = this;
      var root = this.root;

      root.addEventListener('click', async function (e) {
        var nav = e.target.closest('[data-account-nav]');
        if (nav) {
          self.section = nav.getAttribute('data-account-nav');
          window.location.hash = self.section;
          self.render();
          return;
        }
        if (e.target.closest('[data-logout]')) {
          await BS.auth.logout();
          window.location.href = 'index.html';
          return;
        }
        var received = e.target.closest('[data-order-received]');
        if (received) {
          var order = db.order(received.getAttribute('data-order-received'));
          if (!order) return;
          await db.setOrderStatus(order.id, 'delivered', 'Покупатель подтвердил получение');
          L.toastOk('Статус заказа обновлён: получен', order.number);
          self.render();
          return;
        }
        var reviewDelete = e.target.closest('[data-review-delete]');
        if (reviewDelete) {
          L.confirm('Удалить отзыв без возможности восстановления?', { danger: true, confirmText: 'Удалить' })
            .then(async function (yes) {
              if (!yes) return;
              await db.deleteReview(reviewDelete.getAttribute('data-review-delete'));
              L.toast('Отзыв удалён', 'info');
              self.render();
            });
          return;
        }
        if (e.target.closest('[data-review-like]')) {
          var likeId = e.target.closest('[data-review-like]').getAttribute('data-review-like');
          var likeResult = await db.likeReview(likeId);
          if (likeResult) {
            e.target.closest('[data-review-like]').textContent =
              'Полезно · ' + likeResult.likes;
          }
          return;
        }
        var reviewDelete = e.target.closest('[data-review-delete]');
        if (reviewDelete) {
          L.confirm('Удалить отзыв без возможности восстановления?', { danger: true, confirmText: 'Удалить' })
            .then(async function (yes) {
              if (!yes) return;
              await db.deleteReview(reviewDelete.getAttribute('data-review-delete'));
              L.toast('Отзыв удалён', 'info');
              self.render();
            });
          return;
        }
      });

      root.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (e.target.closest('[data-profile-form]')) {
          var profileData = new FormData(e.target);
          var result = await BS.auth.updateProfile({
            name: profileData.get('name'),
            phone: profileData.get('phone'),
            email: profileData.get('email'),
            newsletter: profileData.get('newsletter') === 'on'
          });
          if (result.ok) {
            L.toastOk(result.message);
            self.render();
          } else {
            L.toastError(Object.keys(result.errors || {}).map(function (key) {
              return result.errors[key];
            }).join(' ') || result.message);
          }
          return;
        }
        if (e.target.closest('[data-password-form]')) {
          var passwordData = new FormData(e.target);
          BS.auth.changePassword(passwordData.get('current'), passwordData.get('next'), passwordData.get('next2'))
            .then(async function (result) {
              if (result.ok) {
                L.toastOk(result.message, 'Пароль обновлён');
                e.target.reset();
              } else {
                L.toastError(result.message);
              }
            });
          return;
        }
      });
    }
  };
})();
