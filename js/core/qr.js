/* ==========================================================================
   ByteStore — Генератор QR-кодов для оплаты (ISO/IEC 18004)
   Byte mode + UTF-8, уровни коррекции L/M, версии 1–10, авто-выбор маски.
   Используется для оплаты через «Единый QR».
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var qr = (BS.qr = {});

  /* ------------------------------ Таблицы стандарта ----------------------- */
  /* Общее число кодовых слов по версиям 1–10 */
  var TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  /* Блоки: версия -> [ [кол-во блоков, данных в блоке, EC в блоке], ... ] */
  var EC_BLOCKS = {
    L: [
      [[1, 19, 7]], [[1, 34, 10]], [[1, 55, 15]], [[1, 80, 20]], [[1, 108, 26]],
      [[2, 68, 18]], [[2, 78, 20]], [[2, 97, 24]], [[2, 116, 30]], [[2, 68, 18], [2, 69, 18]]
    ],
    M: [
      [[1, 16, 10]], [[1, 28, 16]], [[1, 44, 26]], [[2, 32, 18]], [[2, 43, 24]],
      [[4, 27, 16]], [[4, 31, 18]], [[2, 38, 22], [2, 39, 22]], [[3, 36, 22], [2, 37, 22]],
      [[4, 43, 26], [1, 44, 26]]
    ]
  };
  /* Координаты выравнивающих узоров по версиям (кроме пересечений с поисковыми) */
  var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var EC_LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* --------------------------- Арифметика GF(256) ------------------------- */
  var EXP = new Array(256), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    EXP[255] = EXP[0];
  })();
  function gmul(a, b) {
    if (!a || !b) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }
  /* Порождающий многочлен для нужного числа EC-слов */
  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (var k = 0; k < next.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], 1);
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }
  var GEN_CACHE = {};
  /* Остаток от деления данных на порождающий многочлен = EC-слова */
  function rsRemainder(data, ecLen) {
    var gen = GEN_CACHE[ecLen] || (GEN_CACHE[ecLen] = rsGenerator(ecLen));
    var rem = new Array(ecLen);
    for (var i = 0; i < ecLen; i++) rem[i] = 0;
    for (var j = 0; j < data.length; j++) {
      var factor = data[j] ^ rem[0];
      rem.shift();
      rem.push(0);
      for (var k = 0; k < ecLen; k++) rem[k] ^= gmul(gen[k + 1], factor);
    }
    return rem;
  }
  qr.gmul = gmul;
  qr.rsRemainder = rsRemainder;
  qr.rsGenerator = rsGenerator;

  /* --------------------------- Кодирование данных ------------------------- */
  /** UTF-8 байты строки (без TextEncoder — нужен старым браузерам и тестам). */
  function utf8Bytes(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
        var next = text.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          i++;
        }
      }
      if (code < 0x80) out.push(code);
      else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return out;
  }
  qr.utf8Bytes = utf8Bytes;

  function blockStructure(version, level) {
    return EC_BLOCKS[level][version - 1];
  }
  /** Сколько байт влезает в версию при заданном уровне коррекции. */
  function capacityBytes(version, level) {
    var total = 0;
    blockStructure(version, level).forEach(function (group) { total += group[0] * group[1]; });
    return total;
  }
  qr.capacityBytes = capacityBytes;
  qr.blockStructure = blockStructure;
  qr.TOTAL_CODEWORDS = TOTAL_CODEWORDS;
  qr.gf = { exp: EXP, log: LOG };

  /** Наименьшая версия (1–10), вмещающая len байт. */
  function pickVersion(len, level) {
    for (var version = 1; version <= 10; version++) {
      var countBits = version <= 9 ? 8 : 16;
      var bits = 4 + countBits + len * 8;
      if (capacityBytes(version, level) * 8 >= bits) return version;
    }
    return 0;
  }
  qr.pickVersion = pickVersion;

  /** Максимальная длина полезных данных (байт) для версии и уровня. */
  function maxPayloadBytes(version, level) {
    var countBits = version <= 9 ? 8 : 16;
    return Math.max(0, Math.floor((capacityBytes(version, level) * 8 - 4 - countBits) / 8));
  }
  qr.maxPayloadBytes = maxPayloadBytes;

  /** Битовая строка: режим (0100) + длина + данные + терминатор и выравнивание. */
  function dataCodewords(bytes, version, level) {
    var countBits = version <= 9 ? 8 : 16;
    var bits = [0, 1, 0, 0];
    for (var i = countBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
    bytes.forEach(function (byte) {
      for (var j = 7; j >= 0; j--) bits.push((byte >> j) & 1);
    });
    var capacity = capacityBytes(version, level) * 8;
    for (var t = 0; t < 4 && bits.length < capacity; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    var words = [];
    for (var k = 0; k < bits.length; k += 8) {
      var value = 0;
      for (var b = 0; b < 8; b++) value = (value << 1) | bits[k + b];
      words.push(value);
    }
    var pad = [0xec, 0x11], index = 0;
    while (words.length < capacity / 8) words.push(pad[index++ % 2]);
    return words;
  }
  qr.dataCodewords = dataCodewords;

  /** Разбиение на блоки, расчёт EC-слов и перемежение (interleaving). */
  function finalCodewords(bytes, version, level) {
    var words = dataCodewords(bytes, version, level);
    var structure = blockStructure(version, level);
    var blocks = [], ecBlocks = [], offset = 0;
    structure.forEach(function (group) {
      for (var i = 0; i < group[0]; i++) {
        var chunk = words.slice(offset, offset + group[1]);
        offset += group[1];
        blocks.push(chunk);
        ecBlocks.push(rsRemainder(chunk, group[2]));
      }
    });
    var result = [];
    var maxData = 0;
    blocks.forEach(function (block) { maxData = Math.max(maxData, block.length); });
    for (var i = 0; i < maxData; i++) {
      blocks.forEach(function (block) { if (i < block.length) result.push(block[i]); });
    }
    for (var j = 0; j < ecBlocks[0].length; j++) {
      ecBlocks.forEach(function (block) { result.push(block[j]); });
    }
    return result;
  }
  qr.finalCodewords = finalCodewords;

  /* --------------------------- Построение матрицы ------------------------- */
  /** Каркас кода: поисковые узоры, разделители, синхронизация, выравнивание. */
  function baseMatrix(version) {
    var size = version * 4 + 17;
    var modules = [], isFunction = [];
    for (var i = 0; i < size; i++) {
      var row = [], flags = [];
      for (var j = 0; j < size; j++) { row.push(false); flags.push(false); }
      modules.push(row);
      isFunction.push(flags);
    }
    function setFn(row, col, dark) {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      modules[row][col] = !!dark;
      isFunction[row][col] = true;
    }
    /* Поисковые узоры 7×7 с разделителями */
    [[0, 0], [0, size - 7], [size - 7, 0]].forEach(function (corner) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var row = corner[0] + r, col = corner[1] + c;
          var ring = r >= 0 && r <= 6 && (c === 0 || c === 6);
          var ring2 = c >= 0 && c <= 6 && (r === 0 || r === 6);
          var core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setFn(row, col, ring || ring2 || core);
        }
      }
    });
    /* Синхронизирующие линии */
    for (var k = 0; k < size; k++) {
      setFn(6, k, k % 2 === 0);
      setFn(k, 6, k % 2 === 0);
    }
    /* Выравнивающие узоры 5×5 */
    var points = ALIGN[version - 1];
    points.forEach(function (row) {
      points.forEach(function (col) {
        var inFinder = (row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6);
        if (inFinder) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            setFn(row + dr, col + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      });
    });
    return {
      size: size, version: version, modules: modules, isFunction: isFunction,
      setFn: setFn
    };
  }
  qr.baseMatrix = baseMatrix;

  function bitOf(value, index) { return ((value >> index) & 1) === 1; }

  /** 15 информационных бит формата: уровень коррекции + маска (BCH 10 бит). */
  function formatBits(level, mask) {
    var data = (EC_LEVEL_BITS[level] << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }
  qr.formatBits = formatBits;

  /** 18 бит информации о версии (только для версий 7+). */
  function versionBits(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    return (version << 12) | rem;
  }
  qr.versionBits = versionBits;

  function drawFormat(base, level, mask) {
    var size = base.size, bits = formatBits(level, mask), i;
    for (i = 0; i <= 5; i++) base.setFn(i, 8, bitOf(bits, i));
    base.setFn(7, 8, bitOf(bits, 6));
    base.setFn(8, 8, bitOf(bits, 7));
    base.setFn(8, 7, bitOf(bits, 8));
    for (i = 9; i < 15; i++) base.setFn(8, 14 - i, bitOf(bits, i));
    for (i = 0; i < 8; i++) base.setFn(8, size - 1 - i, bitOf(bits, i));
    for (i = 8; i < 15; i++) base.setFn(size - 15 + i, 8, bitOf(bits, i));
    base.setFn(size - 8, 8, true);
  }
  qr.drawFormat = drawFormat;

  function drawVersion(base, version) {
    if (version < 7) return;
    var size = base.size, bits = versionBits(version);
    for (var i = 0; i < 18; i++) {
      var dark = bitOf(bits, i);
      var a = size - 11 + (i % 3), b = Math.floor(i / 3);
      base.setFn(b, a, dark);
      base.setFn(a, b, dark);
    }
  }
  qr.drawVersion = drawVersion;

  /** Укладка кодовых слов «змейкой» в свободные модули (биты от старшего). */
  function placeData(base, codewords) {
    var size = base.size, bits = [];
    codewords.forEach(function (word) {
      for (var b = 7; b >= 0; b--) bits.push((word >> b) & 1);
    });
    var index = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          var upward = ((right + 1) & 2) === 0;
          var row = upward ? size - 1 - vert : vert;
          if (base.isFunction[row][col] || index >= bits.length) continue;
          base.modules[row][col] = bits[index] === 1;
          index++;
        }
      }
    }
    return index;
  }
  qr.placeData = placeData;

  /* Восемь масок стандарта (i — строка, j — столбец) */
  var MASKS = [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; },
    function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }
  ];
  qr.MASKS = MASKS;

  function applyMask(base, mask) {
    var fn = MASKS[mask];
    for (var row = 0; row < base.size; row++) {
      for (var col = 0; col < base.size; col++) {
        if (base.isFunction[row][col]) continue;
        if (fn(row, col)) base.modules[row][col] = !base.modules[row][col];
      }
    }
  }
  qr.applyMask = applyMask;

  /* --------------------- Оценка маски по правилам стандарта ---------------- */
  var N1 = 3, N2 = 3, N3 = 40, N4 = 10;
  function penalty(modules) {
    var size = modules.length, score = 0, row, col;
    /* N1: пять и более одинаковых модулей подряд */
    for (row = 0; row < size; row++) {
      var runRow = 1, runCol = 1;
      for (col = 1; col < size; col++) {
        runRow = modules[row][col] === modules[row][col - 1] ? runRow + 1 : 1;
        runCol = modules[col][row] === modules[col - 1][row] ? runCol + 1 : 1;
        if (runRow === 5) score += N1;
        else if (runRow > 5) score += 1;
        if (runCol === 5) score += N1;
        else if (runCol > 5) score += 1;
      }
    }
    /* N2: блоки 2×2 одного цвета */
    for (row = 0; row < size - 1; row++) {
      for (col = 0; col < size - 1; col++) {
        var first = modules[row][col];
        if (first === modules[row][col + 1] && first === modules[row + 1][col] &&
            first === modules[row + 1][col + 1]) score += N2;
      }
    }
    /* N3: узор 1:1:3:1:1 с четырьмя светлыми модулями по краю */
    var patterns = ['10111010000', '00001011101'];
    function lineScore(line) {
      var total = 0;
      patterns.forEach(function (pattern) {
        var at = line.indexOf(pattern);
        while (at !== -1) { total += N3; at = line.indexOf(pattern, at + 1); }
      });
      return total;
    }
    for (row = 0; row < size; row++) {
      var horizontal = '', vertical = '';
      for (col = 0; col < size; col++) {
        horizontal += modules[row][col] ? '1' : '0';
        vertical += modules[col][row] ? '1' : '0';
      }
      score += lineScore(horizontal) + lineScore(vertical);
    }
    /* N4: отклонение доли тёмных модулей от 50 % */
    var dark = 0;
    for (row = 0; row < size; row++) {
      for (col = 0; col < size; col++) if (modules[row][col]) dark++;
    }
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    if (k > 0) score += k * N4;
    return score;
  }
  qr.penalty = penalty;

  /* ------------------------------- Публичный API -------------------------- */
  /**
   * Кодирование строки в QR-код.
   * @param {string} text — данные (UTF-8)
   * @param {{level?:string, version?:number}} [options] уровень L|M, версия 1–10
   * @returns {{size:number,version:number,level:string,mask:number,modules:boolean[][]}}
   */
  qr.encode = function (text, options) {
    options = options || {};
    var level = String(options.level || 'M').toUpperCase();
    if (level !== 'L' && level !== 'M') level = 'M';
    var bytes = utf8Bytes(text === null || text === undefined ? '' : String(text));
    var version = Number(options.version) || pickVersion(bytes.length, level);
    if (!version || version > 10) throw new Error('Текст слишком длинный для QR-кода');
    var codewords = finalCodewords(bytes, version, level);
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var base = baseMatrix(version);
      drawFormat(base, level, mask);
      drawVersion(base, version);
      placeData(base, codewords);
      applyMask(base, mask);
      var score = penalty(base.modules);
      if (!best || score < best.score) best = { score: score, mask: mask, base: base };
    }
    return {
      size: best.base.size,
      version: version,
      level: level,
      mask: best.mask,
      score: best.score,
      codewords: codewords,
      modules: best.base.modules,
      isFunction: best.base.isFunction
    };
  };

  /**
   * QR-код в виде SVG.
   * @param {string} text
   * @param {{size?:number,margin?:number,dark?:string,light?:string,level?:string,cls?:string}} [options]
   * @returns {string}
   */
  qr.svg = function (text, options) {
    options = options || {};
    var code = qr.encode(text, options);
    var quiet = options.margin === undefined ? 3 : Number(options.margin);
    var side = code.size + quiet * 2;
    var path = '';
    for (var row = 0; row < code.size; row++) {
      for (var col = 0; col < code.size; col++) {
        if (!code.modules[row][col]) continue;
        path += 'M' + (col + quiet) + ' ' + (row + quiet) + 'h1v1h-1z';
      }
    }
    var cls = options.cls === undefined ? 'qr-svg' : options.cls;
    return '<svg class="' + cls + '" viewBox="0 0 ' + side + ' ' + side + '" width="' +
      (options.size || 200) + '" height="' + (options.size || 200) + '" shape-rendering="crispEdges" ' +
      'role="img" aria-label="QR-код для оплаты">' +
      '<rect width="' + side + '" height="' + side + '" fill="' + (options.light || '#ffffff') + '"/>' +
      '<path d="' + path + '" fill="' + (options.dark || '#0b1220') + '"/></svg>';
  };
})();
