/* ==========================================================================
   ByteStore — API иконок и рейтинга + генератор изображений товаров
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});

  BS.icons = Object.assign(BS.icons || {}, {
    'github': '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    'youtube': '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><path d="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z"/>',
    'telegram': '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    'vk': '<path d="M12.9 17.3c-5.3 0-8.5-3.7-8.6-9.7h2.6c.1 4.4 2.2 6.3 3.7 6.7V7.6h2.5v4c1.5-.2 3-1.7 3.5-4h2.5c-.4 2.7-1.9 4.2-3 4.9 1.1.6 2.8 2 3.4 4.8h-2.8c-.5-1.8-1.8-3.1-3.6-3.4v3.4h-.2z"/>'
  });

  /**
   * HTML-строка с иконкой.
   * @param {string} name — ключ из BS.icons
   * @param {{size:number,cls:string,fill:boolean,stroke:number}} [opts]
   */
  BS.icon = function (name, opts) {
    opts = opts || {};
    var body = BS.icons[name] || BS.icons['info'];
    var size = opts.size || 20;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' +
      (opts.fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="' +
      (opts.stroke || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" class="' +
      (opts.cls || '') + '" aria-hidden="true">' + body + '</svg>';
  };
  BS.hasIcon = function (name) { return !!BS.icons[name]; };

  /** Звёзды рейтинга 0..5 (полузакрашенная звезда = .5) */
  BS.stars = function (rating, opts) {
    opts = opts || {};
    var size = opts.size || 15;
    var full = Math.round((Number(rating) || 0) * 2) / 2;
    var out = '';
    for (var i = 1; i <= 5; i++) {
      var on = i <= Math.floor(full);
      var half = !on && (full - Math.floor(full)) >= 0.5 && i === Math.ceil(full);
      out += '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' +
        (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" class="' +
        (on || half ? 'on' : 'off') + '"' + (half ? ' opacity=".6"' : '') +
        '><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    return '<span class="stars' + (opts.cls ? ' ' + opts.cls : '') + '">' + out + '</span>';
  };

  /**
   * Изображение товара. Если у товара есть реальный URL — отдаём <img>,
   * иначе генерируем SVG-иллюстрацию по категории (работает офлайн).
   */
  BS.art = function (product, opts) {
    opts = opts || {};
    if (!product) return '';
    var cat = (BS.db && BS.db.category(product.categoryId)) || {};
    var alt = BS.util.esc(product.name || 'Товар');
    if (product.image && /^(https?:|data:|\.|\/)/.test(product.image)) {
      return '<img src="' + BS.util.attr(product.image) + '" alt="' + alt + '" loading="lazy">';
    }
    var color = cat.color || '#22d3ee';
    var color2 = cat.color2 || '#8b5cf6';
    var gid = 'bg_' + String(product.id || Math.random()).replace(/[^a-z0-9]/gi, '');
    var labels = (product.key || []).slice(0, 2).join(' · ');
    if (labels.length > 33) labels = labels.slice(0, 30).trim() + '…';
    var body = BS.icons[cat.icon] || BS.icons['box'];
    if (product.categoryId === 'prebuilt') {
      body = '<rect x="3" y="1" width="18" height="21" rx="2"/>' +
        '<path d="M15 1v21M6 5h6v11H6zM5 22v1m14-1v1M7 18h4"/>' +
        '<g stroke-width="1"><circle cx="18" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>' +
        '<path d="m17 5 2 2m-2 4 2 2m-2 4 2 2M7 8h4m-4 2h4m-4 2h4"/></g>';
    }
    return '' +
      '<svg viewBox="0 0 320 240" role="img" aria-label="' + alt + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".28"/>' +
      '<stop offset="100%" stop-color="' + color2 + '" stop-opacity=".18"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="320" height="240" fill="url(#' + gid + ')"/>' +
      '<circle cx="268" cy="42" r="70" fill="' + color + '" fill-opacity=".12"/>' +
      '<circle cx="46" cy="212" r="56" fill="' + color2 + '" fill-opacity=".12"/>' +
      '<g transform="translate(112,74) scale(4)" fill="none" stroke="' + color +
      '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + body + '</g>' +
      (labels ? '<text x="160" y="216" text-anchor="middle" font-family="ui-monospace, monospace" ' +
        'font-size="13" fill="' + color + '" fill-opacity=".85">' + BS.util.esc(labels) + '</text>' : '') +
      '</svg>';
  };
})();
