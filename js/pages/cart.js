/* ==========================================================================
   ByteStore — Корзина и оформление заказа
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db, C = BS.cards, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});
  var state = { promo: null };

  pages.cart = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      this.root = root;
      this.render();
      var self = this;
      L.onCartChange = function () { self.render(); };
    },

    render: function () {
      var root = this.root;
      var totals = db.cartTotals(null, state.promo);
      var user = BS.auth.user();

      if (!totals.lines.length) {
        root.innerHTML = '<div class="container section">' + C.breadcrumbs([
          { label: 'Главная', href: 'index.html' }, { label: 'Корзина' }
        ]) + L.emptyState({
          emoji: '🛒', title: 'В корзине пока пусто',
          text: 'Добавьте комплектующие из каталога или соберите совместимую конфигурацию с ИИ.',
          action: '<div class="btn-group"><a class="btn btn--primary" href="configurator.html">' +
            BS.icon('sparkles', { size: 17 }) + 'Собрать ПК с ИИ</a>' +
            '<a class="btn btn--outline" href="catalog.html">Открыть каталог</a></div>'
        }) + this.recommendations() + '</div>';
        return;
      }

      var items = totals.lines.map(function (line) {
        var p = line.product;
        return '<div class="cart-item" data-line="' + U.attr(p.id) + '">' +
          '<div class="cart-item__img">' + BS.art(p) + '</div>' +
          '<div><div class="cart-item__name"><a href="product.html?id=' + U.attr(p.id) + '">' + U.esc(p.name) + '</a></div>' +
          '<div class="muted small">' + U.esc((p.key || []).join(' · ')) + '</div>' +
          '<div class="muted small">' + (db.inStock(p) ? 'В наличии: ' + p.stock + ' шт.' : '<span class="text-warn">Нет в наличии</span>') +
          ' · Арт. ' + U.esc(p.sku) + '</div></div>' +
          '<div class="cart-item__ctrl">' +
          '<div class="qty"><button data-qty="-1" aria-label="Меньше">−</button>' +
          '<input type="text" value="' + line.qty + '" data-qty-input aria-label="Количество">' +
          '<button data-qty="1" aria-label="Больше">+</button></div>' +
          '<div class="pc__price" style="align-items:flex-end">' +
          '<span class="strong">' + U.money(line.sum) + '</span>' +
          (line.oldSum > line.sum ? '<span class="pc__old">' + U.money(line.oldSum) + '</span>' : '') + '</div>' +
          '<button class="btn btn--ghost btn--icon tip" data-remove title="Удалить">' +
          BS.icon('trash', { size: 17 }) + '</button>' +
          '</div></div>';
      }).join('');

      root.innerHTML = '<div class="container">' + C.breadcrumbs([
        { label: 'Главная', href: 'index.html' }, { label: 'Корзина' }
      ]) +
        '<div class="section-head mt-5"><div><div class="kicker">Шаг 1 из 3</div>' +
        '<h1 style="font-size:var(--fs-2xl)">Корзина</h1>' +
        '<p>Проверьте состав заказа, примените промокод и переходите к оформлению.</p></div>' +
        '<button class="btn btn--ghost btn--sm" data-cart-clear>' + BS.icon('trash', { size: 15 }) +
        'Очистить корзину</button></div>' +
        '<div class="cart-layout">' +
        '<div><div class="card">' + items + '</div>' + this.extras() + '</div>' +
        '<div class="summary-sticky"><div class="card">' +
        '<h3>Итого</h3>' + C.freeDeliveryHint(totals) +
        '<div class="summary-row"><span>Товары (' + totals.count + ')</span><b>' + U.money(totals.subtotal) + '</b></div>' +
        (totals.oldSubtotal > totals.subtotal ? '<div class="summary-row text-ok"><span>Скидка магазина</span><b>−' +
          U.money(totals.oldSubtotal - totals.subtotal) + '</b></div>' : '') +
        (totals.discount ? '<div class="summary-row text-ok"><span>Промокод ' + U.esc(state.promo.code) +
          '</span><b>−' + U.money(totals.discount) + '</b></div>' : '') +
        '<div class="summary-row"><span>Доставка</span><b>' + (totals.delivery ? U.money(totals.delivery) : 'бесплатно') + '</b></div>' +
        '<div class="summary-row summary-row--total"><span>К оплате</span><span>' + U.money(totals.total) + '</span></div>' +
        '<button class="btn btn--primary btn--lg btn--block mt-5" data-checkout>' +
        BS.icon('credit-card', { size: 18 }) + 'Оформить заказ</button>' +
        '<a class="btn btn--ghost btn--block mt-2" href="catalog.html">Продолжить покупки</a>' +
        '<div class="muted small mt-4 center">' + BS.icon('shield', { size: 14 }) +
        ' Безопасная оплата · ' + (user ? 'Вы вошли как ' + U.esc(user.name) : 'Оформление без регистрации возможно') +
        '</div></div></div></div>' +
        this.recommendations() + '</div>';
      this.wire();
    },
    /* --------------------- Промокод, доставка, доп. услуги ------------------ */
    extras: function () {
      var promos = db.promos(true);
      var lines = db.cartTotals().lines;
      var categories = {};
      lines.forEach(function (line) { categories[line.product.categoryId] = true; });
      var offersAssembly = !categories.prebuilt &&
        ['cpu', 'motherboard', 'ram', 'storage', 'psu', 'case'].every(function (id) { return categories[id]; });
      return '<div class="grid-2 mt-5">' +
        '<div class="card"><h4>' + BS.icon('tag', { size: 18 }) + ' Промокод</h4>' +
        '<div class="promo-row"><input class="input" placeholder="Введите код" data-promo-input ' +
        'value="' + U.attr(state.promo ? state.promo.code : '') + '">' +
        '<button class="btn btn--soft" data-promo-apply>Применить</button></div>' +
        '<div class="promo-list">' + promos.map(function (p) {
          return '<span class="promo-tag" data-promo-tag="' + U.attr(p.code) + '">' + U.esc(p.code) +
            ' · ' + U.esc(db.promoLabel(p)) + '</span>';
        }).join('') + '</div>' +
        '<p class="muted small mt-3">Действующие акции: ' + promos.map(function (p) {
          return U.esc(p.description);
        }).join('; ') + '.</p></div>' +
        '<div class="card"><h4>' + BS.icon('gift', { size: 18 }) + ' Дополнительно</h4>' +
        (offersAssembly ? '<div class="checkout-service"><span class="checkout-service__icon">' + BS.icon('cpu', { size: 18 }) +
          '</span><span class="grow"><b>Сборка и тестирование ПК</b><span class="muted small">Для выбранного комплекта комплектующих</span></span>' +
          '<b class="text-ok nowrap">Бесплатно</b></div>' : '') +
        '<label class="check mb-3"><input type="checkbox" data-option="insurance"><span class="grow">' +
        'Расширенная страховка от повреждений (12 месяцев)</span><b>17 990 ₸</b></label>' +
        '<label class="check"><input type="checkbox" data-option="setup"><span class="grow">' +
        'Установка Windows и драйверов</span><b>19 990 ₸</b></label>' +
        '<p class="muted small mt-3">Услуги добавляются к заказу менеджером при подтверждении.</p></div>' +
        '</div>';
    },

    recommendations: function () {
      var cartIds = db.cart().map(function (line) { return line.productId; });
      var products = db.recommended(12).filter(function (p) {
        return cartIds.indexOf(p.id) === -1;
      }).slice(0, 4);
      if (!products.length) return '';
      return '<section class="section section--tight">' +
        L.sectionHead('Возможно пригодится', 'С этим товаром часто покупают') +
        C.grid(products) + '</section>';
    },
    /* --------------------------- Оформление заказа -------------------------- */
    openCheckout: function () {
      var self = this;
      var user = BS.auth.user();
      var totals = db.cartTotals(null, state.promo);
      var cities = ['Алматы', 'Астана', 'Шымкент', 'Караганда', 'Актобе', 'Тараз', 'Павлодар'];
      function makeOrder(form, payment) {
        var data = new FormData(form);
        var customer = {
          name: String(data.get('name') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          email: String(data.get('email') || '').trim()
        };
        if (!customer.name) { L.toast('Укажите имя и фамилию', 'warn'); return null; }
        if (BS.auth.validatePhone(customer.phone)) { L.toast('Укажите корректный телефон', 'warn'); return null; }
        var result = db.createOrder({
          customer: customer,
          city: data.get('city'),
          address: data.get('address'),
          deliveryType: data.get('deliveryType'),
          payment: payment || data.get('payment'),
          comment: data.get('comment'),
          promo: state.promo,
          promoCode: state.promo ? state.promo.code : '',
          userId: user ? user.id : null,
          source: 'Корзина'
        });
        if (!result.ok) { L.toast(result.message, 'danger'); return null; }
        return result.order;
      }
      var instance = L.modal({
        title: 'Оформление заказа',
        size: 'wide',
        html:
          '<div class="steps"><span class="step is-active"><span class="step__num">1</span>Контакты</span>' +
          '<span class="step is-done"><span class="step__num">2</span>Доставка</span>' +
          '<span class="step is-done"><span class="step__num">3</span>Оплата</span></div>' +
          '<form data-checkout-form>' +
          '<div class="admin-split">' +
          '<div class="field"><label for="coName">Имя и фамилия *</label>' +
          '<input class="input" id="coName" name="name" required value="' + U.attr(user ? user.name : '') + '"></div>' +
          '<div class="field"><label for="coPhone">Телефон *</label>' +
          '<input class="input" id="coPhone" name="phone" placeholder="+7 999 123-45-67" required value="' +
          U.attr(user ? (user.phone || '') : '') + '"></div></div>' +
          '<div class="field"><label for="coEmail">E-mail для чека</label>' +
          '<input class="input" id="coEmail" type="email" name="email" placeholder="client@mail.kz" value="' +
          U.attr(user ? user.email : '') + '"></div>' +
          '<div class="admin-split">' +
          '<div class="field"><label for="coCity">Город</label><select class="select" id="coCity" name="city">' +
          cities.map(function (city) { return '<option>' + city + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="coDelivery">Способ доставки</label>' +
          '<select class="select" id="coDelivery" name="deliveryType">' +
          ['Курьер до двери', 'Самовывоз из пункта выдачи', 'Экспресс-доставка (в день заказа)']
            .map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div></div>' +
          '<div class="field"><label for="coAddress">Адрес или адрес пункта выдачи</label>' +
          '<input class="input" id="coAddress" name="address" placeholder="Улица, дом, квартира"></div>' +
          '<div class="field"><label for="coPayment">Способ оплаты</label>' +
          '<select class="select" id="coPayment" name="payment">' +
          ['Картой онлайн', 'Единый QR', 'Рассрочка', 'При получении']
            .map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select></div>' +
          '<div class="field installment-choice hide" data-installment-choice>' +
          '<label for="coInstallment">Срок рассрочки</label>' +
          '<select class="select" id="coInstallment" name="installmentTerm">' +
          ['0-0-6', '0-0-12', '0-0-24'].map(function (t) { return '<option>' + t + '</option>'; }).join('') +
          '</select><span class="hint">Без переплаты. Банк выберете на следующем шаге.</span></div>' +
          '<div class="field"><label for="coComment">Комментарий к заказу</label>' +
          '<textarea class="textarea" id="coComment" name="comment" ' +
          'placeholder="Например: позвонить за час до доставки"></textarea></div>' +
          '<div class="card card--flat">' +
          totals.lines.map(function (line) {
            return '<div class="summary-row"><span>' + U.esc(line.product.name) + ' × ' + line.qty +
              '</span><b>' + U.money(line.sum) + '</b></div>';
          }).join('') +
          (totals.discount ? '<div class="summary-row text-ok"><span>Промокод ' + U.esc(state.promo.code) +
            '</span><b>−' + U.money(totals.discount) + '</b></div>' : '') +
          '<div class="summary-row"><span>Доставка</span><b>' +
          (totals.delivery ? U.money(totals.delivery) : 'бесплатно') + '</b></div>' +
          '<div class="summary-row summary-row--total"><span>Итого</span><span>' + U.money(totals.total) +
          '</span></div></div></form>',
        footer: '<button class="btn" data-close>Отмена</button>' +
          '<button class="btn btn--primary" data-checkout-submit>' + BS.icon('check', { size: 17 }) +
          'Продолжить · ' + U.money(totals.total) + '</button>'
      });
      var paymentSelect = instance.el.querySelector('#coPayment');
      var installmentChoice = instance.el.querySelector('[data-installment-choice]');
      paymentSelect.addEventListener('change', function () {
        installmentChoice.classList.toggle('hide', paymentSelect.value !== 'Рассрочка');
      });
      instance.el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-checkout-submit]')) return;
        var form = instance.el.querySelector('[data-checkout-form]');
        if (!form.reportValidity()) return;
        var checkoutPhone = String(new FormData(form).get('phone') || '').trim();
        if (BS.auth.validatePhone(checkoutPhone)) { L.toast('Укажите корректный телефон', 'warn'); return; }
        var method = paymentSelect.value;
        var data = new FormData(form);
        if (method === 'Картой онлайн') {
          self.openCardPayment(totals, function () {
            var order = makeOrder(form, method);
            if (order) { instance.close(); state.promo = null; self.showSuccess(order); L.refreshCounters(); }
          });
          return;
        }
        if (method === 'Единый QR') {
          self.openQrPayment(totals, function () {
            var order = makeOrder(form, method);
            if (order) { instance.close(); state.promo = null; self.showSuccess(order); L.refreshCounters(); }
          });
          return;
        }
        if (method === 'Рассрочка') {
          self.openBankChoice(data.get('installmentTerm'), function (bank, term) {
            var order = makeOrder(form, 'Рассрочка ' + term + ' · ' + bank);
            if (order) { instance.close(); state.promo = null; self.showSuccess(order); L.refreshCounters(); }
          });
          return;
        }
        var order = makeOrder(form, method);
        if (order) { instance.close(); state.promo = null; self.showSuccess(order); L.refreshCounters(); }
      });
    },
    openCardPayment: function (totals, onPaid) {
      var modal = L.modal({
        title: 'Оплата картой', size: 'narrow',
        html: '<div class="payment-card-preview"><span>BYTESTORE</span><span class="payment-card-chip">▦</span>' +
          '<strong data-card-preview>•••• •••• •••• ••••</strong><div><span data-name-preview>ВАШЕ ИМЯ</span>' +
          '<span data-expiry-preview>MM/YY</span></div></div>' +
          '<div class="field"><label for="cardNumber">Номер карты</label>' +
          '<input class="input" id="cardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="23" placeholder="0000 0000 0000 0000" required></div>' +
          '<div class="field"><label for="cardHolder">Имя владельца</label>' +
          '<input class="input" id="cardHolder" autocomplete="cc-name" placeholder="Как на карте" required></div>' +
          '<div class="admin-split"><div class="field"><label for="cardExpiry">Срок действия</label>' +
          '<input class="input" id="cardExpiry" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/YY" required></div>' +
          '<div class="field"><label for="cardCvc">CVC / CVV</label>' +
          '<input class="input" id="cardCvc" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="•••" required></div></div>' +
          '<p class="muted small">Данные карты используются только для демонстрации оформления и не сохраняются.</p>',
        footer: '<button class="btn" data-close>Отмена</button><button class="btn btn--primary" data-card-pay>' +
          BS.icon('lock', { size: 16 }) + 'Оплатить ' + U.money(totals.total) + '</button>'
      });
      var number = modal.el.querySelector('#cardNumber');
      var holder = modal.el.querySelector('#cardHolder');
      var expiry = modal.el.querySelector('#cardExpiry');
      var cvc = modal.el.querySelector('#cardCvc');
      number.addEventListener('input', function () {
        var value = number.value.replace(/\D/g, '').slice(0, 19);
        number.value = value.replace(/(.{4})/g, '$1 ').trim();
        modal.el.querySelector('[data-card-preview]').textContent = (value + '••••••••••••••••').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
      });
      holder.addEventListener('input', function () { modal.el.querySelector('[data-name-preview]').textContent = (holder.value || 'ВАШЕ ИМЯ').toUpperCase(); });
      expiry.addEventListener('input', function () {
        var value = expiry.value.replace(/\D/g, '').slice(0, 4);
        expiry.value = value.length > 2 ? value.slice(0, 2) + '/' + value.slice(2) : value;
        modal.el.querySelector('[data-expiry-preview]').textContent = expiry.value || 'MM/YY';
      });
      cvc.addEventListener('input', function () { cvc.value = cvc.value.replace(/\D/g, '').slice(0, 4); });
      modal.el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-card-pay]')) return;
        var digits = number.value.replace(/\D/g, '');
        if (!number.value.trim() || digits.length < 12 || !holder.value.trim() || !/^\d{2}\/\d{2}$/.test(expiry.value) || cvc.value.length < 3) {
          L.toast('Проверьте данные карты', 'warn'); return;
        }
        modal.close(); onPaid();
      });
    },
    openQrPayment: function (totals, onPaid) {
      var reference = 'BS' + Date.now().toString().slice(-8);
      var payload = 'BYTESTORE|ORDER:' + reference + '|AMOUNT:' + totals.total + '|CURRENCY:KZT';
      var svg = BS.qr ? BS.qr.svg(payload, { size: 220, margin: 4, level: 'M' }) : '';
      var modal = L.modal({
        title: 'Оплата через Единый QR', size: 'narrow',
        html: '<div class="qr-payment"><div class="qr-payment__code">' + svg + '</div>' +
          '<span class="qr-payment__label">Единый QR</span><h3>' + U.money(totals.total) + '</h3>' +
          '<p class="muted">Откройте приложение банка, выберите оплату по QR и отсканируйте код.</p>' +
          '<div class="qr-payment__ref">Номер платежа <b>' + U.esc(reference) + '</b></div></div>',
        footer: '<button class="btn" data-close>Назад</button><button class="btn btn--primary" data-qr-paid>' +
          BS.icon('check', { size: 16 }) + 'Я оплатил(а)</button>'
      });
      modal.el.addEventListener('click', function (e) { if (e.target.closest('[data-qr-paid]')) { modal.close(); onPaid(); } });
    },
    openBankChoice: function (term, onChoose) {
      var banks = [
        { name: 'Halyk', mark: 'H', cls: 'halyk' }, { name: 'Kaspi', mark: 'K', cls: 'kaspi' },
        { name: 'BCC', mark: 'bcc', cls: 'bcc' }, { name: 'Freedom', mark: 'F', cls: 'freedom' }
      ];
      var modal = L.modal({
        title: 'Выберите банк', size: 'narrow',
        html: '<p class="muted">Рассрочка <b>' + U.esc(term) + '</b> · выберите банк для оформления</p>' +
          '<div class="bank-grid">' + banks.map(function (bank, i) {
            return '<label class="bank-option"><input type="radio" name="installmentBank" value="' + bank.name + '" ' +
              (i === 0 ? 'checked' : '') + '><span class="bank-logo bank-logo--' + bank.cls + '">' + bank.mark +
              '</span><b>' + bank.name + '</b></label>';
          }).join('') + '</div>',
        footer: '<button class="btn" data-close>Назад</button><button class="btn btn--primary" data-bank-continue>' +
          'Продолжить с банком</button>'
      });
      modal.el.addEventListener('click', function (e) {
        if (!e.target.closest('[data-bank-continue]')) return;
        var selected = modal.el.querySelector('[name="installmentBank"]:checked');
        if (!selected) { L.toast('Выберите банк', 'warn'); return; }
        modal.close(); onChoose(selected.value, term);
      });
    },
    showSuccess: function (order) {
      L.modal({
        title: 'Заказ оформлен',
        size: 'narrow',
        html: '<div style="text-align:center">' +
          '<div class="empty__icon">🎉</div>' +
          '<h3>Спасибо за заказ!</h3>' +
          '<p class="muted">Номер заказа <b class="mono">' + U.esc(order.number) + '</b>. ' +
          'Мы уже собираем посылку' + (order.customer.email
            ? ' и отправили детали на ' + U.esc(order.customer.email) : '') + '.</p>' +
          C.order(order, { timeline: true }) +
          '<div class="btn-group mt-4" style="justify-content:center">' +
          (BS.auth.isLoggedIn()
            ? '<a class="btn btn--primary" href="account.html">Открыть личный кабинет</a>'
            : '<a class="btn btn--primary" href="register.html">Создать аккаунт</a>') +
          '<a class="btn btn--outline" href="catalog.html">Продолжить покупки</a>' +
          '</div></div>'
      });
      this.render();
    },

    /* ------------------------------ Обработчики ----------------------------- */
    wire: function () {
      var self = this;
      var root = this.root;
      root.addEventListener('click', function (e) {
        var row = e.target.closest('[data-line]');
        if (row) {
          var id = row.getAttribute('data-line');
          if (e.target.closest('[data-qty]')) {
            var delta = Number(e.target.closest('[data-qty]').getAttribute('data-qty'));
            var input = row.querySelector('[data-qty-input]');
            db.setCartQty(id, Number(input.value) + delta);
            L.refreshCounters();
            self.render();
            return;
          }
          if (e.target.closest('[data-remove]')) {
            db.removeFromCart(id);
            L.toast('Товар удалён из корзины', 'info');
            L.refreshCounters();
            self.render();
            return;
          }
        }
        if (e.target.closest('[data-cart-clear]')) {
          L.confirm('Удалить все товары из корзины?', { danger: true, confirmText: 'Очистить' })
            .then(function (yes) {
              if (!yes) return;
              db.clearCart();
              state.promo = null;
              L.refreshCounters();
              self.render();
              L.toast('Корзина очищена', 'info');
            });
          return;
        }
        if (e.target.closest('[data-promo-apply]')) {
          var promoTarget = root.querySelector('[data-promo-input]');
          var code = (promoTarget.value || '').trim().toUpperCase();
          if (!code) { L.toast('Введите промокод', 'warn'); return; }
          var promo = db.findPromo(code);
          if (!promo) { L.toast('Промокод не найден', 'danger'); return; }
          if (!promo.active) { L.toast('Промокод больше не действует', 'warn'); return; }
          if (db.cartTotals().subtotal < promo.min) {
            L.toast('Промокод действует от ' + U.money(promo.min), 'warn');
            return;
          }
          state.promo = promo;
          L.toastOk('Промокод применён: ' + db.promoLabel(promo), 'Скидка активна');
          self.render();
          return;
        }
        var tag = e.target.closest('[data-promo-tag]');
        if (tag) {
          root.querySelector('[data-promo-input]').value = tag.getAttribute('data-promo-tag');
          root.querySelector('[data-promo-apply]').click();
          return;
        }
        if (e.target.closest('[data-checkout]')) self.openCheckout();
      });
    }
  };
})();
