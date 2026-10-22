/* ==========================================================================
   ByteStore — Экспертное ядро подбора ПК и ИИ-надстройка над ним
   1) Жёсткие правила совместимости (сокет, память, БП, габариты);
   2) Детерминированный алгоритм сборки под бюджет и задачи (работает офлайн);
   3) Промпты и разбор ответов LLM (OpenRouter) для обоснования сборки;
   4) Интенты и офлайн-ответы ИИ-бота поддержки.
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var U = BS.util, db = BS.db;
  var ad = (BS.advisor = {});

  /* --------------------------- Слоты конфигуратора ------------------------ */
  ad.SLOTS = [
    { slot: 'cpu', categoryId: 'cpu', label: 'Процессор', icon: 'cpu', required: true },
    { slot: 'motherboard', categoryId: 'motherboard', label: 'Материнская плата', icon: 'grid', required: true },
    { slot: 'gpu', categoryId: 'gpu', label: 'Видеокарта', icon: 'gpu', required: false },
    { slot: 'ram', categoryId: 'ram', label: 'Оперативная память', icon: 'memory', required: true },
    { slot: 'storage', categoryId: 'storage', label: 'Накопитель', icon: 'database', required: true },
    { slot: 'psu', categoryId: 'psu', label: 'Блок питания', icon: 'zap', required: true },
    { slot: 'case', categoryId: 'case', label: 'Корпус', icon: 'box', required: true },
    { slot: 'cooler', categoryId: 'cooling', label: 'Охлаждение процессора', icon: 'wind', required: false }
  ];
  ad.slotMeta = function (slot) {
    return ad.SLOTS.filter(function (s) { return s.slot === slot; })[0] || null;
  };

  /* ------------------------------- Профили -------------------------------- */
  ad.PURPOSES = [
    { id: 'gaming', label: 'Игры', emoji: '🎮', hint: 'Максимум кадров в играх' },
    { id: 'universal', label: 'Универсальный ПК', emoji: '🖥️', hint: 'Игры + работа + учёба' },
    { id: 'stream', label: 'Стриминг и монтаж', emoji: '🎬', hint: 'Много ядер и быстрый SSD' },
    { id: 'render', label: '3D-рендер и ИИ', emoji: '🧪', hint: 'Видеопамять и объём RAM' },
    { id: 'office', label: 'Офис и учёба', emoji: '📄', hint: 'Тихий и недорогой ПК' }
  ];
  ad.RESOLUTIONS = [
    { id: '1080p', label: 'Full HD 1080p', minGpuScore: 30 },
    { id: '1440p', label: '2K 1440p', minGpuScore: 60 },
    { id: '4K', label: '4K 2160p', minGpuScore: 84 }
  ];

  /* Доли бюджета по слотам для каждой задачи (сумма ≈ 1) */
  var WEIGHTS = {
    gaming:    { cpu: 0.17, motherboard: 0.09, gpu: 0.42, ram: 0.06, storage: 0.07, psu: 0.07, case: 0.07, cooler: 0.05 },
    universal: { cpu: 0.21, motherboard: 0.10, gpu: 0.33, ram: 0.08, storage: 0.08, psu: 0.07, case: 0.07, cooler: 0.06 },
    stream:    { cpu: 0.25, motherboard: 0.10, gpu: 0.28, ram: 0.10, storage: 0.09, psu: 0.07, case: 0.06, cooler: 0.05 },
    render:    { cpu: 0.25, motherboard: 0.09, gpu: 0.30, ram: 0.12, storage: 0.10, psu: 0.06, case: 0.05, cooler: 0.03 },
    office:    { cpu: 0.30, motherboard: 0.15, gpu: 0.00, ram: 0.11, storage: 0.16, psu: 0.11, case: 0.11, cooler: 0.06 }
  };
  ad.weightsFor = function (purpose) { return WEIGHTS[purpose] || WEIGHTS.universal; };

  /* Минимальные требования по задачам */
  var REQUIREMENTS = {
    gaming:    { ram: 16, ramModules: 2, storage: 500, vram: 8, coolerTdp: 1.0 },
    universal: { ram: 16, ramModules: 2, storage: 500, vram: 8, coolerTdp: 1.0 },
    stream:    { ram: 32, ramModules: 2, storage: 1000, vram: 8, coolerTdp: 1.1 },
    render:    { ram: 32, ramModules: 2, storage: 1000, vram: 12, coolerTdp: 1.15 },
    office:    { ram: 16, ramModules: 2, storage: 240, vram: 0, coolerTdp: 0.9 }
  };
  ad.requirementsFor = function (purpose) { return REQUIREMENTS[purpose] || REQUIREMENTS.universal; };

  /* --------------------------- Вспомогательные ---------------------------- */
  function candidates(categoryId, options) {
    options = options || {};
    return db.byCategory(categoryId).filter(function (p) {
      if (p.stock <= 0) return false;
      if (options.maxPrice && p.price > options.maxPrice) return false;
      if (options.filter && !options.filter(p)) return false;
      return true;
    });
  }
  ad.candidates = candidates;

  /** «Цена за балл производительности» — база для выбора детали. */
  function valueRatio(product, weight) {
    var score = (product.specs && product.specs.score) || 20;
    var price = product.price || 1;
    var rating = product.rating || 4;
    return (score * (weight || 1)) / price * (0.75 + rating / 10);
  }
  ad.valueRatio = valueRatio;

  function bestValue(list, weight) {
    var sorted = list.slice().sort(function (a, b) {
      return valueRatio(b, weight) - valueRatio(a, weight);
    });
    return sorted[0] || null;
  }

  /** Объём накопителя в гигабайтах («1 ТБ» → 1000). */
  function capacityGb(product) {
    var raw = String((product && product.specs && product.specs.capacity) || '');
    var num = parseFloat(raw.replace(',', '.'));
    if (!num || isNaN(num)) return 0;
    return /ТБ|TB/i.test(raw) ? num * 1000 : num;
  }
  ad.capacityGb = capacityGb;

  /* --------------------------- Совместимость ------------------------------ */
  /**
   * Проверка сборки по правилам совместимости.
   * @param {Object<string, Object>} build карта слот -> товар
   * @returns {{errors:Array,warnings:Array,notes:Array,ok:boolean,power:Object,total:number}}
   */
  ad.checkCompatibility = function (build) {
    var errors = [], warnings = [], notes = [];
    var cpu = build.cpu, mb = build.motherboard, gpu = build.gpu, ram = build.ram;
    var psu = build.psu, pcCase = build.pcCase || build['case'], cooler = build.cooler, storage = build.storage;

    function push(list, slot, text) { list.push({ slot: slot, text: text }); }

    if (cpu && mb) {
      if (cpu.specs.socket !== mb.specs.socket) {
        push(errors, 'motherboard', 'Сокет ' + mb.specs.socket + ' не подходит процессору ' + cpu.specs.socket + '.');
      }
      if (mb.specs.chipset === 'H610' && (cpu.specs.score || 0) > 70) {
        push(warnings, 'motherboard', 'Для топового процессора чипсет H610 ограничит питание — рекомендуем B760/Z790.');
      }
      if (mb.specs.chipset === 'A620') {
        push(warnings, 'motherboard', 'Чипсет A620 не поддерживает разгон и ограничивает TDP — проверьте спецификацию.');
      }
    }
    if (ram && mb) {
      if (ram.specs.type !== mb.specs.ramType) {
        push(errors, 'ram', 'Память ' + ram.specs.type + ' не подходит плате с ' + mb.specs.ramType + '.');
      }
      if (ram.specs.modules > mb.specs.ramSlots) {
        push(errors, 'ram', 'В комплекте ' + ram.specs.modules + ' модулей, а на плате ' + mb.specs.ramSlots + ' слота памяти.');
      }
      if (ram.specs.capacity > mb.specs.maxRam) {
        push(errors, 'ram', 'Максимальный объём памяти платы — ' + mb.specs.maxRam + ' ГБ.');
      }
    }
    if (cpu && !cpu.specs.igpu && !gpu) {
      push(errors, 'gpu', 'У процессора нет встроенной графики — нужна дискретная видеокарта.');
    }
    if (gpu && pcCase) {
      if (gpu.specs.length > pcCase.specs.maxGpuLength) {
        push(errors, 'pcCase', 'Длина видеокарты ' + gpu.specs.length + ' мм не поместится в корпус (максимум ' +
          pcCase.specs.maxGpuLength + ' мм).');
      }
    }
    if (mb && pcCase && (pcCase.specs.formFactors || []).indexOf(mb.specs.formFactor) === -1) {
      push(errors, 'pcCase', 'Корпус не поддерживает формат платы ' + mb.specs.formFactor + '.');
    }
    if (cooler && cpu) {
      if ((cooler.specs.sockets || []).indexOf(cpu.specs.socket) === -1) {
        push(errors, 'cooler', 'Кулер не поддерживает сокет ' + cpu.specs.socket + '.');
      }
      var required = cpu.specs.tdp * (REQUIREMENTS.render && (cpu.specs.unlocked ? 1.2 : 1.05));
      if (cooler.specs.tdpRating < cpu.specs.tdp * 0.85) {
        push(errors, 'cooler', 'Кулер рассчитан на ' + cooler.specs.tdpRating + ' Вт, процессору нужно ~' +
          Math.round(cpu.specs.tdp * 1.15) + ' Вт — будет перегрев.');
      } else if (cooler.specs.tdpRating < required) {
        push(warnings, 'cooler', 'Запас охлаждения небольшой: ' + cooler.specs.tdpRating + ' Вт против расчётных ' +
          Math.round(required) + ' Вт.');
      }
      if (pcCase && cooler.specs.type === 'air' && cooler.specs.height > pcCase.specs.maxCoolerHeight) {
        push(errors, 'cooler', 'Высота кулера ' + cooler.specs.height + ' мм выше допустимой для корпуса (' +
          pcCase.specs.maxCoolerHeight + ' мм).');
      }
    }
    if (psu && pcCase && psu.specs.formFactor !== pcCase.specs.psuFormFactor) {
      push(warnings, 'psu', 'Корпус рассчитан на БП формата ' + pcCase.specs.psuFormFactor +
        ', выбран блок ' + psu.specs.formFactor + ' — понадобится переходник.');
    }
    if (psu) {
      var power = ad.power(build);
      if (psu.specs.wattage < power.minimum) {
        push(errors, 'psu', 'Мощности ' + psu.specs.wattage + ' Вт мало: пиковое потребление ~' + power.peak +
          ' Вт, нужно минимум ' + power.minimum + ' Вт.');
      } else if (psu.specs.wattage < power.recommended) {
        push(warnings, 'psu', 'Рекомендуем БП от ' + power.recommended + ' Вт для стабильного питания и апгрейда.');
      }
      if (gpu && gpu.specs.recommendedPsu > psu.specs.wattage) {
        push(warnings, 'psu', 'Производитель видеокарты рекомендует БП от ' + gpu.specs.recommendedPsu + ' Вт.');
      }
    }
    if (storage && mb && storage.specs.formFactor.indexOf('M.2') === 0 && mb.specs.m2 < 1) {
      push(warnings, 'storage', 'У платы нет M.2-разъёма — выберите SATA-накопитель.');
    }
    if (storage && mb && storage.specs.formFactor.indexOf('M.2') === 0 && mb.specs.m2 < 2) {
      notes.push({ slot: 'storage', text: 'Использован единственный M.2-слот платы — расширяйте накопитель через SATA.' });
    }
    if (gpu && (gpu.specs.tdp || 0) > 280 && pcCase && (pcCase.specs.fans || '').indexOf('1 ') === 0) {
      notes.push({ slot: 'pcCase', text: 'Для горячей видеокарты добавьте вентиляторы в корпус для продува.' });
    }
    if (ram && ram.specs.type === 'DDR4' && cpu && /Ryzen 7 7800X3D|Ryzen 5 7600/.test(cpu.name)) {
      push(errors, 'ram', 'Для платформы AM5 требуется только DDR5.');
    }

    return {
      errors: errors,
      warnings: warnings,
      notes: notes,
      ok: errors.length === 0,
      power: ad.power(build),
      total: ad.buildTotal(build)
    };
  };

  /** Стоимость сборки. */
  ad.buildTotal = function (build) {
    return U.sum(Object.keys(build || {}), function (key) {
      var item = build[key];
      return item && item.price ? item.price : 0;
    });
  };
  /** Значение слота в сборке (корпус может храниться как pcCase или case). */
  function buildValue(build, slot) {
    if (slot === 'case') return build.pcCase || build['case'];
    return build[slot];
  }
  ad.buildValue = buildValue;
  /** Список слотов сборки с товарами — используется интерфейсом конфигуратора. */
  ad.buildList = function (build) {
    return ad.SLOTS.map(function (meta) {
      return { slot: meta.slot, meta: meta, product: buildValue(build, meta.slot) || null };
    });
  };
  ad.buildIsComplete = function (build) {
    return ad.SLOTS.filter(function (meta) { return meta.required; })
      .every(function (meta) { return !!buildValue(build, meta.slot); });
  };

  /* ------------------- Перенос товаров ИИ в конфигуратор ------------------- */
  /* Категория каталога -> ключ слота сборки (корпус хранится как pcCase). */
  var CATEGORY_TO_SLOT = {
    cpu: 'cpu', motherboard: 'motherboard', gpu: 'gpu', ram: 'ram',
    storage: 'storage', psu: 'psu', case: 'pcCase', cooling: 'cooler'
  };
  /* Категории, которые попадают в блок «Дополнительно» конфигуратора. */
  var EXTRA_KINDS = { monitor: 'monitor', keyboard: 'keyboard', mouse: 'mouse', headset: 'headset' };
  /* Категории, товары которых всегда являются дополнением к сборке. */
  var EXTRA_BY_CATEGORY = { monitor: 'monitor' };
  ad.CATEGORY_TO_SLOT = CATEGORY_TO_SLOT;
  ad.EXTRA_KINDS = EXTRA_KINDS;

  /** Слот сборки для товара (или null, если товар в сборку не входит). */
  ad.slotForProduct = function (product) {
    if (!product) return null;
    if (CATEGORY_TO_SLOT[product.categoryId]) return CATEGORY_TO_SLOT[product.categoryId];
    if (EXTRA_BY_CATEGORY[product.categoryId]) return EXTRA_BY_CATEGORY[product.categoryId];
    if (product.categoryId === 'peripherals') {
      var kind = (product.specs && product.specs.kind) || '';
      return EXTRA_KINDS[kind] || null;
    }
    return null;
  };

  /**
   * Преобразование списка товаров (например, из ответа ИИ) в сборку.
   * Первое упоминание товара занимает свой слот, остальные попадают в skipped,
   * чтобы покупатель мог заменить компонент вручную.
   * @param {Array<Object>} products
   * @returns {{build:Object, extras:Object, skipped:Array, total:number}}
   */
  ad.buildFromProducts = function (products) {
    var build = {}, extras = {}, skipped = [];
    (products || []).forEach(function (product) {
      if (!product) return;
      var slot = ad.slotForProduct(product);
      if (!slot) {
        skipped.push({ product: product, reason: 'не входит в сборку ПК' });
        return;
      }
      var target = ad.isExtraSlot(slot) ? extras : build;
      if (target[slot]) {
        var meta = ad.slotMeta(slot) || ad.extraMeta(slot) || { label: slot };
        skipped.push({ product: product, reason: 'слот «' + meta.label + '» уже занят' });
        return;
      }
      target[slot] = product;
    });
    var merged = Object.assign({}, build, extras);
    return {
      build: build,
      extras: extras,
      skipped: skipped,
      total: ad.buildTotal(merged),
      full: merged,
      compatible: ad.checkCompatibility(merged).ok,
      check: ad.checkCompatibility(merged)
    };
  };
  /* ------------------- Локальный (офлайн) алгоритм сборки ------------------ */
  function byPrice(list) {
    return list.slice().sort(function (a, b) { return a.price - b.price; });
  }
  function pickCheapestSatisfying(pool, predicate) {
    var list = pool.filter(predicate || function () { return true; });
    if (!list.length) return null;
    return byPrice(list)[0];
  }
  function pickCpu(pool, purpose, maxPrice) {
    var filtered = pool.filter(function (p) { return !maxPrice || p.price <= maxPrice; });
    if (!filtered.length) filtered = byPrice(pool).slice(0, 3);
    var scored = filtered.map(function (p) {
      var cores = p.specs.cores || 4, score = p.specs.score || 20;
      var weight;
      if (purpose === 'gaming') weight = score * 1.25 + cores * 1.4;
      else if (purpose === 'stream' || purpose === 'render') weight = score * 0.9 + cores * 4.5;
      else if (purpose === 'office') weight = (p.specs.igpu ? 70 : 5) + score * 0.5 - (p.specs.tdp > 100 ? 50 : 0);
      else weight = score * 1.15 + cores * 2.2;
      return { product: p, value: weight / Math.pow(p.price, 0.86) };
    });
    scored.sort(function (a, b) { return b.value - a.value; });
    return scored[0].product;
  }

  /**
   * Подбор сборки экспертным движком (работает без интернета и без ИИ-ключа).
   * @param {{budget:number,purpose:string,resolution:string,brandPref:string,
   *          cooler:string,needMonitor:boolean,needPeripherals:boolean}} prefs
   */
  ad.localBuild = function (prefs) {
    prefs = Object.assign({
      budget: 600000, purpose: 'universal', resolution: '1080p',
      brandPref: 'any', cooler: 'auto',
      needMonitor: false, needPeripherals: false
    }, prefs || {});
    var budget = Math.max(150000, Number(prefs.budget) || 600000);
    var req = ad.requirementsFor(prefs.purpose);
    var weights = ad.weightsFor(prefs.purpose);
    var extras = 0;
    if (prefs.needMonitor) extras += 90000;
    if (prefs.needPeripherals) extras += 45000;
    /* Сначала резервируем деньги на выбранные доп. устройства. */
    var componentBudget = Math.max(150000, budget - extras);
    var build = {}, reasons = [];

    /* 1. Процессор */
    var cpuPool = candidates('cpu').filter(function (p) {
      if (prefs.brandPref === 'intel') return p.brand === 'Intel';
      if (prefs.brandPref === 'amd') return p.brand === 'AMD';
      return true;
    });
    if (!cpuPool.length) cpuPool = candidates('cpu');
    var cpu = pickCpu(cpuPool, prefs.purpose, componentBudget * weights.cpu * 1.6);
    build.cpu = cpu;
    reasons.push('Процессор ' + cpu.brand + ' выбран по лучшему соотношению производительности и цены для задачи «' +
      (ad.PURPOSES.filter(function (p) { return p.id === prefs.purpose; })[0] || {}).label + '».');

    /* 2. Материнская плата под сокет процессора */
    var mbPool = candidates('motherboard').filter(function (p) { return p.specs.socket === cpu.specs.socket; });
    var wantRamType = cpu.specs.ram === 'DDR5' ? 'DDR5' : null;
    var mbPref = prefs.budget > 90000 ? 'ATX' : null;
    var mb = pickCheapestSatisfying(mbPool, function (p) {
      return p.specs.ramSlots >= 2 && p.specs.m2 >= 1 && (!wantRamType || p.specs.ramType === wantRamType);
    }) || mbPool[0];
    if (mbPref === 'ATX') {
      var atx = mbPool.filter(function (p) {
        return p.specs.formFactor === 'ATX' && (!wantRamType || p.specs.ramType === wantRamType) &&
          p.price <= componentBudget * weights.motherboard * 2.4;
      });
      if (atx.length) mb = pickCheapestSatisfying(atx);
    }
    build.motherboard = mb;
    reasons.push('Плата на чипсете ' + mb.specs.chipset + ' (' + mb.specs.formFactor + ', ' + mb.specs.ramType +
      ') — совместимый сокет ' + mb.specs.socket + ' и запас по слотам памяти.');

    /* 3. Оперативная память: тип от платы, объём из требований задачи */
    var ramPool = candidates('ram').filter(function (p) {
      return p.specs.type === mb.specs.ramType && p.specs.modules <= mb.specs.ramSlots;
    });
    var ram = pickCheapestSatisfying(ramPool, function (p) { return p.specs.capacity >= req.ram; });
    if (!ram) ram = ramPool.slice().sort(function (a, b) { return b.specs.capacity - a.specs.capacity; })[0];
    if (ram) {
      var sameCapacity = ramPool.filter(function (p) { return p.specs.capacity === ram.specs.capacity; });
      var faster = sameCapacity.filter(function (p) {
        return p.price <= ram.price * 1.45 && p.specs.speed > ram.specs.speed &&
          p.price <= componentBudget * weights.ram * 2.2;
      });
      if (faster.length) {
        ram = faster.sort(function (a, b) { return b.specs.speed - a.specs.speed; })[0];
      }
      build.ram = ram;
      reasons.push('Память ' + ram.specs.capacity + ' ГБ ' + ram.specs.type + '-' + ram.specs.speed +
        ' двумя модулями — двухканальный режим и оптимальная частота для платформы.');
    }

    /* 4. Накопитель: NVMe при наличии M.2, объём из требований задачи */
    var storagePool = candidates('storage');
    var nvme = storagePool.filter(function (p) {
      return p.specs.formFactor.indexOf('M.2') === 0 && p.specs.interface.indexOf('NVMe') === 0;
    });
    var storage = pickCheapestSatisfying(nvme, function (p) { return capacityGb(p) >= req.storage; });
    if (!storage) storage = pickCheapestSatisfying(storagePool, function (p) { return capacityGb(p) >= req.storage; });
    if (!storage) storage = storagePool.slice().sort(function (a, b) { return capacityGb(b) - capacityGb(a); })[0];
    build.storage = storage;
    reasons.push('Системный накопитель ' + storage.specs.capacity + ' (' + storage.specs.interface + ') — ' +
      'быстрая загрузка системы и игр.');
    /* 5. Видеокарта: по разрешению и задаче */
    if (prefs.purpose !== 'office') {
      var resMeta = ad.RESOLUTIONS.filter(function (r) { return r.id === prefs.resolution; })[0] || ad.RESOLUTIONS[0];
      var gpuPool = candidates('gpu').filter(function (p) {
        return (p.specs.score || 0) >= resMeta.minGpuScore * 0.85 && (p.specs.vram || 0) >= Math.min(req.vram, 8);
      });
      if (!gpuPool.length) gpuPool = candidates('gpu');
      var gpuBudget = componentBudget * weights.gpu * 1.7;
      var affordable = gpuPool.filter(function (p) { return p.price <= gpuBudget; });
      if (!affordable.length) affordable = byPrice(gpuPool).slice(0, 3);
      var gpu = affordable.slice().sort(function (a, b) {
        return valueRatio(b, 1.1 + (b.specs.score || 0) / 120) - valueRatio(a, 1.1 + (a.specs.score || 0) / 120);
      })[0];
      build.gpu = gpu;
      reasons.push('Видеокарта ' + gpu.specs.chip + ' выбрана под разрешение ' + resMeta.label + '.');
    }

    /* 6. Охлаждение процессора */
    var coolerPool = candidates('cooling').filter(function (p) {
      return (p.specs.sockets || []).indexOf(cpu.specs.socket) !== -1 && p.specs.tdpRating >= cpu.specs.tdp * 1.05;
    });
    if (!coolerPool.length) {
      coolerPool = candidates('cooling').filter(function (p) {
        return (p.specs.sockets || []).indexOf(cpu.specs.socket) !== -1;
      });
    }
    var preferLiquid = prefs.cooler === 'liquid' || (prefs.cooler === 'auto' && cpu.specs.tdp >= 120);
    var cooler = pickCheapestSatisfying(coolerPool, function (p) {
      return preferLiquid ? p.specs.type === 'liquid' : p.specs.type === 'air';
    });
    if (!cooler) cooler = pickCheapestSatisfying(coolerPool, function (p) {
      return preferLiquid ? true : p.specs.height <= 165;
    });
    if (!cooler) cooler = byPrice(coolerPool)[0];
    build.cooler = cooler;
    if (cooler) {
      reasons.push('Охлаждение ' + (cooler.specs.type === 'liquid'
        ? 'жидкостное ' + cooler.specs.radiator + ' мм'
        : 'воздушное на ' + cooler.specs.tdpRating + ' Вт') + ' — запас по TDP и совместимость с сокетом.');
    }

    /* 7. Корпус: должен вместить плату, видеокарту и кулер */
    var casePool = candidates('case').filter(function (p) {
      var fitsBoard = (p.specs.formFactors || []).indexOf(mb.specs.formFactor) !== -1;
      var fitsGpu = !build.gpu || p.specs.maxGpuLength >= build.gpu.specs.length;
      var fitsCooler = !cooler || cooler.specs.type !== 'air' || p.specs.maxCoolerHeight >= cooler.specs.height;
      return fitsBoard && fitsGpu && fitsCooler;
    });
    if (!casePool.length) casePool = candidates('case');
    var pcCase = pickCheapestSatisfying(casePool, function (p) {
      return p.price <= componentBudget * weights.case * 2.5;
    }) || byPrice(casePool)[0];
    build.pcCase = pcCase;
    reasons.push('Корпус ' + pcCase.brand + ': вентиляторы ' + pcCase.specs.fans +
      ', запас под видеокарту до ' + pcCase.specs.maxGpuLength + ' мм.');

    /* 8. Блок питания: минимально достаточный, апгрейд — за счёт остатка бюджета */
    var power = ad.power(build);
    var psuPool = candidates('psu').filter(function (p) {
      return p.specs.formFactor === pcCase.specs.psuFormFactor && p.specs.wattage >= power.minimum;
    });
    if (!psuPool.length) psuPool = candidates('psu').filter(function (p) { return p.specs.wattage >= power.minimum; });
    if (!psuPool.length) psuPool = candidates('psu');
    var psu = pickCheapestSatisfying(psuPool) || byPrice(psuPool)[0];
    build.psu = psu;
    reasons.push('Блок питания ' + psu.specs.wattage + ' Вт ' + psu.specs.efficiency +
      ': пиковое потребление сборки ~' + power.peak + ' Вт, запас ' +
      Math.max(0, Math.round((psu.specs.wattage / Math.max(power.peak, 1) - 1) * 100)) + ' %.');
    /* 9. Корректировка под бюджет и апгрейд на остаток */
    if (ad.buildTotal(build) > componentBudget) {
      var trimmed = ad.trimToBudget(build, componentBudget, prefs);
      build = trimmed.build;
      reasons = reasons.concat(trimmed.reasons);
    }
    var upgraded = ad.upgradeWithinBudget(build, componentBudget, prefs);
    build = upgraded.build;
    reasons = reasons.concat(upgraded.reasons);

    /* 10. Дополнительные устройства: монитор и периферия */
    if (prefs.needMonitor) {
      var need = prefs.resolution === '4K' ? 80 : prefs.resolution === '1440p' ? 62 : 36;
      var monitors = candidates('monitor').slice().sort(function (a, b) {
        return Math.abs(a.specs.score - need) - Math.abs(b.specs.score - need);
      });
      if (monitors[0]) {
        build.monitor = monitors[0];
        reasons.push('Монитор ' + build.monitor.specs.diagonal + ' ' + build.monitor.specs.resolution + ' ' +
          build.monitor.specs.refresh + ' Гц подобран под возможности видеокарты.');
      }
    }
    if (prefs.needPeripherals) {
      var keyboard = candidates('peripherals').filter(function (p) { return p.specs.kind === 'keyboard'; })[0];
      var mouse = candidates('peripherals').filter(function (p) { return p.specs.kind === 'mouse'; })[0];
      if (keyboard) { build.keyboard = keyboard; reasons.push('Клавиатура ' + keyboard.brand + ' — ' + keyboard.key[0] + '.'); }
      if (mouse) { build.mouse = mouse; reasons.push('Мышь ' + mouse.brand + ' ' + mouse.specs.dpi + ' DPI.'); }
    }

    /* Финальная проверка считает и монитор/периферию: их стоимость тоже входит в лимит. */
    if (ad.buildTotal(build) > budget) {
      var finalTrim = ad.trimToBudget(build, budget, prefs);
      build = finalTrim.build;
      reasons = reasons.concat(finalTrim.reasons);
    }

    var check = ad.checkCompatibility(build);
    return {
      build: build, reasons: reasons, prefs: prefs, req: req,
      total: ad.buildTotal(build),
      compatible: check.ok,
      check: check,
      estimate: ad.estimate(build, prefs)
    };
  };
  /* ------------------- Корректировка бюджета и апгрейд -------------------- */
  function slotCategoryId(slot) {
    if (slot === 'pcCase') return 'case';
    var meta = ad.slotMeta(slot);
    return meta ? meta.categoryId : null;
  }
  /** Название слота для сообщений (корпус хранится под ключом pcCase). */
  function slotLabel(slot) {
    if (slot === 'pcCase') return 'Корпус';
    var meta = ad.slotMeta(slot);
    return meta ? meta.label : slot;
  }
  ad.slotCategoryId = slotCategoryId;
  ad.slotLabel = slotLabel;

  /** Постепенное удешевление сборки до попадания в бюджет. */
  ad.trimToBudget = function (build, budget, prefs) {
    var reasons = [], guard = 0;
    /* Каждая замена строго снижает цену, поэтому число возможных шагов ограничено каталогом. */
    var maxSteps = db.productsAll().length + 8;
    while (ad.buildTotal(build) > budget && guard++ < maxSteps) {
      var best = null;
      ['gpu', 'cpu', 'storage', 'ram', 'cooler'].forEach(function (slot) {
        var current = build[slot];
        if (!current) return;
        candidates(slotCategoryId(slot)).forEach(function (opt) {
          if (opt.price >= current.price) return;
          var trial = Object.assign({}, build);
          trial[slot] = opt;
          if (!ad.checkCompatibility(trial).ok) return;
          var saving = current.price - opt.price;
          var loss = Math.max(1, (current.specs.score || 0) - (opt.specs.score || 0));
          var ratio = saving / loss;
          if (!best || ratio > best.ratio) best = { slot: slot, product: opt, ratio: ratio, saving: saving };
        });
      });
      if (!best) {
        if (build.monitor) { delete build.monitor; reasons.push('Монитор исключён из сборки, чтобы уложиться в бюджет.'); continue; }
        if (build.keyboard) { delete build.keyboard; reasons.push('Периферия исключена из сборки.'); continue; }
        if (build.mouse) { delete build.mouse; continue; }
        if (build.cooler && build.cpu && build.cpu.specs.tdp <= 65) {
          delete build.cooler;
          reasons.push('Использован боксовый кулер из комплекта процессора — экономия бюджета.');
          continue;
        }
        break;
      }
      build[best.slot] = best.product;
      reasons.push('Для попадания в бюджет ' + slotLabel(best.slot).toLowerCase() +
        ' заменён на ' + best.product.name + ' (−' + U.money(best.saving) + ').');
    }
    return { build: build, reasons: reasons };
  };

  /** Вложение остатка бюджета: приоритет отдан видеокарте, затем процессору. */
  ad.upgradeWithinBudget = function (build, budget, prefs) {
    var reasons = [], guard = 0;
    var order = prefs.purpose === 'office'
      ? ['storage', 'ram', 'cpu', 'cooler', 'psu', 'pcCase']
      : ['gpu', 'cpu', 'ram', 'storage', 'cooler', 'psu', 'pcCase'];
    while (guard++ < 6) {
      var total = ad.buildTotal(build), best = null;
      order.forEach(function (slot) {
        var categoryId = slotCategoryId(slot);
        var current = build[slot];
        candidates(categoryId).forEach(function (opt) {
          if (current && opt.id === current.id) return;
          var gain = (opt.specs.score || 0) - (current ? (current.specs.score || 0) : 0);
          if (gain <= 0) return;
          var delta = opt.price - (current ? current.price : 0);
          if (total + delta > budget) return;
          var trial = Object.assign({}, build);
          trial[slot] = opt;
          if (!ad.checkCompatibility(trial).ok) return;
          var efficiency = gain * 1000 / Math.max(delta, 500);
          if (!best || efficiency > best.efficiency) {
            best = { slot: slot, product: opt, efficiency: efficiency };
          }
        });
      });
      if (!best) break;
      build[best.slot] = best.product;
      reasons.push('На свободный бюджет улучшен ' + slotLabel(best.slot).toLowerCase() + ': ' + best.product.name + '.');
    }
    return { build: build, reasons: reasons };
  };
  /* ------------------------- Прогноз производительности ------------------- */
  /** Оценка FPS и уровня сборки для выбранного разрешения. */
  ad.estimate = function (build, prefs) {
    prefs = prefs || {};
    var gpuScore = build.gpu ? (build.gpu.specs.score || 0)
      : (build.cpu && build.cpu.specs.igpu ? 12 : 0);
    var cpuScore = build.cpu ? (build.cpu.specs.score || 20) : 20;
    var ram = build.ram ? build.ram.specs.capacity : 0;
    var res = prefs.resolution || '1080p';
    var factor = res === '4K' ? 0.78 : res === '1440p' ? 1.32 : 2.05;
    var offset = res === '1080p' ? 0 : 12;
    var gpuFps = Math.max(15, Math.round(gpuScore * factor - offset));
    var cpuFps = Math.round(cpuScore * (res === '1080p' ? 2.5 : 2.2));
    var fps = Math.min(gpuFps, cpuFps);
    var bottleneck = gpuFps < cpuFps ? { device: 'Видеокарта', score: gpuScore } : { device: 'Процессор', score: cpuScore };
    var level = fps >= 120 ? 'Киберспорт и AAA на максимальных настройках'
      : fps >= 80 ? 'AAA на высоких настройках'
      : fps >= 50 ? 'AAA на средних настройках'
      : fps >= 30 ? 'Офисные задачи и старые игры'
      : 'Офисные задачи и мультимедиа';
    var tags = [];
    if (prefs.purpose) {
      var meta = ad.PURPOSES.filter(function (p) { return p.id === prefs.purpose; })[0];
      if (meta) tags.push(meta.label);
    }
    if (build.gpu && (build.gpu.specs.vram || 0) >= 12) tags.push(build.gpu.specs.vram + ' ГБ видеопамяти');
    if (build.ram && ram >= 32) tags.push('Многозадачность');
    if (build.cooler && build.cooler.specs.type === 'liquid') tags.push('СЖО');
    if (build.ram && build.ram.specs.rgb) tags.push('RGB');
    var caseItem = buildValue(build, 'case');
    if (caseItem && caseItem.specs.formFactors.length === 1) tags.push('Компактная (ITX)');
    return {
      fps: fps, gpuFps: gpuFps, cpuFps: cpuFps, level: level,
      resolution: res, bottleneck: bottleneck, tags: tags,
      summary: '≈ ' + fps + ' FPS в ' + res + ' · ' + level
    };
  };

  /* --------------------- Текстовое представление сборки ------------------- */
  ad.buildSummary = function (build, opts) {
    opts = opts || {};
    var lines = [];
    ad.SLOTS.forEach(function (meta) {
      var item = buildValue(build, meta.slot);
      if (item) {
        lines.push('— ' + meta.label + ': ' + item.name + ' — ' + U.money(item.price) + ' (id: ' + item.id + ')');
      }
    });
    if (build.monitor) lines.push('— Монитор: ' + build.monitor.name + ' — ' + U.money(build.monitor.price) + ' (id: ' + build.monitor.id + ')');
    if (build.keyboard) lines.push('— Клавиатура: ' + build.keyboard.name + ' — ' + U.money(build.keyboard.price) + ' (id: ' + build.keyboard.id + ')');
    if (build.mouse) lines.push('— Мышь: ' + build.mouse.name + ' — ' + U.money(build.mouse.price) + ' (id: ' + build.mouse.id + ')');
    lines.push('ИТОГО: ' + U.money(ad.buildTotal(build)));
    return lines.join('\n');
  };
  ad.buildToSpecsTable = function (build) {
    return ad.SLOTS.filter(function (meta) { return !!build[meta.slot]; }).map(function (meta) {
      var item = build[meta.slot];
      return meta.label + ': ' + item.name;
    });
  };

  /** Компактный список товаров для промпта: id, название, цена, характеристики. */
  ad.shortlistForPrompt = function (limitPerCategory) {
    limitPerCategory = limitPerCategory || 6;
    var result = {};
    ad.SLOTS.forEach(function (meta) {
      var list = candidates(meta.categoryId).slice().sort(function (a, b) {
        return valueRatio(b, 1) - valueRatio(a, 1);
      }).slice(0, limitPerCategory);
      result[meta.slot] = list.map(function (p) {
        return {
          id: p.id,
          name: p.name.replace(/^(Процессор|Видеокарта|Материнская плата|Оперативная память|Кулер|СЖО|Блок питания|Корпус|SSD|Жёсткий диск)\s+/i, ''),
          price: p.price,
          specs: simplifySpecs(meta.slot, p.specs)
        };
      });
    });
    return result;
  };
  function simplifySpecs(slot, specs) {
    var out = {};
    var fields = {
      cpu: ['socket', 'cores', 'threads', 'tdp', 'igpu', 'score'],
      motherboard: ['socket', 'chipset', 'formFactor', 'ramType', 'ramSlots', 'm2'],
      gpu: ['chip', 'vram', 'tdp', 'length', 'recommendedPsu', 'score'],
      ram: ['type', 'capacity', 'modules', 'speed'],
      storage: ['interface', 'capacity', 'formFactor', 'read'],
      psu: ['wattage', 'efficiency', 'formFactor'],
      pcCase: ['formFactors', 'maxGpuLength', 'maxCoolerHeight', 'psuFormFactor'],
      cooler: ['type', 'sockets', 'tdpRating', 'height', 'radiator'],
      monitor: ['diagonal', 'resolution', 'refresh'],
      keyboard: ['kind', 'connection'],
      mouse: ['kind', 'dpi']
    }[slot] || Object.keys(specs || {});
    fields.forEach(function (f) { if (specs[f] !== undefined) out[f] = specs[f]; });
    return out;
  }
  /* ---------------------- ИИ-подбор через OpenRouter ---------------------- */
  var BUILD_SYSTEM_PROMPT = [
    'Ты — инженер-консультант интернет-магазина комплектующих ByteStore.',
    'Подбирай конфигурацию ПК СТРОГО из предложенного списка товаров shortlist по их id.',
    'Жёсткие правила совместимости: сокет процессора = сокет материнской платы;',
    'тип памяти (DDR4/DDR5) совпадает с платой; количество модулей не больше числа слотов;',
    'форм-фактор платы поддерживается корпусом; длина видеокарты не больше maxGpuLength;',
    'высота воздушного кулера не больше maxCoolerHeight; мощность БП не меньше пикового',
    'потребления с запасом 25–30 %; кулер поддерживает сокет и TDP процессора.',
    'Уложись в бюджет пользователя и не превышай его.',
    'Ответ верни ТОЛЬКО в формате JSON без markdown и пояснений:',
    '{"slots":{"cpu":"id","motherboard":"id","gpu":"id","ram":"id","storage":"id","psu":"id","pcCase":"id","cooler":"id"},',
    '"summary":"описание сборки на 2–4 предложения простым языком",',
    '"reasons":["обоснование выбора 1","обоснование выбора 2","обоснование выбора 3"],',
    '"fps":"ожидаемая производительность, например: 1080p ~120 FPS в киберспорте",',
    '"upgrade":"что логично улучшить в будущем"}'
  ].join('\n');

  function purposeLabel(id) {
    var meta = ad.PURPOSES.filter(function (p) { return p.id === id; })[0];
    return meta ? meta.label + ' (' + meta.id + ')' : id;
  }
  function resolutionLabel(id) {
    var meta = ad.RESOLUTIONS.filter(function (r) { return r.id === id; })[0];
    return meta ? meta.label : id;
  }
  ad.buildUserPrompt = function (prefs, local) {
    var lines = [];
    lines.push('Задача покупателя:');
    lines.push('- бюджет: ' + U.money(prefs.budget));
    lines.push('- назначение: ' + purposeLabel(prefs.purpose));
    lines.push('- целевое разрешение: ' + resolutionLabel(prefs.resolution));
    lines.push('- предпочтение по процессору: ' + (prefs.brandPref === 'any' ? 'без предпочтений' : prefs.brandPref));
    lines.push('- охлаждение: ' + (prefs.cooler === 'liquid' ? 'жидкостное' : prefs.cooler === 'air' ? 'воздушное' : 'на усмотрение эксперта'));
    lines.push('- нужен монитор: ' + (prefs.needMonitor ? 'да' : 'нет') + ', периферия: ' + (prefs.needPeripherals ? 'да' : 'нет'));
    lines.push('');
    lines.push('Черновая сборка встроенного экспертного движка ByteStore (можно изменить, если найдёшь вариант лучше):');
    lines.push(ad.buildSummary(local.build));
    lines.push('Пиковое потребление: ' + local.check.power.peak + ' Вт, рекомендуется БП от ' + local.check.power.recommended + ' Вт.');
    lines.push('');
    lines.push('Доступные товары магазина (shortlist, выбирай только эти id):');
    lines.push(JSON.stringify(ad.shortlistForPrompt(4)));
    lines.push('');
    lines.push('Подбери оптимальную сборку и верни JSON по заданной схеме.');
    return lines.join('\n');
  };
  /**
   * Сборка с участием ИИ. Если ключ или сеть недоступны — возвращает результат
   * встроенного движка (source: 'local'), поэтому демонстрация всегда работает.
   */
  ad.aiBuild = function (prefs, options) {
    var local = ad.localBuild(prefs);
    function localResult(warning) {
      return {
        ok: true, source: 'local',
        build: local.build, reasons: local.reasons, comment: null,
        estimate: local.estimate, check: local.check,
        total: local.total, warning: warning || null, model: null
      };
    }
    /* Конфигуратор запрашивает мгновенный детерминированный подбор без ожидания сети. */
    if (options && options.fast) return Promise.resolve(localResult());
    if (!BS.ai.configured()) return Promise.resolve(localResult(BS.ai.status().label));
    return BS.ai.chat([
      { role: 'system', content: BUILD_SYSTEM_PROMPT },
      { role: 'user', content: ad.buildUserPrompt(prefs, local) }
    ], { json: true, maxTokens: 650, timeout: 16000 }).then(function (res) {
      if (!res.ok) return localResult(res.message);
      var parsed = U.extractJson(res.content);
      if (!parsed || !parsed.slots) {
        return localResult('ИИ вернул ответ в неожиданном формате — применён встроенный алгоритм');
      }
      var aiBuild = {}, repairs = [];
      Object.keys(parsed.slots).forEach(function (slot) {
        var product = db.product(parsed.slots[slot]);
        if (!product) return;
        var categoryId = ad.slotCategoryId(slot);
        if (!categoryId || product.categoryId !== categoryId) return;
        aiBuild[slot] = product;
      });
      ad.SLOTS.forEach(function (meta) {
        if (meta.required && !aiBuild[meta.slot] && local.build[meta.slot]) {
          aiBuild[meta.slot] = local.build[meta.slot];
        }
      });
      /* Авторемонт: слоты с нарушением совместимости заменяем локальными */
      var check = ad.checkCompatibility(aiBuild), guard = 0;
      while (!check.ok && guard++ < 8) {
        var failedSlot = check.errors[0].slot;
        if (local.build[failedSlot]) aiBuild[failedSlot] = local.build[failedSlot];
        else delete aiBuild[failedSlot];
        repairs.push(failedSlot);
        check = ad.checkCompatibility(aiBuild);
      }
      var budget = Math.max(150000, Number(prefs.budget) || 600000);
      if (ad.buildTotal(aiBuild) > budget) {
        aiBuild = ad.trimToBudget(aiBuild, budget, prefs).build;
        repairs.push('budget');
      } else {
        aiBuild = ad.upgradeWithinBudget(aiBuild, budget, prefs).build;
      }
      check = ad.checkCompatibility(aiBuild);
      var reasons = (parsed.reasons || []).slice(0, 6);
      if (!reasons.length) reasons = local.reasons.slice(0, 3);
      if (repairs.length) {
        reasons.push('Автопроверка совместимости ByteStore скорректировала сборку: ' +
          repairs.length + ' ' + U.plural(repairs.length, 'позиция', 'позиции', 'позиций') + '.');
      }
      return {
        ok: true, source: 'ai',
        build: aiBuild, reasons: reasons,
        comment: parsed.summary || '',
        fps: parsed.fps || '', upgrade: parsed.upgrade || '',
        estimate: ad.estimate(aiBuild, prefs),
        check: check, total: ad.buildTotal(aiBuild),
        warning: null, model: res.model, ms: res.ms, repairs: repairs
      };
    });
  };
  /* --------------------------- ИИ-бот поддержки --------------------------- */
  var INTENTS = [
    { id: 'greeting', re: /(^|\s)(привет|здравствуй|здравствуйте|добрый (день|вечер|утро)|доброго дня|хай|hello|hi)([\s!,.]|$)/i },
    { id: 'thanks', re: /(спасибо|благодар|thanks)/i },
    { id: 'delivery', re: /(доставк|курьер|самовывоз|привезут|срок.*(доставки|заказ)|почт)/i },
    { id: 'payment', re: /(оплат|карт[ойе]|рассрочк|сбп|наличн|платёж|платеж|чек)/i },
    { id: 'warranty', re: /(гаранти|возврат|обмен|брак|сервис|починит|ремонт)/i },
    { id: 'order', re: /(заказ|статус|где мой|трек|номер заказа|отслеж)/i },
    { id: 'promo', re: /(промокод|скидк|акци|купон|дешевле|распродаж)/i },
    { id: 'contact', re: /(телефон|адрес|связаться|поддержк|менеджер|магазин наход)/i },
    { id: 'hours', re: /(график|время работы|работаете|режим работы|выходн)/i },
    { id: 'build', re: /(собер|сборк|конфигурат|подбер|подобрать|собрать пк|какой пк|компьютер за|гейминг|(?:2\s*[kк]|1440p?).*(?:игр|гейм)|(?:игр|гейм).*(?:2\s*[kк]|1440p?))/i },
    { id: 'compat', re: /(совместим|подойд[её]т|встанет ли|хватит ли|влезет|поддерживает ли)/i },
    { id: 'compare', re: /(лучше|быстрее|или|сравн|что выбрать)/i },
    { id: 'price', re: /(сколько стоит|цена|стоимость|по цене)/i }
  ];
  var CATEGORY_KEYWORDS = [
    { id: 'gpu', re: /(видеокарт|gpu|rtx|radeon|geforce|видео)/i },
    { id: 'cpu', re: /(процессор|cpu|ryzen|intel|core i[3579]|r[357] |i5|i7|i9)/i },
    { id: 'motherboard', re: /(материнс|материнк|мат\.? плат|плата|lga|am5|am4|чипсет)/i },
    { id: 'ram', re: /(оператив|озу|рам|ram|ddr[45]|память)/i },
    { id: 'storage', re: /(ssd|накопител|винчестер|hdd|nvme|диск|терабайт)/i },
    { id: 'psu', re: /(блок питания|бп |psu|ватт|watt|питани)/i },
    { id: 'case', re: /(корпус|case|миди|башн)/i },
    { id: 'cooling', re: /(кулер|охлажд|сжо|водянк|башн[яю]|вентилятор)/i },
    { id: 'monitor', re: /(монитор|дисплей|экран|1440p|4k|full hd|гц)/i },
    { id: 'peripherals', re: /(клавиатур|мыш|гарнитур|наушник|перифери|коврик)/i },
    { id: 'prebuilt', re: /(готовый пк|готовая сборк|игровой пк|собранн)/i }
  ];
  ad.detectIntent = function (text) {
    var message = String(text || '');
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(message)) return INTENTS[i].id;
    }
    return 'search';
  };
  /** Извлечение бюджета из текста: «до 700 тысяч», «600000», «за 700к», «1,2 млн». */
  ad.extractBudget = function (text) {
    var message = U.norm(text).replace(/\s+/g, ' ');
    var millions = message.match(/(\d+(?:[.,]\d+)?)\s*(млн|миллион)/);
    if (millions) {
      return Math.round(parseFloat(String(millions[1]).replace(',', '.')) * 1000000);
    }
    var match = message.match(/(\d[\d\s.]{2,9})\s*(к|k|тыс|тысяч|тг|тнг|000)?/);
    if (!match) return null;
    var raw = match[1].replace(/[\s.]/g, '');
    var value = Number(raw);
    if (!value) return null;
    if (/^(к|k|тыс)/.test(match[2] || '') || (value < 1000 && value > 10)) value *= 1000;
    if (value < 1000) value *= 1000;
    return value >= 15000 ? value : null;
  };
  ad.extractCategory = function (text) {
    for (var i = 0; i < CATEGORY_KEYWORDS.length; i++) {
      if (CATEGORY_KEYWORDS[i].re.test(text)) return CATEGORY_KEYWORDS[i].id;
    }
    return null;
  };

  /** Определение задачи ПК по свободному тексту («собери ПК для игр и стрима»). */
  ad.guessPurpose = function (text) {
    var t = U.norm(text);
    if (/стрим|монтаж|obs|ютуб/.test(t)) return 'stream';
    if (/рендер|blender|3d|нейросет|нейрон|моделир|инженер/.test(t)) return 'render';
    if (/офис|учеб|документ|бухгалт|мультимедиа|браузер/.test(t)) return 'office';
    if (/игров|гейм|fps|cs2|дота|танк|шутер|гта|valorant|фортнайт/.test(t)) return 'gaming';
    return 'universal';
  };

  /** Определение целевого разрешения по тексту и бюджету. */
  ad.guessResolution = function (text, budget) {
    var t = U.norm(text);
    if (/4[kк]|2160|uhd/.test(t)) return '4K';
    if (/1440|2[kк]|qhd/.test(t)) return '1440p';
    if (/1080|full hd|fhd/.test(t)) return '1080p';
    if (budget >= 1400000) return '4K';
    if (budget >= 700000) return '1440p';
    return '1080p';
  };

  /** Слоты дополнительных устройств (не входят в обязательную сборку). */
  ad.EXTRA_SLOTS = [
    { slot: 'monitor', categoryId: 'monitor', label: 'Монитор', icon: 'monitor' },
    { slot: 'keyboard', categoryId: 'peripherals', label: 'Клавиатура', icon: 'keyboard' },
    { slot: 'mouse', categoryId: 'peripherals', label: 'Мышь', icon: 'keyboard' },
    { slot: 'headset', categoryId: 'peripherals', label: 'Гарнитура', icon: 'headset' }
  ];
  ad.extraMeta = function (slot) {
    return ad.EXTRA_SLOTS.filter(function (item) { return item.slot === slot; })[0] || null;
  };
  ad.isExtraSlot = function (slot) { return !!ad.extraMeta(slot); };
  /** Кандидаты для пикера: для периферии фильтруем по типу устройства. */
  ad.pickerCandidates = function (slot, categoryId) {
    var list = candidates(categoryId);
    if (slot === 'keyboard' || slot === 'mouse' || slot === 'headset') {
      list = list.filter(function (product) {
        return (product.specs && product.specs.kind) === slot;
      });
    }
    return list;
  };
  /**
   * Поиск товаров, упомянутых в тексте (для карточек и переноса в конфигуратор).
   * Сначала пытаемся найти id товара, затем — наиболее длинное совпадение названия.
   * Результат отсортирован по порядку упоминания в ответе ИИ.
   */
  ad.productsFromText = function (text, limit) {
    var norm = U.norm(text);
    var found = [];
    db.productsAll().forEach(function (product) {
      var position = -1, length = 0;
      var idIndex = norm.indexOf(U.norm(product.id));
      if (idIndex !== -1 && product.id.length > 5) {
        position = idIndex;
        length = product.id.length;
      }
      var shortName = U.norm(product.name.replace(
        /^(Процессор|Видеокарта|Материнская плата|Оперативная память|Кулер|СЖО|Блок питания|Корпус|SSD|Жёсткий диск|Монитор|Клавиатура|Мышь|Гарнитура)\s+/i, ''));
      var words = shortName.split(' ');
      for (var len = Math.min(words.length, 7); len >= 2; len--) {
        var phrase = words.slice(0, len).join(' ');
        var index = norm.indexOf(phrase);
        if (index === -1) continue;
        /* Более длинное совпадение = более точное название товара */
        if (position === -1 || index < position || (index === position && len > length)) {
          position = index;
          length = phrase.length;
        }
        break;
      }
      if (position !== -1) found.push({ product: product, at: position, len: length });
    });
    found.sort(function (a, b) { return (a.at - b.at) || (b.len - a.len); });
    var result = found.map(function (row) { return row.product; });
    return limit ? result.slice(0, limit) : result;
  };
  /** Офлайн-ответ бота: работает без ключа ИИ и без интернета. */
  ad.localChat = function (text) {
    var intent = ad.detectIntent(text);
    var category = ad.extractCategory(text);
    var budget = ad.extractBudget(text);
    var settings = db.settings();
    var user = BS.auth && BS.auth.user ? BS.auth.user() : null;
    var products = [], content;

    function catalogReply(title) {
      var query = db.query({ category: category, max: budget, sort: category ? 'popular' : 'rating', perPage: 3 });
      products = category ? query.items : db.recommended(3);
      if (!products.length && category && budget) {
        /* Бюджет не покрывает категорию — показываем самые доступные варианты */
        var cheapest = db.query({ category: category, sort: 'price-asc', perPage: 3 }).items;
        if (cheapest.length) {
          products = cheapest;
          var catInfo = db.category(category);
          content = 'В бюджет ' + U.money(budget) + ' пока не попадает ни одна позиция из категории «' +
            (catInfo ? catInfo.name : category) + '». Вот самые доступные варианты:\n' +
            cheapest.map(function (p) {
              return '- **' + p.name + '** — ' + U.money(p.price);
            }).join('\n') +
            '\n\nМогу увеличить бюджет или предложить замену — скажите, для каких задач собираете ПК.';
          return;
        }
      }
      if (!products.length) {
        content = 'По вашему запросу ничего не нашлось. Уточните категорию или увеличите бюджет — либо соберите ПК ' +
          'в [ИИ-конфигураторе](configurator.html), он подберёт совместимые детали автоматически.';
        return;
      }
      var cat = category ? db.category(category) : null;
      var lines = [title || ('Вот что могу предложить' + (cat ? ' из категории «' + cat.name + '»' : '') +
        (budget ? ' до ' + U.money(budget) : '') + ':')];
      products.forEach(function (p) {
        lines.push('- **' + p.name + '** — ' + U.money(p.price) + ' · ' + (p.key || []).join(', ') +
          (db.inStock(p) ? '' : ' · _нет в наличии_'));
      });
      lines.push('');
      lines.push('Скажите, для каких задач собираете ПК — подберу конфигурацию целиком.');
      content = lines.join('\n');
    }

    /* Не подставляем случайные товары в ответ на нераспознанный или чужой теме запрос. */
    if (!category && (intent === 'search' || intent === 'compare' || intent === 'price')) {
      return {
        content: 'Я консультирую по компьютерным комплектующим ByteStore. Уточните товар или категорию — ' +
          'например, процессор, видеокарту или оперативную память.',
        products: [], intent: 'out_of_scope', source: 'local', category: null
      };
    }

    switch (intent) {
      case 'greeting':
        content = 'Здравствуйте' + (user ? ', ' + BS.auth.firstName() : '') + '! 👋\n\n' +
          'Я ИИ-ассистент ByteStore. Помогу:\n' +
          '- подобрать комплектующие или собрать ПК под бюджет;\n' +
          '- проверить совместимость деталей (сокет, DDR4/DDR5, мощность БП);\n' +
          '- рассказать про доставку, оплату, гарантию и статус заказа.\n\n' +
          'Напишите задачу и бюджет, например: «собери игровой ПК за 700 000 ₸ для 1440p».';
        break;
      case 'thanks':
        content = 'Рад помочь! Если появятся вопросы по сборке или заказу — пишите в любое время. 🚀';
        break;
      case 'delivery':
        content = '**Доставка ByteStore**\n' +
          '- Курьер до двери: 1 день по Алматы и Астане, 2–4 дня по Казахстану.\n' +
          '- Пункты выдачи: более 90 точек в 20 городах, срок 2–4 дня.\n' +
          '- Экспресс по Алматы: в день заказа при оформлении до 15:00.\n' +
          '- Стоимость: ' + U.money(settings.deliveryCost) + ', бесплатно при заказе от ' +
          U.money(settings.freeDeliveryFrom) + '.\n' +
          '- Готовые сборки привозим собранными и протестированными.\n\n' +
          'Отследить заказ можно в [личном кабинете](account.html).';
        break;
      case 'payment':
        content = '**Как можно оплатить заказ**\n' +
          '- Банковской картой онлайн (Visa, Mastercard, МИР) — без комиссии.\n' +
          '- Единый QR — отсканируйте код в приложении банка.\n' +
          '- Рассрочка 0-0-6, 0-0-12 и 0-0-24 — срок выбирается при оформлении.\n' +
          '- Оплата при получении (курьеру или в пункте выдачи).\n' +
          '- Безналичный расчёт для юридических лиц — оформим счёт по реквизитам.';
        break;
      case 'warranty':
        content = '**Гарантия и возврат**\n' +
          '- Официальная гарантия производителя: 1–3 года, на сборки ByteStore — 3 года.\n' +
          '- 14 дней на возврат товара без объяснения причин (при сохранении упаковки).\n' +
          '- При браке диагностика бесплатная, далее замена или ремонт.\n' +
          '- Сервисный центр: ' + U.APP.address + ', работает ' + U.APP.workHours + '.\n' +
          'Телефон поддержки: ' + U.APP.phone + '.';
        break;
      case 'promo':
        content = '**Действующие промокоды**\n' + db.promos(true).map(function (p) {
          return '- `' + p.code + '` — ' + p.description + ' (минимальная сумма ' + U.money(p.min) + ')';
        }).join('\n') + '\n\nПромокод вводится в корзине при оформлении. Скидки не суммируются.';
        break;
      case 'order':
        if (user) {
          var orders = db.orders({ userId: user.id, limit: 3 });
          if (!orders.length) {
            content = 'В вашем аккаунте пока нет заказов. Каталог комплектующих — [catalog.html](catalog.html): ' +
              'оформление занимает две минуты.';
          } else {
            var orderLines = ['**Ваши последние заказы**'];
            orders.forEach(function (o) {
              var status = (db.ORDER_STATUS[o.status] || {}).label || o.status;
              orderLines.push('- ' + o.number + ' от ' + U.date(o.createdAt) + ' — ' + U.money(o.total) +
                ' · статус: **' + status + '**');
            });
            orderLines.push('');
            orderLines.push('Состав заказа и история — в [личном кабинете](account.html). ' +
              'Если заказ задерживается, позвоните: ' + U.APP.phone + '.');
            content = orderLines.join('\n');
          }
        } else {
          content = 'Чтобы показать статус заказа, [войдите в аккаунт](login.html) — я вижу только ваши заказы.\n\n' +
            'Номер заказа есть в письме и SMS после оформления (формат BS-00000). Телефон: ' + U.APP.phone + '.';
        }
        break;
      case 'contact':
        content = '**Как с нами связаться**\n' +
          '- Телефон: ' + U.APP.phone + ' (' + U.APP.workHours + ')\n' +
          '- E-mail: ' + U.APP.email + '\n' +
          '- Магазин: ' + U.APP.address + '\n' +
          '- Живой чат с инженером — прямо здесь.';
        break;
      case 'hours':
        content = 'Мы работаем ' + U.APP.workHours + '.\n' +
          'Заказы через сайт принимаются круглосуточно, звонок менеджера — на следующий рабочий день до 12:00.';
        break;
      case 'build':
        if (!budget) {
          var hasPurpose = /игр|гейм|стрим|монтаж|рендер|\b3d\b|офис|учеб|работ|универсал/i.test(text);
          var hasResolution = /4[kк]|2160|uhd|1440|2[kк]|qhd|1080|full hd|fhd/i.test(text);
          var alreadySpecified = [];
          if (/игр|гейм/i.test(text)) alreadySpecified.push('игры');
          else if (/стрим|монтаж/i.test(text)) alreadySpecified.push('стриминг и монтаж');
          else if (/рендер|\b3d\b/i.test(text)) alreadySpecified.push('3D-рендер');
          else if (/офис|учеб|работ/i.test(text)) alreadySpecified.push('работа или учёба');
          if (/4[kк]|2160|uhd/i.test(text)) alreadySpecified.push('4K');
          else if (/1440|2[kк]|qhd/i.test(text)) alreadySpecified.push('1440p');
          else if (/1080|full hd|fhd/i.test(text)) alreadySpecified.push('1080p');
          content = 'Помогу собрать ПК. ' +
            (alreadySpecified.length ? 'Уже учёл: ' + alreadySpecified.join(', ') + '. ' : '') +
            'Укажите бюджет' + (!hasPurpose || !hasResolution
              ? ' и, если хотите, уточните ' + (!hasPurpose && !hasResolution
                ? 'задачу и разрешение' : !hasPurpose ? 'задачу' : 'разрешение') +
                ' (например, игры и 4K).' : '') + '.';
          break;
        }
        var purpose = ad.guessPurpose(text);
        var resolution = ad.guessResolution(text, budget);
        var built = ad.localBuild({ budget: budget, purpose: purpose, resolution: resolution });
        if (built.total > budget) {
          content = 'В каталоге пока не получается собрать полностью совместимый ПК в пределах **' +
            U.money(budget) + '**. Рассчитанная конфигурация выходит на **' + U.money(built.total) +
            '** — это на ' + U.money(built.total - budget) + ' выше лимита. Не буду выдавать её за сборку до ' +
            U.money(budget) + '. Могу подобрать отдельные комплектующие в этом бюджете или пересчитать полную сборку ' +
            'с большим лимитом.';
          products = [];
          break;
        }
        var purposeMeta = ad.PURPOSES.filter(function (item) { return item.id === purpose; })[0] || {};
        var rows = ad.buildList(built.build).filter(function (row) { return row.product; });
        products = rows.map(function (row) { return row.product; })
          .concat([built.build.monitor, built.build.keyboard, built.build.mouse].filter(Boolean));
        var buildLines = ['**Собрал конфигурацию под ' + U.money(budget) + '** — ' +
          (purposeMeta.label || 'универсальный ПК') + ', ' + resolution + ':'];
        rows.forEach(function (row) {
          buildLines.push('- **' + row.meta.label + ':** ' + row.product.name + ' — ' + U.money(row.product.price));
        });
        if (built.build.monitor) {
          buildLines.push('- **Монитор:** ' + built.build.monitor.name + ' — ' + U.money(built.build.monitor.price));
        }
        buildLines.push('');
        buildLines.push('**Итого: ' + U.money(built.total) + '** (остаток бюджета ' +
          U.money(Math.max(budget - built.total, 0)) + ')');
        buildLines.push('Ожидаемая производительность: ≈ ' + built.estimate.fps + ' FPS в ' + resolution + '.');
        buildLines.push(built.check.errors.length
          ? 'Замечания по совместимости: ' + built.check.errors.map(function (err) { return err.text; }).join(' ')
          : 'Совместимость проверена: сокет, память, блок питания и габариты согласованы ✅');
        buildLines.push('');
        buildLines.push('Нажмите **«Добавить в конфигуратор»** под этим сообщением — все комплектующие перенесутся, ' +
          'и вы сможете заменить любую деталь или сразу оформить заказ.');
        content = buildLines.join('\n');
        break;
      case 'compat':
        content = 'Проверяю совместимость по четырём правилам:\n' +
          '- **сокет** процессора и материнской платы (LGA1700, AM4, AM5);\n' +
          '- **тип памяти**: DDR4 или DDR5, число модулей и слотов;\n' +
          '- **мощность БП** с запасом 25–30 % от пикового потребления;\n' +
          '- **габариты**: длина видеокарты и высота кулера относительно корпуса.\n\n' +
          'Соберите конфигурацию в [ручном режиме конфигуратора](configurator.html) — несовместимые детали подсветятся сразу.';
        break;
      case 'compare':
        catalogReply('Вот подходящие варианты, сравнил их по цене и характеристикам:');
        break;
      case 'price':
        catalogReply(budget ? 'Подобрал варианты до ' + U.money(budget) + ':' : 'Нашёл подходящие товары:');
        break;
      default:
        catalogReply(null);

    }
    return { content: content, products: products, intent: intent, source: 'local', category: category };
  };

  /** Системный промпт бота: каталог и правила магазина в контексте. */
  ad.chatSystemPrompt = function () {
    var settings = db.settings();
    var catalogLines = [];
    db.categories().forEach(function (cat) {
      var items = db.byCategory(cat.id).slice().sort(function (a, b) { return b.sales - a.sales; }).slice(0, 3);
      if (!items.length) return;
      catalogLines.push(cat.name + ': ' + items.map(function (p) {
        return p.name + ' — ' + U.money(p.price) + ' [id: ' + p.id + ']' +
          (p.stock > 0 ? '' : ' (нет в наличии)');
      }).join('; '));
    });
    var custom = settings.ai.systemPrompt ? '\nДополнительные указания магазина: ' + settings.ai.systemPrompt : '';
    return [
      'Ты — ИИ-консультант интернет-магазина компьютерных комплектующих ByteStore.',
      'Отвечай на русском языке дружелюбно и предельно кратко: обычно 2–4 предложения, максимум 3 пункта списка.',
      'Не перечисляй больше 2 товаров и не повторяй карточки товаров длинным текстом.',
      'Сборку ПК предлагай только если покупатель прямо просит собрать или подобрать компьютер.',
      'Рекомендуй ТОЛЬКО товары из каталога ниже и указывай их точные названия и цены.',
      'Если товара нет в каталоге — предложи ближайший аналог из списка.',
      'Учитывай совместимость: сокет CPU и платы, DDR4 или DDR5, мощность БП, габариты корпуса.',
      'Если спрашивают про сборку — уточни бюджет и задачи, затем предложи конфигурацию.',
      'Когда предлагаешь конкретный ПК, перечисли ВСЕ комплектующие и указывай id каждой позиции ' +
        'в формате [id: xxx] — по ним покупатель сможет перенести сборку в конфигуратор.',
      'Не выдумывай характеристики: используй только данные каталога.',
      'Доставка: ' + U.money(settings.deliveryCost) + ', бесплатно от ' + U.money(settings.freeDeliveryFrom) +
        '. Гарантия до 3 лет. Телефон поддержки: ' + U.APP.phone + '.',
      'Каталог магазина:',
      catalogLines.join('\n'),
      'Промокоды: ' + db.promos(true).map(function (p) { return p.code + ' (' + p.description + ')'; }).join(', '),
      custom
    ].join('\n');
  };

  /**
   * Ответ ИИ-бота. При ошибке или отсутствии ключа возвращает офлайн-ответ.
   * @param {string} message сообщение пользователя
   * @param {Array<{role:string,content:string}>} history история диалога
   */
  ad.askChat = function (message, history) {
    var prior = (history || []).slice(-12);
    var buildRequest = null;
    var buildContextApplied = false;
    var resolutionChange = /(?:4\s*[kк]|2160p?|uhd|1440p?|2\s*[kк]|qhd|1080p?|full\s*hd|fhd)/i.test(message) &&
      /(лучше|давай|сделай|поменяй|пересчитай|тогда|для\s+\d|на\s+\d|геймин)/i.test(message);

    /* Короткое уточнение разрешения относится к последней сборке, а не к сравнению товаров. */
    if (resolutionChange) {
      var buildAnswerIndex = -1;
      for (var bi = prior.length - 1; bi >= 0; bi--) {
        if (prior[bi].role === 'assistant' && /собрал конфигурацию под|добавить в конфигуратор/i.test(prior[bi].content || '')) {
          buildAnswerIndex = bi;
          break;
        }
      }
      if (buildAnswerIndex >= 0) {
        for (var bu = buildAnswerIndex - 1; bu >= 0; bu--) {
          if (prior[bu].role === 'user' && /собер|сборк|подбер|подбор|\bпк\b|компьютер/i.test(prior[bu].content || '')) {
            buildRequest = prior[bu].content;
            break;
          }
        }
        if (!buildRequest) {
          var answerText = prior[buildAnswerIndex].content || '';
          var answerBudgetMatch = answerText.match(/собрал конфигурацию под\s+([^—\n]+)/i);
          var answerBudget = answerBudgetMatch ? ad.extractBudget(answerBudgetMatch[1]) : null;
          var answerPurpose = /игров|гейм/i.test(answerText) ? 'игровой ПК' : 'ПК';
          if (answerBudget) buildRequest = 'Собери ' + answerPurpose + ' за ' + answerBudget + ' ₸';
        }
        if (buildRequest) {
          /* Новое разрешение заменяет старое, сохраняя бюджет и задачу. */
          buildRequest = buildRequest.replace(/(?:4\s*[kк]|2160p?|uhd|1440p?|2\s*[kк]|qhd|1080p?|full\s*hd|fhd)/gi, ' ');
          message = buildRequest + ' ' + message;
          buildContextApplied = true;
        }
      }
    }
    if (ad.extractBudget(message)) {
      for (var i = prior.length - 1; i >= 0 && !buildRequest; i--) {
        var item = prior[i];
        if (item.role !== 'assistant' ||
            !/(уточните|укажите|назовите)[\s\S]{0,160}бюджет|бюджет[\s\S]{0,100}(задач|разрешен)/i.test(item.content || '')) continue;
        for (var j = i - 1; j >= 0; j--) {
          if (prior[j].role === 'user' && /собер|сборк|подбер|подбор|\bпк\b|компьютер/i.test(prior[j].content || '')) {
            buildRequest = prior[j].content;
            break;
          }
        }
      }
    }
    if (buildRequest && !buildContextApplied) message = buildRequest + ' ' + message;
    var fallback = ad.localChat(message);
    /* Частые справочные вопросы уже отвечаются локально точно и без ожидания сети. */
    if (/^(greeting|thanks|delivery|payment|warranty|order|promo|contact|hours|compat|build|out_of_scope)$/.test(fallback.intent)) {
      return Promise.resolve({
        ok: true, content: fallback.content, products: fallback.products,
        source: 'local', intent: fallback.intent
      });
    }
    if (!BS.ai.configured()) {
      return Promise.resolve({
        ok: true, content: fallback.content, products: fallback.products,
        source: 'local', intent: fallback.intent, warning: BS.ai.status().label
      });
    }
    var user = BS.auth && BS.auth.user ? BS.auth.user() : null;
    var context = [];
    if (user) {
      var stats = db.userStats(user.id);
      context.push('Покупатель: ' + user.name + ', заказов: ' + stats.orders +
        ', сумма покупок: ' + U.money(stats.spent) + '.');
    } else {
      context.push('Покупатель не авторизован.');
    }
    var cart = db.cartTotals();
    if (cart.count) context.push('В корзине: ' + cart.count + ' товар(ов) на ' + U.money(cart.total) + '.');
    var messages = [{ role: 'system', content: ad.chatSystemPrompt() }];
    if (context.length) messages.push({ role: 'system', content: context.join(' ') });
    (history || []).slice(-4).forEach(function (item) {
      if (item.role === 'user' || item.role === 'assistant') {
        messages.push({ role: item.role, content: String(item.content).slice(0, 700) });
      }
    });
    messages.push({ role: 'user', content: message });
    return BS.ai.chat(messages, { maxTokens: 220, temperature: 0.3, timeout: 12000 }).then(function (res) {
      if (!res.ok) {
        return {
          ok: true, content: fallback.content, products: fallback.products,
          source: 'local', intent: fallback.intent, warning: res.message
        };
      }
      var mentioned = ad.productsFromText(res.content, 2);
      db.track('chat', { label: ad.detectIntent(message), value: res.usage ? res.usage.total_tokens : 0 });
      return {
        ok: true, content: res.content,
        products: mentioned.length ? mentioned : fallback.products.slice(0, 2),
        source: 'ai', intent: ad.detectIntent(message),
        model: res.model, ms: res.ms
      };
    });
  };

  /* --------------------------- Энергопотребление -------------------------- */
  /** Оценка потребляемой мощности сборки и рекомендуемого блока питания. */
  ad.power = function (build) {
    var cpu = build.cpu && build.cpu.specs ? build.cpu.specs : {};
    var gpu = build.gpu && build.gpu.specs ? build.gpu.specs : {};
    var cooler = build.cooler && build.cooler.specs ? build.cooler.specs : {};
    var cpuPower = (cpu.tdp || 65) * (cpu.unlocked ? 1.35 : 1.1);
    var gpuPower = gpu.tdp || 0;
    var base = 45 + (cooler.type === 'liquid' ? 12 : 6) + 10;
    var peak = cpuPower + gpuPower + base;
    var recommendedPsu = gpu.recommendedPsu || 0;
    var need = Math.max(peak * 1.3, recommendedPsu * 1.05);
    return {
      cpu: Math.round(cpuPower),
      gpu: Math.round(gpuPower),
      base: base,
      peak: Math.round(peak),
      recommended: Math.ceil(need / 50) * 50,
      minimum: Math.ceil(peak * 1.05 / 50) * 50
    };
  };
})();
