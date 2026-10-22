/* ==========================================================================
   ByteStore — Bootstrap: инициализация БД, каркаса и модуля текущей страницы
   ========================================================================== */
(function () {
  'use strict';

  var BS = window.BS;

  function boot() {
    if (!BS || !BS.db) {
      console.error('ByteStore: не загружено ядро приложения');
      return;
    }
    if (!BS.cloud) {
      var unavailable = document.getElementById('pageContent') || document.getElementById('adminRoot');
      if (unavailable) unavailable.innerHTML = '<div class="container section"><div class="alert alert--danger">Не удалось загрузить подключение к магазину. Проверьте интернет и обновите страницу.</div></div>';
      return;
    }
    BS.db.init().then(function () {
      BS.db.visit();
      var page = document.body.getAttribute('data-page') || 'home';
      if (page === 'admin') {
        if (BS.admin && BS.admin.init) BS.admin.init();
        return;
      }
      if (BS.layout && BS.layout.init) BS.layout.init();
      var module = BS.pages && BS.pages[page];
      if (module && module.init) {
        module.init();
      } else if (page !== 'home') {
        var root = document.getElementById('pageContent');
        if (root) {
          root.innerHTML = '<div class="container section">' + BS.layout.emptyState({
            emoji: '🚧', title: 'Страница в разработке',
            text: 'Раздел появится в следующей версии ByteStore.',
            action: '<a class="btn btn--primary" href="index.html">На главную</a>'
          }) + '</div>';
        }
      }
      wireShortcuts();
    }).catch(function (error) {
      console.error('ByteStore: ошибка инициализации', error);
      var root = document.getElementById('pageContent') || document.getElementById('adminRoot');
      if (root) {
        root.innerHTML = '<div class="container section"><div class="alert alert--danger">' +
          '<span class="alert__icon">⚠️</span><div class="alert__body"><strong>Не удалось загрузить магазин</strong>' +
          '<p>' + BS.util.esc(error.message || 'Проверьте подключение к интернету и повторите попытку.') + '</p><button class="btn btn--primary" onclick="location.reload()">Повторить</button>' +
          '</div></div></div>';
      }
    });
  }

  /** Горячие клавиши: Ctrl+K — поиск, Ctrl+Alt+C — корзина, Esc — закрыть. */
  function wireShortcuts() {
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        var input = document.getElementById('globalSearch');
        if (input) input.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'c') {
        e.preventDefault();
        if (BS.layout && BS.layout.openCartDrawer) BS.layout.openCartDrawer();
      }
    });
  }

  /** Мелкая помощь для проверки в консоли: BS.help() */
  BS.help = function () {
    console.log('%cByteStore ' + BS.util.APP.version, 'font-weight:bold;color:#22d3ee');
    console.log('Доступные модули: BS.db, BS.auth, BS.advisor, BS.ai, BS.layout, BS.cards, BS.pages, BS.admin');
    console.log('Проверка функций: BS.db.analytics(30), BS.advisor.localBuild({budget:120000,purpose:"gaming"})');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
