/* ==========================================================================
   ByteStore — Лёгкие графики на canvas для дашборда админ-панели
   Без сторонних библиотек: линия/область, столбцы, пончик, спарклайн.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util;
  var charts = (BS.charts = {});

  function css(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (value || '').trim() || fallback;
  }
  function setup(canvas) {
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || canvas.parentNode.clientWidth || 600;
    var height = rect.height || 240;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }
  function money(value) {
    if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1).replace('.0', '') + ' млн ₸';
    if (Math.abs(value) >= 1000) return Math.round(value / 1000) + ' тыс ₸';
    return Math.round(value) + ' ₸';
  }
  charts.money = money;

  /** Плавная линия выручки с заливкой, сеткой и подсказкой. */
  charts.line = function (canvas, series, options) {
    if (!canvas) return;
    options = options || {};
    var env = setup(canvas), ctx = env.ctx;
    var width = env.width, height = env.height;
    var padding = { top: 18, right: 16, bottom: 26, left: 56 };
    var innerW = width - padding.left - padding.right;
    var innerH = height - padding.top - padding.bottom;
    var max = Math.max.apply(null, series.map(function (p) { return p.value; }).concat([1])) * 1.15;
    var accent = options.color || css('--accent', '#22d3ee');
    var textColor = css('--text-3', '#6d7a97');
    var gridColor = css('--border', 'rgba(255,255,255,.08)');

    ctx.font = '11px ' + css('--font-sans', 'sans-serif');
    for (var g = 0; g <= 4; g++) {
      var gridY = padding.top + (innerH / 4) * g;
      ctx.strokeStyle = gridColor;
      ctx.beginPath();
      ctx.moveTo(padding.left, gridY);
      ctx.lineTo(padding.left + innerW, gridY);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.fillText(options.moneyAxis === false ? String(Math.round(max - (max / 4) * g)) : money(max - (max / 4) * g),
        padding.left - 8, gridY + 4);
    }
    if (!series.length) return;

    var step = series.length > 1 ? innerW / (series.length - 1) : innerW;
    var points = series.map(function (point, index) {
      return {
        x: padding.left + step * index,
        y: padding.top + innerH - (point.value / max) * innerH,
        label: point.label,
        value: point.value
      };
    });

    var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + innerH);
    gradient.addColorStop(0, 'rgba(34, 211, 238, .34)');
    gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + innerH);
    points.forEach(function (point) { ctx.lineTo(point.x, point.y); });
    ctx.lineTo(points[points.length - 1].x, padding.top + innerH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = accent;
    ctx.lineJoin = 'round';
    points.forEach(function (point, index) {
      if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    var every = Math.max(1, Math.ceil(series.length / 8));
    series.forEach(function (point, index) {
      if (index % every !== 0 && index !== series.length - 1) return;
      ctx.fillText(point.label, points[index].x, height - 8);
    });

    charts.wireHover(canvas, function (x) {
      var match = null;
      points.forEach(function (point) {
        if (!match || Math.abs(point.x - x) < Math.abs(match.x - x)) match = point;
      });
      return match
        ? { x: match.x, y: match.y, text: match.label + ': ' + (options.moneyAxis === false ? U.num(match.value) : money(match.value)) }
        : null;
    });
  };
  /** Столбчатая диаграмма (заказы по дням, топ категорий и т. п.). */
  charts.bars = function (canvas, series, options) {
    if (!canvas) return;
    options = options || {};
    var env = setup(canvas), ctx = env.ctx;
    var width = env.width, height = env.height;
    var padding = { top: 16, right: 12, bottom: 26, left: 48 };
    var innerW = width - padding.left - padding.right;
    var innerH = height - padding.top - padding.bottom;
    var max = Math.max.apply(null, series.map(function (p) { return p.value; }).concat([1])) * 1.15;
    var accent = options.color || css('--accent-2', '#8b5cf6');
    var textColor = css('--text-3', '#6d7a97');

    ctx.font = '11px ' + css('--font-sans', 'sans-serif');
    for (var g = 0; g <= 4; g++) {
      var gridY = padding.top + (innerH / 4) * g;
      ctx.strokeStyle = css('--border', 'rgba(255,255,255,.08)');
      ctx.beginPath();
      ctx.moveTo(padding.left, gridY);
      ctx.lineTo(padding.left + innerW, gridY);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(max - (max / 4) * g)), padding.left - 8, gridY + 4);
    }
    if (!series.length) return;

    var slot = innerW / series.length;
    var barWidth = Math.max(6, Math.min(38, slot * 0.62));
    series.forEach(function (point, index) {
      var barHeight = (point.value / max) * innerH;
      var x = padding.left + slot * index + (slot - barWidth) / 2;
      var y = padding.top + innerH - barHeight;
      var gradient = ctx.createLinearGradient(0, y, 0, padding.top + innerH);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, 'rgba(139, 92, 246, .22)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      var radius = Math.min(5, barWidth / 2);
      ctx.moveTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      ctx.lineTo(x + barWidth, padding.top + innerH);
      ctx.lineTo(x, padding.top + innerH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      if (series.length <= 14 || index % Math.ceil(series.length / 8) === 0) {
        ctx.fillText(String(point.label), x + barWidth / 2, height - 8);
      }
    });

    charts.wireHover(canvas, function (x) {
      var index = Math.floor((x - padding.left) / slot);
      if (index < 0 || index >= series.length) return null;
      var point = series[index];
      return {
        x: padding.left + slot * index + slot / 2,
        y: padding.top + innerH - (point.value / max) * innerH,
        text: point.label + ': ' + U.num(point.value)
      };
    });
  };
  /** Круговая (пончик) диаграмма распределения. */
  charts.donut = function (canvas, series, options) {
    if (!canvas) return;
    options = options || {};
    var env = setup(canvas), ctx = env.ctx;
    var size = Math.min(env.width, env.height);
    var centerX = size / 2, centerY = size / 2;
    var outer = size / 2 - 6, inner = outer * 0.62;
    var total = U.sum(series, function (point) { return point.value; });
    var palette = [css('--accent', '#22d3ee'), css('--accent-2', '#8b5cf6'), '#22c55e',
      '#f59e0b', '#fb4d6d', '#60a5fa', '#f472b6', '#a78bfa'];
    if (!total) {
      ctx.fillStyle = css('--text-3', '#6d7a97');
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных', centerX, centerY);
      return;
    }
    var start = -Math.PI / 2;
    series.forEach(function (point, index) {
      var angle = (point.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, outer, start, start + angle);
      ctx.arc(centerX, centerY, inner, start + angle, start, true);
      ctx.closePath();
      ctx.fillStyle = point.color || palette[index % palette.length];
      ctx.fill();
      start += angle;
    });
    ctx.fillStyle = css('--text', '#e9eefb');
    ctx.font = '600 18px ' + css('--font-sans', 'sans-serif');
    ctx.textAlign = 'center';
    ctx.fillText(String(total), centerX, centerY + 2);
    ctx.fillStyle = css('--text-3', '#6d7a97');
    ctx.font = '11px sans-serif';
    ctx.fillText(options.centerLabel || 'всего', centerX, centerY + 18);
  };

  /** Мини-спарклайн для KPI-карточек. */
  charts.spark = function (canvas, values, options) {
    if (!canvas || !values.length) return;
    options = options || {};
    var env = setup(canvas), ctx = env.ctx;
    var width = env.width, height = env.height;
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values.concat([0]));
    var range = Math.max(max - min, 1);
    var step = values.length > 1 ? width / (values.length - 1) : width;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = options.color || css('--ok', '#22c55e');
    values.forEach(function (value, index) {
      var x = step * index;
      var y = height - 4 - ((value - min) / range) * (height - 8);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  /** Всплывающая подсказка при наведении на график. */
  charts.wireHover = function (canvas, getPoint) {
    if (canvas.getAttribute('data-hover-wired')) return;
    canvas.setAttribute('data-hover-wired', '1');
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.display = 'none';
    canvas.parentNode.style.position = 'relative';
    canvas.parentNode.appendChild(tip);
    canvas.addEventListener('mousemove', function (event) {
      var rect = canvas.getBoundingClientRect();
      var point = getPoint(event.clientX - rect.left);
      if (!point) { tip.style.display = 'none'; return; }
      tip.style.display = 'block';
      tip.style.left = point.x + 'px';
      tip.style.top = point.y + 'px';
      tip.textContent = point.text;
    });
    canvas.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
  };
})();
