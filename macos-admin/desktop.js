(function () {
  'use strict';
  BS.util.download = function (name, content) {
    window.webkit.messageHandlers.saveFile.postMessage({name: name, content: String(content)});
  };
  window.desktopAdmin = {
    backup: function () {
      if (!BS.db.isAdmin()) {
        alert('Войдите в админку, чтобы сохранить резервную копию.');
        return;
      }
      BS.util.download('bytestore-export.json', JSON.stringify(BS.db.state, null, 2));
    }
  };
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a');
    if (link && /^(index|product)\.html/.test(link.getAttribute('href') || '')) {
      event.preventDefault();
      var href = link.getAttribute('href');
      window.open('https://stereofox08.github.io/Diplom/' + href, '_blank');
    }
  }, true);
})();
