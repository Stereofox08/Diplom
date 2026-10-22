/* ==========================================================================
   ByteStore — Аутентификация пользователей (регистрация, вход, профиль)
   Пароли хранятся только в виде соли + SHA-256 хеша.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var auth = (BS.auth = {});

  var SESSION_KEY = db.SESSION_KEY;

  /* ------------------------------- Сессия --------------------------------- */
  auth.session = function () { return U.storage.get(SESSION_KEY, null); };
  auth.userId = function () {
    var session = auth.session();
    return session ? session.userId : null;
  };
  auth.user = function () {
    var id = auth.userId();
    return id ? db.user(id) : null;
  };
  auth.isLoggedIn = function () {
    var user = auth.user();
    return !!(user && user.status !== 'blocked');
  };
  auth.initials = function (name) {
    var parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  };
  auth.firstName = function () {
    var user = auth.user();
    return user ? String(user.name).split(' ')[0] : '';
  };
  function saveSession(user) {
    U.storage.set(SESSION_KEY, { userId: user.id, name: user.name, role: user.role, ts: Date.now() });
  }

  /* ------------------------------ Валидация ------------------------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zа-я]{2,}$/i;
  auth.validateEmail = function (email) {
    if (!email) return 'Укажите e-mail';
    if (!EMAIL_RE.test(String(email).trim())) return 'Некорректный e-mail (пример: client@mail.kz)';
    return null;
  };
  auth.validatePhone = function (phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return 'Укажите телефон в формате +7 999 123-45-67';
    return null;
  };
  auth.validatePassword = function (password) {
    if (!password || String(password).length < 6) return 'Пароль должен содержать минимум 6 символов';
    return null;
  };

  /* ------------------------------ Регистрация ----------------------------- */
  auth.register = function (data) {
    data = data || {};
    var errors = {};
    if (!String(data.name || '').trim()) errors.name = 'Укажите имя';
    else if (String(data.name).trim().length < 2) errors.name = 'Слишком короткое имя';
    var emailError = auth.validateEmail(data.email);
    if (emailError) errors.email = emailError;
    var phoneError = auth.validatePhone(data.phone);
    if (phoneError) errors.phone = phoneError;
    var passError = auth.validatePassword(data.password);
    if (passError) errors.password = passError;
    if (data.password !== data.password2) errors.password2 = 'Пароли не совпадают';
    if (data.agree === false) errors.agree = 'Нужно принять условия использования';
    if (Object.keys(errors).length) {
      return Promise.resolve({ ok: false, errors: errors, message: 'Проверьте заполнение формы' });
    }
    if (db.userByEmail(data.email)) {
      return Promise.resolve({ ok: false, errors: { email: 'Этот e-mail уже зарегистрирован' }, message: 'Пользователь уже существует' });
    }
    var salt = U.salt();
    return U.hashPassword(data.password, salt).then(function (hash) {
      var guestOwner = db.cartOwner();
      var user = {
        id: U.uid('u'),
        name: String(data.name).trim(),
        email: String(data.email).trim(),
        phone: String(data.phone).trim(),
        salt: salt,
        passHash: hash,
        role: 'user',
        status: 'active',
        bonus: 10000,
        newsletter: data.newsletter !== false,
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      db.state.users.push(user);
      saveSession(user);
      db.transferCart(guestOwner, user.id);
      db.audit('Регистрация пользователя ' + user.email, user.name);
      db.track('register', { label: user.email });
      db.save();
      return { ok: true, user: user, message: 'Аккаунт создан. Привет, ' + auth.firstName() + '!' };
    });
  };
  /* --------------------------------- Вход --------------------------------- */
  auth.login = function (email, password) {
    var user = db.userByEmail(email);
    if (!user) return Promise.resolve({ ok: false, message: 'Пользователь с таким e-mail не найден' });
    if (user.status === 'blocked') return Promise.resolve({ ok: false, message: 'Аккаунт заблокирован. Обратитесь в поддержку' });
    return U.hashPassword(password, user.salt).then(function (hash) {
      if (hash !== user.passHash) {
        db.audit('Неудачная попытка входа: ' + email, 'security');
        db.save();
        return { ok: false, message: 'Неверный пароль' };
      }
      var guestOwner = db.cartOwner();
      user.lastLogin = Date.now();
      saveSession(user);
      if (guestOwner !== user.id) db.transferCart(guestOwner, user.id);
      db.audit('Вход пользователя ' + user.email, user.name);
      db.track('login', { label: user.email });
      db.save();
      return { ok: true, user: user, message: 'С возвращением, ' + auth.firstName() + '!' };
    });
  };

  auth.logout = function () {
    var user = auth.user();
    if (user) {
      db.audit('Выход пользователя ' + user.email, user.name);
      db.track('logout', { label: user.email });
      db.save();
    }
    U.storage.remove(SESSION_KEY);
    return true;
  };

  /* ------------------------------- Профиль -------------------------------- */
  auth.updateProfile = function (patch) {
    var user = auth.user();
    if (!user) return { ok: false, message: 'Требуется вход' };
    patch = patch || {};
    var errors = {};
    if (patch.name !== undefined) {
      if (!String(patch.name).trim()) errors.name = 'Укажите имя';
      else user.name = String(patch.name).trim();
    }
    if (patch.email !== undefined) {
      var emailError = auth.validateEmail(patch.email);
      if (emailError) errors.email = emailError;
      else {
        var existing = db.userByEmail(patch.email);
        if (existing && existing.id !== user.id) errors.email = 'Этот e-mail занят другим аккаунтом';
        else user.email = String(patch.email).trim();
      }
    }
    if (patch.phone !== undefined) {
      var phoneError = auth.validatePhone(patch.phone);
      if (phoneError) errors.phone = phoneError;
      else user.phone = String(patch.phone).trim();
    }
    if (patch.newsletter !== undefined) user.newsletter = !!patch.newsletter;
    if (Object.keys(errors).length) return { ok: false, errors: errors, message: 'Проверьте данные' };
    saveSession(user);
    db.audit('Обновлён профиль ' + user.email, user.name);
    db.save();
    return { ok: true, message: 'Профиль сохранён', user: user };
  };

  auth.changePassword = function (current, next, next2) {
    var user = auth.user();
    if (!user) return Promise.resolve({ ok: false, message: 'Требуется вход' });
    if (next !== next2) return Promise.resolve({ ok: false, message: 'Новые пароли не совпадают' });
    var passError = auth.validatePassword(next);
    if (passError) return Promise.resolve({ ok: false, message: passError });
    return U.hashPassword(current, user.salt).then(function (hash) {
      if (hash !== user.passHash) return { ok: false, message: 'Текущий пароль неверен' };
      var salt = U.salt();
      return U.hashPassword(next, salt).then(function (newHash) {
        user.salt = salt;
        user.passHash = newHash;
        db.audit('Смена пароля пользователя ' + user.email, user.name);
        db.save();
        return { ok: true, message: 'Пароль изменён' };
      });
    });
  };

  /** Защита страниц: неавторизованных отправляем на вход с возвратом. */
  auth.requireLogin = function (nextUrl) {
    if (auth.isLoggedIn()) return true;
    var target = nextUrl || (window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = 'login.html?next=' + encodeURIComponent(target);
    return false;
  };

  /** Быстрый вход в демо-аккаунт (кнопки на странице входа). */
  auth.loginAsDemo = function (index) {
    var demo = BS.seed.demoUsers[index || 0];
    if (!demo) return Promise.resolve({ ok: false, message: 'Демо-аккаунт не найден' });
    return auth.login(demo.email, demo.password);
  };
  auth.demoAccounts = function () {
    return BS.seed.demoUsers.map(function (u) {
      return { name: u.name, email: u.email, password: u.password };
    });
  };
})();

