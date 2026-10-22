/* ==========================================================================
   ByteStore — Страницы входа и регистрации
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, L = BS.layout;
  var pages = (BS.pages = BS.pages || {});

  function aside(title, text, items) {
    return '<div class="auth-aside">' +
      '<span class="hero__eyebrow">' + BS.icon('shield', { size: 14 }) + ' Безопасный вход</span>' +
      '<h2>' + U.esc(title) + '</h2><p class="lead">' + text + '</p>' +
      '<div class="auth-aside__list">' + items.map(function (item) {
        return '<div class="auth-aside__item">' + BS.icon(item.icon, { size: 22 }) +
          '<div><b>' + U.esc(item.title) + '</b><span>' + U.esc(item.text) + '</span></div></div>';
      }).join('') + '</div></div>';
  }

  /* -------------------------------- Вход ---------------------------------- */
  pages.login = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      var next = U.qs('next') || 'account.html';
      if (BS.auth.isLoggedIn()) {
        root.innerHTML = '<div class="container section">' + L.emptyState({
          emoji: '✅', title: 'Вы уже вошли',
          text: 'Текущий пользователь: ' + BS.auth.user().name,
          action: '<div class="btn-group"><a class="btn btn--primary" href="account.html">Личный кабинет</a>' +
            '<button class="btn btn--outline" data-logout-now>Выйти</button></div>'
        }) + '</div>';
        root.addEventListener('click', async function (e) {
          if (e.target.closest('[data-logout-now]')) {
            await BS.auth.logout();
            window.location.href = 'index.html';
          }
        });
        return;
      }
      root.innerHTML = '<div class="container"><div class="auth-wrap">' +
        aside('Вход в личный кабинет ByteStore',
          'Отслеживайте заказы, храните избранное, оставляйте отзывы и получайте персональные подборки.',
          [
            { icon: 'truck', title: 'История заказов', text: 'Статус доставки и состав покупок' },
            { icon: 'gift', title: '10 000 бонусов новым клиентам', text: 'Оплата до 30 % заказа бонусами' }
          ]) +
        '<div class="card auth-card"><h3>Вход</h3>' +
        '<p class="muted small">Введите e-mail и пароль, указанные при регистрации.</p>' +
        '<form data-login-form>' +
        '<div class="field"><label for="lnEmail">E-mail</label>' +
        '<input class="input" id="lnEmail" name="email" type="email" autocomplete="email" required ' +
        'placeholder="client@mail.kz"></div>' +
        '<div class="field"><label for="lnPass">Пароль</label>' +
        '<div class="row gap-2"><input class="input" id="lnPass" name="password" type="password" ' +
        'autocomplete="current-password" required placeholder="••••••••">' +
        '<button class="btn btn--outline btn--icon" type="button" data-toggle-password aria-label="Показать пароль">' +
        BS.icon('eye', { size: 18 }) + '</button></div></div>' +
        '<label class="check mb-4"><input type="checkbox" name="remember" checked>' +
        '<span class="grow">Запомнить меня на этом устройстве</span></label>' +
        '<div data-login-error></div>' +
        '<button class="btn btn--primary btn--lg btn--block" type="submit">' + BS.icon('logout', { size: 18 }) +
        'Войти</button></form>' +
        (BS.cloud ? '' : '<div class="divider mt-5">или</div>') +
        (BS.cloud ? '' : '<p class="muted small center mt-3">Демонстрационные аккаунты из базы данных:</p>') +
        '<div class="promo-list" data-demo-accounts>' +
        BS.auth.demoAccounts().slice(0, 3).map(function (account, index) {
          return '<button class="chip" data-demo-login="' + index + '">' + U.esc(account.name) + '</button>';
        }).join('') + '</div>' +
        '<p class="small mt-5 center">Нет аккаунта? <a href="register.html">Зарегистрируйтесь</a> — это займёт минуту.</p>' +
        (BS.cloud ? '' : '<p class="muted small center mt-2">Пароль демо-аккаунтов: <span class="mono">demo1234</span></p>') +
        '</div></div></div>';
      if (BS.cloud && BS.cloud.confirmationError) {
        var notice = document.createElement('p'); notice.className = 'alert alert--warn';
        notice.textContent = BS.cloud.confirmationError;
        root.querySelector('[data-login-error]').appendChild(notice);
      }
      this.wire(root, next);
    },
    /* ------------------------------ Обработчики ----------------------------- */
    wire: function (root, next) {
      var form = root.querySelector('[data-login-form]');
      var toggle = root.querySelector('[data-toggle-password]');
      if (toggle) {
        toggle.addEventListener('click', async function () {
          var input = root.querySelector('#lnPass');
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          toggle.innerHTML = BS.icon(show ? 'eye-off' : 'eye', { size: 18 });
        });
      }
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var button = form.querySelector('button[type="submit"]');
        var errorBox = root.querySelector('[data-login-error]');
        var data = new FormData(form);
        button.classList.add('is-loading');
        BS.auth.login(data.get('email'), data.get('password')).then(async function (result) {
          button.classList.remove('is-loading');
          if (!result.ok) {
            errorBox.innerHTML = '<div class="alert alert--danger"><span class="alert__icon">⚠️</span>' +
              '<div class="alert__body"><strong>Не удалось войти</strong><p>' + U.esc(result.message) +
              '</p></div></div>';
            return;
          }
          L.toastOk(result.message + ' Перенаправляем…', 'Вход выполнен');
          setTimeout(function () { window.location.href = next; }, 700);
        });
      });
      root.addEventListener('click', async function (e) {
        var demo = e.target.closest('[data-demo-login]');
        if (!demo) return;
        var account = BS.auth.demoAccounts()[Number(demo.getAttribute('data-demo-login'))];
        root.querySelector('#lnEmail').value = account.email;
        root.querySelector('#lnPass').value = account.password;
        L.toast('Данные подставлены — нажмите «Войти»', 'info', 'Демо-аккаунт');
      });
    }
  };
  /* ------------------------------ Регистрация ------------------------------ */
  pages.register = {
    init: function () {
      var root = U.$('#pageContent');
      if (!root) return;
      root.innerHTML = '<div class="container"><div class="auth-wrap">' +
        aside('Создайте аккаунт ByteStore',
          'Регистрация занимает минуту: история заказов, персональные подборки и 10 000 приветственных бонусов.',
          [
            { icon: 'gift', title: '10 000 бонусов сразу', text: 'Оплата до 30 % заказа' },
            { icon: 'sparkles', title: 'Сохранённые конфигурации', text: 'Возвращайтесь к сборкам в один клик' }
          ]) +
        '<div class="card auth-card"><h3>Регистрация</h3>' +
        '<p class="muted small">Все поля обязательны, кроме галочки рассылки.</p>' +
        '<form data-register-form>' +
        '<div class="field"><label for="rgName">Имя и фамилия</label>' +
        '<input class="input" id="rgName" name="name" required placeholder="Аскар Нурланов"></div>' +
        '<div class="admin-split">' +
        '<div class="field"><label for="rgEmail">E-mail</label>' +
        '<input class="input" id="rgEmail" name="email" type="email" required placeholder="client@mail.kz"></div>' +
        '<div class="field"><label for="rgPhone">Телефон</label>' +
        '<input class="input" id="rgPhone" name="phone" required placeholder="+7 999 123-45-67"></div></div>' +
        '<div class="field"><label for="rgPass">Пароль</label>' +
        '<input class="input" id="rgPass" name="password" type="password" required ' +
        'placeholder="минимум 8 символов">' +
        '<div class="strength" data-strength><i></i><i></i><i></i><i></i></div>' +
        '<span class="hint" data-strength-text>Придумайте пароль длиннее 10 символов с цифрами</span></div>' +
        '<div class="field"><label for="rgPass2">Повторите пароль</label>' +
        '<input class="input" id="rgPass2" name="password2" type="password" required placeholder="••••••••"></div>' +
        '<label class="check mb-3"><input type="checkbox" name="newsletter" checked>' +
        '<span class="grow">Присылать скидки и новости ByteStore</span></label>' +
        '<label class="check mb-4"><input type="checkbox" name="agree" checked>' +
        '<span class="grow">Я принимаю условия использования и политику конфиденциальности</span></label>' +
        '<div data-register-error></div>' +
        '<button class="btn btn--primary btn--lg btn--block" type="submit">' + BS.icon('user', { size: 18 }) +
        'Создать аккаунт</button></form>' +
        '<p class="small mt-5 center">Уже есть аккаунт? <a href="login.html">Войти</a></p>' +
        '</div></div></div>';
      this.wire(root);
    },

    wire: function (root) {
      var form = root.querySelector('[data-register-form]');
      var passwordInput = root.querySelector('#rgPass');
      var strength = root.querySelector('[data-strength]');
      var strengthText = root.querySelector('[data-strength-text]');
      var labels = [
        'Слабый пароль — добавьте цифры и заглавные буквы',
        'Простой пароль — увеличьте длину',
        'Хороший пароль',
        'Надёжный пароль 🔒',
        'Максимальная стойкость 🔐'
      ];
      passwordInput.addEventListener('input', async function () {
        var score = U.passwordScore(passwordInput.value);
        Array.prototype.forEach.call(strength.children, function (bar, index) {
          bar.className = index < score ? 'on-' + score : '';
        });
        strengthText.textContent = labels[score] || labels[0];
      });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var button = form.querySelector('button[type="submit"]');
        var errorBox = root.querySelector('[data-register-error]');
        if (button.disabled) return;
        button.disabled = true;
        var data = new FormData(form);
        button.classList.add('is-loading');
        BS.auth.register({
          name: data.get('name'),
          email: data.get('email'),
          phone: data.get('phone'),
          password: data.get('password'),
          password2: data.get('password2'),
          newsletter: data.get('newsletter') === 'on',
          agree: data.get('agree') === 'on'
        }).then(async function (result) {
          button.classList.remove('is-loading');
          button.disabled = false;
          if (!result.ok) {
            var errors = result.errors || {};
            errorBox.innerHTML = '<div class="alert alert--danger"><span class="alert__icon">⚠️</span>' +
              '<div class="alert__body"><strong>' + U.esc(result.message) + '</strong><p>' +
              Object.keys(errors).map(function (key) { return U.esc(errors[key]); }).join('<br>') +
              '</p></div></div>';
            return;
          }
          if (result.pendingConfirmation) {
            errorBox.innerHTML = '<div class="alert alert--info">' + U.esc(result.message) + '</div>';
            button.disabled = true;
            button.textContent = 'Проверьте почту для подтверждения';
            root.querySelectorAll('[data-register-form] input').forEach(function(input){input.disabled=true;});
            return;
          }
          L.toastOk(result.message + (BS.cloud ? '' : ' Начислено 10 000 бонусов'), 'Регистрация завершена');
          setTimeout(function () { window.location.href = 'account.html'; }, 900);
        });
      });
    }
  };
})();
