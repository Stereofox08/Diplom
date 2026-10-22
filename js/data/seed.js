/* ==========================================================================
   ByteStore — Стартовые данные: категории, каталог, промокоды, демо-заказы
   Загружается перед store.js. Фактические записи БД создаёт BS.db.init().
   ========================================================================== */
(function () {
  'use strict';

  var BS = (window.BS = window.BS || {});
  var seed = (BS.seed = {});

  /* ------------------------------ Категории ------------------------------- */
  /* slot — роль комплектующего в ИИ-конфигураторе (null = не участвует)      */
  seed.categories = [
    { id: 'cpu', name: 'Процессоры', icon: 'cpu', emoji: '🧠', color: '#22d3ee', color2: '#6366f1', slot: 'cpu', order: 1, description: 'Центральные процессоры Intel и AMD для игр, работы и стриминга.' },
    { id: 'motherboard', name: 'Материнские платы', icon: 'grid', emoji: '▦', color: '#38bdf8', color2: '#8b5cf6', slot: 'motherboard', order: 2, description: 'Платы на чипсетах Intel и AMD с Wi-Fi, PCIe 5.0 и разгоном.' },
    { id: 'gpu', name: 'Видеокарты', icon: 'gpu', emoji: '🎮', color: '#8b5cf6', color2: '#22d3ee', slot: 'gpu', order: 3, description: 'Дискретная графика NVIDIA GeForce и AMD Radeon для любых задач.' },
    { id: 'ram', name: 'Оперативная память', icon: 'memory', emoji: '🧩', color: '#34d399', color2: '#22d3ee', slot: 'ram', order: 4, description: 'Комплекты DDR5 и DDR4 с высокими частотами и подсветкой RGB.' },
    { id: 'storage', name: 'Накопители SSD и HDD', icon: 'database', emoji: '💾', color: '#fbbf24', color2: '#f59e0b', slot: 'storage', order: 5, description: 'NVMe-накопители и жёсткие диски для системы и архивов.' },
    { id: 'psu', name: 'Блоки питания', icon: 'zap', emoji: '🔌', color: '#f472b6', color2: '#8b5cf6', slot: 'psu', order: 6, description: 'Блоки питания 80 PLUS Bronze/Gold с модульными кабелями.' },
    { id: 'case', name: 'Корпуса', icon: 'box', emoji: '🗄️', color: '#60a5fa', color2: '#8b5cf6', slot: 'case', order: 7, description: 'Корпуса с продуманной продуваемостью и стеклянными панелями.' },
    { id: 'cooling', name: 'Охлаждение', icon: 'wind', emoji: '❄️', color: '#67e8f9', color2: '#3b82f6', slot: 'cooler', order: 8, description: 'Воздушные кулеры и системы жидкостного охлаждения.' },
    { id: 'monitor', name: 'Мониторы', icon: 'monitor', emoji: '🖥️', color: '#a78bfa', color2: '#22d3ee', slot: null, order: 9, description: 'Мониторы 1080p, 2K и 4K с высокой частотой обновления.' },
    { id: 'peripherals', name: 'Периферия', icon: 'keyboard', emoji: '⌨️', color: '#fdba74', color2: '#f43f5e', slot: null, order: 10, description: 'Клавиатуры, мыши, гарнитуры и аксессуары для рабочего места.' },
    { id: 'prebuilt', name: 'Готовые сборки', icon: 'package', emoji: '🖳', color: '#22c55e', color2: '#22d3ee', slot: null, order: 11, description: 'Собранные, протестированные и готовые к работе ПК ByteStore.' }
  ];

  /* -------------------------------- Товары -------------------------------- */
  /* Компактный формат записи товара (разворачивается в объект в store.js):
     [0] id            [1] название        [2] категория      [3] бренд
     [4] цена          [5] старая цена     [6] закупка        [7] остаток
     [8] рейтинг       [9] число отзывов   [10] продажи       [11] бейджи
     [12] ключевые характеристики (чипами на карточке)        [13] specs
     [14] описание                                                            */
  seed.rawProducts = [
    /* ============================= ПРОЦЕССОРЫ ============================= */
    ['cpu-i3-14100f', 'Процессор Intel Core i3-14100F', 'cpu', 'Intel', 52990, 63990, 42990, 38, 4.4, 27, 214,
      ['Хит бюджета'], ['LGA1700', '4 ядра / 8 потоков'],
      { socket: 'LGA1700', cores: 4, threads: 8, base: '3.5 ГГц', boost: '4.7 ГГц', tdp: 58, ram: 'DDR4/DDR5', igpu: false, score: 34 },
      'Доступный 4-ядерный процессор для офисных и домашних сборок. Низкое тепловыделение, официальная гарантия и честная производительность в повседневных задачах.'],
    ['cpu-i5-12400f', 'Процессор Intel Core i5-12400F', 'cpu', 'Intel', 75990, 89990, 60990, 44, 4.7, 68, 356,
      ['Выбор покупателей'], ['LGA1700', '6 ядер / 12 потоков'],
      { socket: 'LGA1700', cores: 6, threads: 12, base: '2.5 ГГц', boost: '4.4 ГГц', tdp: 65, ram: 'DDR4/DDR5', igpu: false, score: 47 },
      'Народный 6-ядерник: уверенно тянет киберспортивные дисциплины, работу с документами и монтаж Full HD. Отличная пара для видеокарт уровня RTX 4060.'],
    ['cpu-i5-14400f', 'Процессор Intel Core i5-14400F', 'cpu', 'Intel', 105990, 125990, 86990, 31, 4.8, 54, 231,
      ['Хит'], ['LGA1700', '10 ядер / 16 потоков'],
      { socket: 'LGA1700', cores: 10, threads: 16, base: '2.5 ГГц', boost: '4.7 ГГц', tdp: 65, ram: 'DDR4/DDR5', igpu: false, score: 58 },
      'Гибридная архитектура 6P + 4E: лучший баланс цены и производительности для игр в 1440p и многозадачной работы.'],
    ['cpu-i7-14700kf', 'Процессор Intel Core i7-14700KF', 'cpu', 'Intel', 240990, 273990, 203990, 12, 4.9, 41, 118,
      ['Для стрима'], ['LGA1700', '20 ядер / 28 потоков'],
      { socket: 'LGA1700', cores: 20, threads: 28, base: '3.4 ГГц', boost: '5.6 ГГц', tdp: 125, ram: 'DDR4/DDR5', igpu: false, unlocked: true, score: 86 },
      'Флагман для стриминга, рендера и 4K-гейминга. Разблокированный множитель позволяет выжать максимум при серьёзном охлаждении.'],
    ['cpu-r5-5600', 'Процессор AMD Ryzen 5 5600', 'cpu', 'AMD', 63990, 77990, 52990, 52, 4.7, 92, 402,
      ['Хит'], ['AM4', '6 ядер / 12 потоков'],
      { socket: 'AM4', cores: 6, threads: 12, base: '3.5 ГГц', boost: '4.4 ГГц', tdp: 65, ram: 'DDR4', igpu: false, score: 46 },
      'Лучший бюджетный игровой выбор на платформе AM4: холодный, тихий и очень отзывчивый в играх.'],
    ['cpu-r5-7600', 'Процессор AMD Ryzen 5 7600', 'cpu', 'AMD', 128990, 147990, 107990, 24, 4.8, 37, 149,
      ['DDR5', 'Есть графика'], ['AM5', '6 ядер / 12 потоков'],
      { socket: 'AM5', cores: 6, threads: 12, base: '3.8 ГГц', boost: '5.1 ГГц', tdp: 65, ram: 'DDR5', igpu: true, score: 62 },
      'Современная платформа AM5 с поддержкой DDR5 и встроенной графикой Radeon: апгрейд-путь на годы вперёд.'],
    ['cpu-r7-7800x3d', 'Процессор AMD Ryzen 7 7800X3D', 'cpu', 'AMD', 296990, 335990, 251990, 8, 5.0, 63, 96,
      ['Топ для игр'], ['AM5', '3D V-Cache 96 МБ'],
      { socket: 'AM5', cores: 8, threads: 16, base: '4.2 ГГц', boost: '5.0 ГГц', tdp: 120, ram: 'DDR5', igpu: true, vcache: '96 МБ', score: 94 },
      'Король игровой производительности благодаря 3D V-Cache: снимает любые ограничения по процессору на годы вперёд.'],
    /* ========================= МАТЕРИНСКИЕ ПЛАТЫ ========================= */
    ['mb-h610m', 'Материнская плата MSI PRO H610M-E DDR4', 'motherboard', 'MSI', 35990, 44990, 28990, 41, 4.3, 34, 187,
      ['Бюджет'], ['LGA1700', 'mATX · DDR4'],
      { socket: 'LGA1700', chipset: 'H610', formFactor: 'mATX', ramType: 'DDR4', ramSlots: 2, maxRam: 64, m2: 1, usb: 'USB 3.2 Gen1', wifi: false, score: 28 },
      'Простая и надёжная плата для офисных сборок и недорогих игровых ПК. Поддерживает процессоры Intel 12–14 поколения с DDR4.'],
    ['mb-b760m-d4', 'Материнская плата ASUS PRIME B760M-A DDR4', 'motherboard', 'ASUS', 72990, 86990, 57990, 29, 4.6, 45, 168,
      [], ['LGA1700', 'mATX · 4 слота RAM'],
      { socket: 'LGA1700', chipset: 'B760', formFactor: 'mATX', ramType: 'DDR4', ramSlots: 4, maxRam: 128, m2: 2, usb: 'USB 3.2 Gen2 Type-C', wifi: false, score: 41 },
      'Компромисс между ценой и функциональностью: два M.2, Type-C на задней панели и стабильный VRM для i5/i7 без разгона.'],
    ['mb-b550m', 'Материнская плата GIGABYTE B550M K', 'motherboard', 'Gigabyte', 47990, 55990, 37990, 33, 4.4, 51, 203,
      ['Хит бюджета'], ['AM4', 'mATX · DDR4'],
      { socket: 'AM4', chipset: 'B550', formFactor: 'mATX', ramType: 'DDR4', ramSlots: 4, maxRam: 128, m2: 1, usb: 'USB 3.2 Gen1', wifi: false, score: 32 },
      'Народная платформа AM4 для Ryzen 5000: четыре слота памяти, M.2 и поддержка PCIe 4.0 для видеокарт.'],
    ['mb-b650m-d5', 'Материнская плата Gigabyte B650M DS3H', 'motherboard', 'Gigabyte', 89990, 105990, 71990, 22, 4.6, 28, 132,
      ['DDR5'], ['AM5', 'mATX · DDR5'],
      { socket: 'AM5', chipset: 'B650', formFactor: 'mATX', ramType: 'DDR5', ramSlots: 4, maxRam: 128, m2: 2, usb: 'USB 3.2 Gen2 Type-C', wifi: false, score: 46 },
      'Надёжная основа для Ryzen 7000/8000: DDR5 до 6400 МГц, два M.2 с радиатором и качественное питание.'],
    ['mb-b760-tuf', 'Материнская плата ASUS TUF GAMING B760-PLUS WIFI', 'motherboard', 'ASUS', 133990, 156990, 109990, 15, 4.8, 22, 87,
      ['Wi-Fi 6'], ['LGA1700', 'ATX · DDR5'],
      { socket: 'LGA1700', chipset: 'B760', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, maxRam: 192, m2: 3, usb: 'USB 3.2 Gen2x2 Type-C', wifi: true, score: 62 },
      'Полноразмерная плата в армейском стиле: усиленный VRM, три M.2, Wi-Fi 6 и поддержка DDR5-7200 (OC).'],
    ['mb-x670e', 'Материнская плата MSI MAG X670E TOMAHAWK WIFI', 'motherboard', 'MSI', 217990, 251990, 184990, 9, 4.9, 14, 41,
      ['PCIe 5.0'], ['AM5', 'ATX · Wi-Fi 6E'],
      { socket: 'AM5', chipset: 'X670E', formFactor: 'ATX', ramType: 'DDR5', ramSlots: 4, maxRam: 192, m2: 4, usb: 'USB 3.2 Gen2x2 + Type-C', wifi: true, score: 82 },
      'Топовая AM5-платформа: PCIe 5.0 для видеокарт и SSD, четыре M.2 и мощный VRM 14+2+1 под Ryzen 9.'],
    /* ============================= ВИДЕОКАРТЫ ============================= */
    ['gpu-rtx3050', 'Видеокарта Palit GeForce RTX 3050 Dual 8GB', 'gpu', 'Palit', 122990, 142990, 99990, 18, 4.4, 39, 176,
      ['Бюджет'], ['8 ГБ GDDR6', 'DLSS'],
      { chip: 'GeForce RTX 3050', vram: 8, tdp: 130, length: 172, recommendedPsu: 450, ports: 'HDMI 2.1, 3×DP 1.4a', score: 30 },
      'Входной билет в RTX-гейминг: трассировка лучей и DLSS в киберспортивных играх на высоких настройках 1080p.'],
    ['gpu-rtx4060', 'Видеокарта MSI GeForce RTX 4060 Ventus 2X OC 8GB', 'gpu', 'MSI', 195990, 223990, 164990, 26, 4.7, 74, 289,
      ['Хит'], ['8 ГБ GDDR6', 'DLSS 3'],
      { chip: 'GeForce RTX 4060', vram: 8, tdp: 115, length: 199, recommendedPsu: 550, ports: 'HDMI 2.1, 3×DP 1.4a', score: 44 },
      'Самый популярный выбор для Full HD: производительность RTX 3060 Ti при вдвое меньшем энергопотреблении и поддержкой DLSS 3.'],
    ['gpu-rtx4060ti', 'Видеокарта Gigabyte GeForce RTX 4060 Ti Gaming OC 8GB', 'gpu', 'Gigabyte', 268990, 301990, 226990, 14, 4.6, 41, 152,
      [], ['8 ГБ GDDR6', 'PCIe 4.0'],
      { chip: 'GeForce RTX 4060 Ti', vram: 8, tdp: 160, length: 281, recommendedPsu: 600, ports: 'HDMI 2.1, 3×DP 1.4a', score: 54 },
      'Уверенные 100+ FPS в 1080p и комфортный гейминг в 1440p. Тройной вентилятор WINDFORCE и заводской разгон.'],
    ['gpu-rtx4070s', 'Видеокарта ASUS GeForce RTX 4070 SUPER Dual OC 12GB', 'gpu', 'ASUS', 419990, 464990, 355990, 11, 4.9, 33, 98,
      ['2K-гейминг'], ['12 ГБ GDDR6X', 'DLSS 3'],
      { chip: 'GeForce RTX 4070 SUPER', vram: 12, tdp: 220, length: 267, recommendedPsu: 700, ports: 'HDMI 2.1, 3×DP 1.4a', score: 72 },
      'Золотая середина для 1440p с трассировкой лучей и запасом по видеопамяти для новых тайтлов.'],
    ['gpu-rtx4080s', 'Видеокарта MSI GeForce RTX 4080 SUPER Gaming X Slim 16GB', 'gpu', 'MSI', 783990, 856990, 677990, 5, 5.0, 19, 47,
      ['4K'], ['16 ГБ GDDR6X', 'PCIe 4.0'],
      { chip: 'GeForce RTX 4080 SUPER', vram: 16, tdp: 320, length: 322, recommendedPsu: 850, ports: 'HDMI 2.1, 3×DP 1.4a', score: 88 },
      'Видеокарта для 4K-гейминга и профессионального рендера: 16 ГБ GDDR6X и охлаждение TRI FROZR 3.'],
    ['gpu-rx7600', 'Видеокарта Sapphire Radeon RX 7600 PULSE 8GB', 'gpu', 'Sapphire', 167990, 187990, 138990, 21, 4.5, 36, 163,
      ['Красная цена'], ['8 ГБ GDDR6', 'FSR 3'],
      { chip: 'Radeon RX 7600', vram: 8, tdp: 165, length: 240, recommendedPsu: 550, ports: 'HDMI 2.1, 3×DP 2.1', score: 39 },
      'Отличное соотношение «цена/кадры» в 1080p: технология FSR 3, три вентилятора и низкий уровень шума.'],
    ['gpu-rx7800xt', 'Видеокарта PowerColor Radeon RX 7800 XT Hellhound 16GB', 'gpu', 'PowerColor', 447990, 492990, 380990, 7, 4.8, 25, 71,
      ['16 ГБ'], ['16 ГБ GDDR6', 'FSR 3'],
      { chip: 'Radeon RX 7800 XT', vram: 16, tdp: 263, length: 320, recommendedPsu: 750, ports: 'HDMI 2.1, 3×DP 2.1', score: 74 },
      'Богатая видеопамять для текстур ультра-качества в 1440p и 4K. Отличный выбор для моддинга и VR.'],
    /* ========================= ОПЕРАТИВНАЯ ПАМЯТЬ ========================= */
    ['ram-fury-ddr4-16', 'Оперативная память Kingston FURY Beast DDR4 16GB (2×8) 3200', 'ram', 'Kingston', 27990, 33990, 20990, 46, 4.6, 58, 268,
      ['DDR4'], ['2×8 ГБ', '3200 МГц · CL16'],
      { type: 'DDR4', capacity: 16, modules: 2, speed: 3200, latency: 'CL16', rgb: false, score: 26 },
      'Классический двухканальный комплект для платформы AM4 и Intel 12–14. Профиль XMP включается в один клик.'],
    ['ram-fury-ddr4-32', 'Оперативная память Kingston FURY Beast RGB DDR4 32GB (2×16) 3600', 'ram', 'Kingston', 52990, 63990, 41990, 27, 4.7, 44, 174,
      ['RGB'], ['2×16 ГБ', '3600 МГц · CL18'],
      { type: 'DDR4', capacity: 32, modules: 2, speed: 3600, latency: 'CL18', rgb: true, score: 33 },
      'Стильный RGB-комплект 32 ГБ для стриминга и тяжёлых рабочих задач с поддержкой синхронизации подсветки.'],
    ['ram-fury-ddr5-16', 'Оперативная память Kingston FURY Beast DDR5 16GB (2×8) 5600', 'ram', 'Kingston', 40990, 47990, 31990, 34, 4.5, 31, 156,
      ['DDR5'], ['2×8 ГБ', '5600 МГц · CL36'],
      { type: 'DDR5', capacity: 16, modules: 2, speed: 5600, latency: 'CL36', rgb: false, score: 38 },
      'Стартовый комплект DDR5 с интегрированным управлением питанием (PMIC) и профилями EXPO/XMP 3.0.'],
    ['ram-trident-ddr5-32', 'Оперативная память G.Skill Trident Z5 RGB DDR5 32GB (2×16) 6000 CL30', 'ram', 'G.Skill', 89990, 103990, 71990, 19, 4.9, 39, 118,
      ['Топ для AM5'], ['2×16 ГБ', '6000 МГц · CL30'],
      { type: 'DDR5', capacity: 32, modules: 2, speed: 6000, latency: 'CL30', rgb: true, score: 56 },
      'Оптимальный вариант для Ryzen 7000: частота 6000 МГц и тайминги CL30 дают максимум FPS в играх.'],
    ['ram-xpg-ddr5-32', 'Оперативная память ADATA XPG Lancer Blade DDR5 32GB (2×16) 6400', 'ram', 'ADATA', 97990, 111990, 78990, 16, 4.7, 21, 79,
      ['6400 МГц'], ['2×16 ГБ', '6400 МГц · CL32'],
      { type: 'DDR5', capacity: 32, modules: 2, speed: 6400, latency: 'CL32', rgb: false, score: 58 },
      'Низкопрофильный комплект с высокой частотой для плат на B650/X670E и Z790. Отлично подходит под большие башенные кулеры.'],
    ['ram-vengeance-ddr5-64', 'Оперативная память Corsair VENGEANCE DDR5 64GB (2×32) 6000', 'ram', 'Corsair', 150990, 173990, 122990, 8, 4.8, 17, 44,
      ['64 ГБ'], ['2×32 ГБ', '6000 МГц · CL30'],
      { type: 'DDR5', capacity: 64, modules: 2, speed: 6000, latency: 'CL30', rgb: false, score: 62 },
      'Большой объём для видеомонтажа, 3D-рендера и работы с виртуальными машинами без компромиссов по частоте.'],
    /* ============================== НАКОПИТЕЛИ ============================ */
    ['ssd-samsung-980-500', 'SSD Samsung 980 500GB NVMe PCIe 3.0', 'storage', 'Samsung', 24990, 30990, 18990, 52, 4.6, 64, 296,
      ['NVMe'], ['500 ГБ', 'NVMe · 3100 МБ/с'],
      { interface: 'NVMe PCIe 3.0 x4', capacity: '500 ГБ', formFactor: 'M.2 2280', read: 3100, write: 2600, score: 34 },
      'Быстрый системный накопитель без DRAM-кэша: мгновенная загрузка Windows и приложений по цене SATA-диска.'],
    ['ssd-kingston-nv2-1tb', 'SSD Kingston NV2 1TB NVMe PCIe 4.0', 'storage', 'Kingston', 38990, 47990, 29990, 44, 4.4, 71, 312,
      ['Хит'], ['1 ТБ', 'NVMe · 3500 МБ/с'],
      { interface: 'NVMe PCIe 4.0 x4', capacity: '1 ТБ', formFactor: 'M.2 2280', read: 3500, write: 2100, score: 42 },
      'Народный терабайтник: оптимальная цена за гигабайт, поддержка NVMe и низкое энергопотребление для ноутбуков.'],
    ['ssd-990pro-1tb', 'SSD Samsung 990 PRO 1TB NVMe PCIe 4.0', 'storage', 'Samsung', 72990, 83990, 57990, 23, 4.9, 47, 141,
      ['Топ'], ['1 ТБ', 'NVMe · 7450 МБ/с'],
      { interface: 'NVMe PCIe 4.0 x4', capacity: '1 ТБ', formFactor: 'M.2 2280', read: 7450, write: 6900, score: 78 },
      'Флагманские скорости до 7450 МБ/с и высокий ресурс TBW — для игровых сборок и рабочих станций.'],
    ['ssd-wd-sn850x-2tb', 'SSD WD_BLACK SN850X 2TB NVMe PCIe 4.0', 'storage', 'WD', 128990, 147990, 104990, 14, 4.8, 29, 88,
      ['Для игр'], ['2 ТБ', 'NVMe · 7300 МБ/с'],
      { interface: 'NVMe PCIe 4.0 x4', capacity: '2 ТБ', formFactor: 'M.2 2280', read: 7300, write: 6600, score: 82 },
      'Два терабайта под библиотеку игр: технология Game Mode 2.0 и стабильная производительность под нагрузкой.'],
    ['ssd-crucial-bx500-1tb', 'SSD Crucial BX500 1TB SATA III', 'storage', 'Crucial', 35990, 41990, 27990, 31, 4.3, 38, 167,
      ['SATA'], ['1 ТБ', 'SATA · 540 МБ/с'],
      { interface: 'SATA III', capacity: '1 ТБ', formFactor: '2.5"', read: 540, write: 500, score: 20 },
      'Надёжный SATA-накопитель для апгрейда старых ПК и ноутбуков. Не требует M.2-разъёма на плате.'],
    ['hdd-toshiba-p300-2tb', 'Жёсткий диск Toshiba P300 2TB 3.5"', 'storage', 'Toshiba', 32990, 38990, 24990, 26, 4.5, 33, 149,
      ['HDD'], ['2 ТБ', '7200 об/мин'],
      { interface: 'SATA III', capacity: '2 ТБ', formFactor: '3.5"', read: 180, write: 170, score: 14 },
      'Ёмкий жёсткий диск для архивов, бэкапов и медиатеки. Оптимальная стоимость хранения гигабайта.'],
    /* ============================ БЛОКИ ПИТАНИЯ =========================== */
    ['psu-cv650', 'Блок питания Cougar VTE X2 650W 80+ Bronze', 'psu', 'Cougar', 33990, 38990, 25990, 37, 4.4, 42, 198,
      ['Bronze'], ['650 Вт', '80+ Bronze'],
      { wattage: 650, efficiency: '80+ Bronze', modular: 'нет', formFactor: 'ATX', pcie: '2×8-pin', score: 46 },
      'Надёжная база для сборок среднего уровня: защита от перегрузок OCP/OVP и тихий 120-мм вентилятор.'],
    ['psu-cx750', 'Блок питания Corsair CX750 750W 80+ Bronze', 'psu', 'Corsair', 47990, 55990, 37990, 24, 4.6, 36, 157,
      ['Хит'], ['750 Вт', '80+ Bronze'],
      { wattage: 750, efficiency: '80+ Bronze', modular: 'нет', formFactor: 'ATX', pcie: '4×8-pin', score: 54 },
      'Проверенная платформа с технологией Zero RPM: вентилятор молчит при малых нагрузках. Четыре коннектора PCIe.'],
    ['psu-rm850x', 'Блок питания Corsair RM850x 850W 80+ Gold', 'psu', 'Corsair', 100990, 114990, 79990, 15, 4.9, 31, 104,
      ['Gold'], ['850 Вт', '80+ Gold'],
      { wattage: 850, efficiency: '80+ Gold', modular: 'полностью модульный', formFactor: 'ATX', pcie: 'коннектор 12VHPWR', score: 74 },
      'Полностью модульный блок с японскими конденсаторами и разъёмом 12VHPWR для современных видеокарт.'],
    ['psu-vertex1000', 'Блок питания MSI MPG A1000G PCIE5 1000W 80+ Gold', 'psu', 'MSI', 139990, 159990, 110990, 9, 4.8, 18, 61,
      ['1000 Вт'], ['1000 Вт', '80+ Gold'],
      { wattage: 1000, efficiency: '80+ Gold', modular: 'полностью модульный', formFactor: 'ATX', pcie: '2×12VHPWR', score: 86 },
      'Запас мощности для RTX 4080/4090 и многопроцессорных сборок. Поддержка ATX 3.0 и режима низких нагрузок.'],
    ['psu-sfx600', 'Блок питания be quiet! SFX Power 3 600W 80+ Bronze', 'psu', 'be quiet!', 61990, 72990, 48990, 12, 4.7, 12, 47,
      ['SFX'], ['600 Вт', 'SFX · Bronze'],
      { wattage: 600, efficiency: '80+ Bronze', modular: 'нет', formFactor: 'SFX', pcie: '2×8-pin', score: 48 },
      'Компактный SFX-блок для mini-ITX корпусов: тихая работа и высокий КПД в маленьком корпусе.'],
    /* ================================ КОРПУСА ============================= */
    ['case-nx200', 'Корпус Zalman NX200 Black', 'case', 'Zalman', 19990, 23990, 14990, 29, 4.3, 26, 138,
      ['Формат ATX'], ['ATX', '2 вентилятора в комплекте'],
      { formFactors: ['ATX', 'mATX', 'ITX'], maxGpuLength: 310, maxCoolerHeight: 160, radiator: 'до 240 мм', fans: '2 × 120 мм (предустановлены)', psuFormFactor: 'ATX', score: 34 },
      'Классический корпус с сетчатой фронтальной панелью и двумя вентиляторами в комплекте — идеален для бюджетных сборок.'],
    ['case-4000d', 'Корпус Corsair 4000D Airflow Tempered Glass', 'case', 'Corsair', 55990, 63990, 43990, 17, 4.8, 39, 122,
      ['Хит'], ['ATX', 'Закалённое стекло'],
      { formFactors: ['ATX', 'mATX', 'ITX'], maxGpuLength: 360, maxCoolerHeight: 170, radiator: 'до 360 мм', fans: '1 × 120 мм + место под 5', psuFormFactor: 'ATX', score: 68 },
      'Один из самых продуваемых ATX-корпусов: решётчатая передняя панель, кабель-менеджмент и стеклянная боковина.'],
    ['case-nzxt-h5', 'Корпус NZXT H5 Flow White', 'case', 'NZXT', 72990, 80990, 57990, 11, 4.7, 22, 79,
      ['Белый'], ['ATX', 'Стекло · White'],
      { formFactors: ['ATX', 'mATX', 'ITX'], maxGpuLength: 365, maxCoolerHeight: 165, radiator: 'до 280 мм', fans: '2 × 120 мм + нижний на GPU', psuFormFactor: 'ATX', score: 72 },
      'Стильный белый корпус с нижним каналом обдува видеокарты, скрытым блоком питания и чистым интерьером.'],
    ['case-nr200', 'Корпус Cooler Master NR200P Mini-ITX', 'case', 'Cooler Master', 58990, 66990, 45990, 8, 4.6, 14, 52,
      ['Mini-ITX'], ['ITX', '18.25 л'],
      { formFactors: ['ITX'], maxGpuLength: 330, maxCoolerHeight: 155, radiator: 'до 240 мм', fans: '2 × 120 мм', psuFormFactor: 'SFX', score: 64 },
      'Компактный mini-ITX корпус объёмом 18 литров, который берёт полноразмерную видеокарту. Два варианта боковой панели.'],
    ['case-eclipse-p500', 'Корпус Phanteks Eclipse P500A DRGB Black', 'case', 'Phanteks', 83990, 94990, 66990, 6, 4.8, 11, 37,
      ['Есть место под СЖО'], ['E-ATX', '3 × 140 мм DRGB'],
      { formFactors: ['E-ATX', 'ATX', 'mATX', 'ITX'], maxGpuLength: 435, maxCoolerHeight: 190, radiator: 'до 420 мм', fans: '3 × 140 мм DRGB', psuFormFactor: 'ATX', score: 88 },
      'Просторный корпус с адресуемой RGB-подсветкой, поддержкой E-ATX и радиаторов до 420 мм. Для самых горячих сборок.'],
    ['case-matx-q300', 'Корпус Zalman i4 TG Black', 'case', 'Zalman', 33990, 38990, 24990, 14, 4.4, 18, 74,
      ['mATX'], ['mATX · ATX', 'Стекло'],
      { formFactors: ['ATX', 'mATX', 'ITX'], maxGpuLength: 330, maxCoolerHeight: 165, radiator: 'до 240 мм', fans: '3 × 120 мм (RGB)', psuFormFactor: 'ATX', score: 66 },
      'Корпус с панорамным стеклом и ARGB-вентиляторами: эффектный внешний вид при доступной цене.'],
    /* ============================== ОХЛАЖДЕНИЕ ============================ */
    ['cool-pure-slim', 'Кулер DeepCool AK400 Zero Dark', 'cooling', 'DeepCool', 17990, 21990, 13990, 34, 4.6, 48, 214,
      ['До 180 Вт'], ['Воздушный', 'До 180 Вт TDP'],
      { type: 'air', sockets: ['LGA1700', 'LGA1200', 'AM4', 'AM5'], tdpRating: 180, height: 155, noise: '28 дБ', score: 46 },
      'Четыре тепловые трубки и 120-мм вентилятор: справляется с i5 и Ryzen 5 при почти бесшумной работе.'],
    ['cool-tf120', 'Кулер Thermalright Peerless Assassin 120 SE', 'cooling', 'Thermalright', 30990, 35990, 22990, 22, 4.9, 57, 189,
      ['Лучшая цена/охлаждение'], ['Воздушный', 'До 245 Вт TDP'],
      { type: 'air', sockets: ['LGA1700', 'LGA1200', 'AM4', 'AM5'], tdpRating: 245, height: 158, noise: '25.6 дБ', score: 72 },
      'Двухбашенный кулер, который охлаждает как СЖО: две башни, шесть трубок и два вентилятора PWM в комплекте.'],
    ['cool-d15', 'Кулер Noctua NH-D15 chromax.black', 'cooling', 'Noctua', 86990, 97990, 68990, 7, 5.0, 29, 68,
      ['Флагман'], ['Воздушный', 'До 250 Вт TDP'],
      { type: 'air', sockets: ['LGA1700', 'LGA1200', 'AM4', 'AM5'], tdpRating: 250, height: 165, noise: '24.6 дБ', score: 88 },
      'Легендарный двухбашенный кулер с австрийскими вентиляторами NF-A15: тишина и максимальная эффективность.'],
    ['cool-lt520', 'СЖО DeepCool LE520 240 мм', 'cooling', 'DeepCool', 41990, 47990, 31990, 16, 4.5, 32, 121,
      ['СЖО'], ['240 мм', 'RGB подсветка'],
      { type: 'liquid', sockets: ['LGA1700', 'LGA1200', 'AM4', 'AM5'], tdpRating: 220, radiator: 240, height: 55, noise: '32 дБ', score: 70 },
      'Недорогая система жидкостного охлаждения 240 мм с антикоррозийным контуром и подсветкой помпы ARGB.'],
    ['cool-kraken-360', 'СЖО NZXT Kraken Elite 360 RGB', 'cooling', 'NZXT', 184990, 206990, 147990, 5, 4.9, 15, 39,
      ['360 мм'], ['360 мм', 'Экран на помпе'],
      { type: 'liquid', sockets: ['LGA1700', 'LGA1200', 'AM4', 'AM5'], tdpRating: 320, radiator: 360, height: 58, noise: '36 дБ', score: 96 },
      'Флагманская тройная СЖО с LCD-экраном на помпе, тремя PWM-вентиляторами и управлением через CAM.'],
    /* =============================== МОНИТОРЫ ============================= */
    ['mon-lg-24-fhd', 'Монитор LG 24MR400-B 23.8" Full HD IPS 100 Гц', 'monitor', 'LG', 55990, 66990, 43990, 20, 4.5, 27, 112,
      ['100 Гц'], ['23.8" · 1920×1080', 'IPS · 100 Гц'],
      { diagonal: '23.8"', resolution: '1920×1080', refresh: 100, panel: 'IPS', response: '5 мс', hdr: false, score: 42 },
      'Аккуратный IPS-монитор с частотой 100 Гц для дома и офиса. Режим защиты зрения и тонкие рамки.'],
    ['mon-aoc-24-180', 'Монитор AOC 24G4X 23.8" Full HD IPS 180 Гц', 'monitor', 'AOC', 89990, 103990, 71990, 13, 4.7, 31, 96,
      ['Для киберспорта'], ['23.8" · 1920×1080', 'IPS · 180 Гц'],
      { diagonal: '23.8"', resolution: '1920×1080', refresh: 180, panel: 'IPS', response: '1 мс', hdr: true, score: 62 },
      'Игровой монитор 180 Гц с откликом 1 мс GtG — заметное преимущество в шутерах и CS2.'],
    ['mon-msi-27-2k', 'Монитор MSI MAG 274QRF QD E2 27" 2K 180 Гц', 'monitor', 'MSI', 184990, 206990, 147990, 10, 4.8, 24, 74,
      ['2K · Quantum Dot'], ['27" · 2560×1440', 'IPS · 180 Гц'],
      { diagonal: '27"', resolution: '2560×1440', refresh: 180, panel: 'IPS Quantum Dot', response: '1 мс', hdr: true, score: 78 },
      'Оптимальный 27-дюймовый игровой монитор для 1440p: квантовые точки, 180 Гц и поддержка HDR400.'],
    ['mon-samsung-32-4k', 'Монитор Samsung Odyssey G7 32" 4K 144 Гц', 'monitor', 'Samsung', 503990, 559990, 425990, 4, 4.7, 12, 28,
      ['4K'], ['32" · 3840×2160', 'IPS · 144 Гц'],
      { diagonal: '32"', resolution: '3840×2160', refresh: 144, panel: 'IPS', response: '1 мс', hdr: true, score: 92 },
      'Большой 4K-монитор для работы и игр: 144 Гц, HDMI 2.1 и полное покрытие sRGB/DCI-P3.'],
    /* =============================== ПЕРИФЕРИЯ ============================ */
    ['kb-logitech-g213', 'Клавиатура Logitech G213 Prodigy', 'peripherals', 'Logitech', 23990, 27990, 17990, 27, 4.4, 44, 186,
      ['Мембранная'], ['USB', 'RGB LIGHTSYNC'],
      { kind: 'keyboard', connection: 'USB', backlight: 'RGB LIGHTSYNC', layout: 'Полноразмерная', score: 40 },
      'Игровая мембранная клавиатура с защитой от пролитой жидкости и настраиваемой подсветкой по зонам.'],
    ['kb-hyperx-alloy', 'Клавиатура HyperX Alloy Origins Core RGB', 'peripherals', 'HyperX', 49990, 58990, 38990, 12, 4.8, 23, 84,
      ['Механика'], ['USB-C', 'Свитчи HyperX Red'],
      { kind: 'keyboard', connection: 'USB-C', backlight: 'RGB', layout: 'TKL (без цифрового блока)', switch: 'HyperX Red (линейные)', score: 68 },
      'Механическая TKL-клавиатура в авиационном алюминии: линейные свитчи и полная RGB-подсветка.'],
    ['mouse-g102', 'Мышь Logitech G102 LIGHTSYNC Black', 'peripherals', 'Logitech', 13990, 16990, 9990, 43, 4.6, 61, 274,
      ['Хит'], ['USB', '8000 DPI'],
      { kind: 'mouse', connection: 'USB', dpi: 8000, buttons: 6, weight: '85 г', score: 44 },
      'Народная игровая мышь: сенсор 8000 DPI, шесть программируемых кнопок и подсветка LIGHTSYNC.'],
    ['mouse-deathadder', 'Мышь Razer DeathAdder Essential', 'peripherals', 'Razer', 16990, 19990, 11990, 31, 4.5, 38, 197,
      ['Классика'], ['USB', '6400 DPI'],
      { kind: 'mouse', connection: 'USB', dpi: 6400, buttons: 5, weight: '96 г', score: 38 },
      'Проверенная эргономика правой руки с оптическим сенсором 6400 DPI и механическими переключателями.'],
    ['headset-cloud2', 'Гарнитура HyperX Cloud II Red', 'peripherals', 'HyperX', 49990, 55990, 37990, 15, 4.9, 34, 108,
      ['7.1'], ['USB / 3.5 мм', 'Виртуальный 7.1'],
      { kind: 'headset', connection: 'USB / 3.5 мм', surround: 'Виртуальный 7.1', mic: 'Съёмный с шумоподавлением', score: 72 },
      'Легендарная игровая гарнитура с алюминиевой рамой, памятью в амбушюрах и звуковой картой 7.1.'],
    /* =========================== ГОТОВЫЕ СБОРКИ =========================== */
    ['pc-start', 'Игровой ПК ByteStore Start: i3-14100F / RTX 3050 / 16GB', 'prebuilt', 'ByteStore', 363990, 419990, 304990, 7, 4.6, 19, 88,
      ['Готов к работе'], ['Intel i3-14100F + RTX 3050', '16 ГБ · SSD 500 ГБ'],
      { cpu: 'Intel Core i3-14100F', gpu: 'GeForce RTX 3050 8 ГБ', ram: '16 ГБ DDR4-3200', storage: 'SSD 500 ГБ NVMe', psu: '650 Вт 80+ Bronze', warranty: '3 года', score: 40 },
      'Собранный и протестированный ПК для Full HD-гейминга в популярных онлайн-играх. Windows и драйверы уже установлены.'],
    ['pc-gaming-pro', 'Игровой ПК ByteStore Gaming Pro: i5-14400F / RTX 4060 Ti / 32GB', 'prebuilt', 'ByteStore', 671990, 755990, 565990, 4, 4.9, 26, 63,
      ['Хит продаж'], ['Intel i5-14400F + RTX 4060 Ti', '32 ГБ DDR5 · SSD 1 ТБ'],
      { cpu: 'Intel Core i5-14400F', gpu: 'GeForce RTX 4060 Ti 8 ГБ', ram: '32 ГБ DDR5-6000', storage: 'SSD 1 ТБ NVMe + 2 ТБ HDD', psu: '750 Вт 80+ Bronze', warranty: '3 года', score: 66 },
      'Сбалансированная сборка для 1440p: 32 ГБ DDR5, быстрый NVMe и трёхлетняя гарантия с бесплатным обслуживанием.'],
    ['pc-ultimate-4k', 'Игровой ПК ByteStore Ultimate 4K: i7-14700KF / RTX 4080 SUPER / 64GB', 'prebuilt', 'ByteStore', 1567990, 1735990, 1332990, 2, 5.0, 9, 21,
      ['4K · СЖО'], ['Intel i7-14700KF + RTX 4080 SUPER', '64 ГБ DDR5 · SSD 2 ТБ'],
      { cpu: 'Intel Core i7-14700KF', gpu: 'GeForce RTX 4080 SUPER 16 ГБ', ram: '64 ГБ DDR5-6000', storage: 'SSD 2 ТБ NVMe PCIe 4.0', psu: '1000 Вт 80+ Gold', cooling: 'СЖО 360 мм', warranty: '3 года', score: 95 },
      'Бескомпромиссная станция для 4K-гейминга, стриминга и рендеринга. Жидкостное охлаждение 360 мм и подсветка ARGB.']
  ];







  /* ------------------------------- Промокоды ------------------------------ */
  seed.promos = [
    { code: 'BYTE10', type: 'percent', value: 10, min: 280000, description: 'Скидка 10% на заказ от 280 000 ₸', active: true, used: 47 },
    { code: 'START5', type: 'percent', value: 5, min: 0, description: 'Скидка 5% на первый заказ', active: true, used: 132 },
    { code: 'UPGRADE15', type: 'percent', value: 15, min: 680000, description: 'Скидка 15% на сборку ПК от 680 000 ₸', active: true, used: 18 },
    { code: 'FREESHIP', type: 'fixed', value: 2990, min: 85000, description: 'Бесплатная доставка от 85 000 ₸', active: true, used: 96 },
    { code: 'GPU2025', type: 'fixed', value: 17000, min: 340000, description: '17 000 ₸ при покупке видеокарты (архив)', active: false, used: 205 }
  ];

  /* --------------------------- Демо-пользователи -------------------------- */
  /* Пароль всех демо-аккаунтов: demo1234                                   */
  seed.demoUsers = [
    { id: 'u-alex', name: 'Алексей Морозов', email: 'alex.morozov@mail.ru', phone: '+7 701 220-14-77', password: 'demo1234' },
    { id: 'u-maria', name: 'Мария Ветрова', email: 'maria.vetrova@gmail.com', phone: '+7 705 118-30-05', password: 'demo1234' },
    { id: 'u-ivan', name: 'Иван Селезнёв', email: 'ivan.seleznev@yandex.ru', phone: '+7 747 774-92-16', password: 'demo1234' },
    { id: 'u-olga', name: 'Ольга Ким', email: 'olga.kim@inbox.ru', phone: '+7 702 405-71-23', password: 'demo1234' },
    { id: 'u-pavel', name: 'Павел Гордеев', email: 'pavel.gordeev@mail.ru', phone: '+7 708 330-56-48', password: 'demo1234' },
    { id: 'u-nikita', name: 'Никита Крылов', email: 'nikita.krylov@gmail.com', phone: '+7 771 601-45-90', password: 'demo1234' }
  ];

  /* ------------------------------ Демо-отзывы ----------------------------- */
  /* status: published | pending | rejected (pending ждёт модерации в админке) */
  seed.demoReviews = [
    { productId: 'gpu-rtx4060', userId: 'u-alex', author: 'Алексей Морозов', rating: 5, daysAgo: 9, status: 'published', likes: 21,
      text: 'Взял для 1080p — тянет Cyberpunk с трассировкой на высоких + DLSS. Карта холодная и тихая, приросли к ней 2 вентилятора в корпусе.',
      reply: 'Спасибо за отзыв! Напомним: для RTX 4060 рекомендуем БП от 550 Вт с 8-pin.' },
    { productId: 'cpu-r7-7800x3d', userId: 'u-ivan', author: 'Иван Селезнёв', rating: 5, daysAgo: 15, status: 'published', likes: 34,
      text: 'Перешёл с i7-10700KF. В CS2 и World of Tanks кадры выросли в 1,4 раза, температуры в пределах 70 °C под кулером Peerless Assassin.',
      reply: 'Отличная сборка! Для 7800X3D главное — включить EXPO в BIOS.' },
    { productId: 'ssd-kingston-nv2-1tb', userId: 'u-maria', author: 'Мария Ветрова', rating: 4, daysAgo: 22, status: 'published', likes: 12,
      text: 'Цена супер, система грузится за 8 секунд. Под долгой записью больших файлов скорость падает, но для игр и системы хватает.' },
    { productId: 'cool-tf120', userId: 'u-pavel', author: 'Павел Гордеев', rating: 5, daysAgo: 6, status: 'published', likes: 18,
      text: 'За свои деньги — лучший кулер рынка. Держит Ryzen 7 5800X в стресс-тесте на 78 °C. Вентиляторы почти не слышно.',
      reply: 'Согласны! В комплекте есть термопаста и крепления под AM5.' },
    { productId: 'pc-gaming-pro', userId: 'u-olga', author: 'Ольга Ким', rating: 5, daysAgo: 4, status: 'published', likes: 9,
      text: 'Заказала сыну. Приехало в сборе, с уложенными кабелями и установленной Windows. Игрушки летают, спасибо за пунктуальную доставку!' },
    { productId: 'mb-h610m', userId: 'u-nikita', author: 'Никита Крылов', rating: 3, daysAgo: 11, status: 'published', likes: 5,
      text: 'Для офиса норм, но всего два слота памяти и один M.2. Если планируете апгрейд — берите B760.' },
    { productId: 'mon-msi-27-2k', userId: 'u-alex', author: 'Алексей Морозов', rating: 5, daysAgo: 30, status: 'published', likes: 15,
      text: 'Перешёл с 1080p 60 Гц — разница космическая. 180 Гц в шутерах дают заметное преимущество.' },
    { productId: 'psu-cx750', userId: 'u-ivan', author: 'Иван Селезнёв', rating: 4, daysAgo: 41, status: 'published', likes: 7,
      text: 'Работает второй год, кабели длинные, вентилятор не слышно. Провода не модульные — пришлось повозиться с укладкой.' },
    { productId: 'ram-trident-ddr5-32', userId: 'u-maria', author: 'Мария Ветрова', rating: 5, daysAgo: 17, status: 'published', likes: 11,
      text: 'С Ryzen 7 7700 завелись на 6000 МГц через EXPO с первого раза. Подсветка синхронизируется с платой.' },
    { productId: 'case-4000d', userId: 'u-pavel', author: 'Павел Гордеев', rating: 5, daysAgo: 55, status: 'published', likes: 14,
      text: 'Продуваемость реально отличная: температуры GPU упали на 6 °C по сравнению со старым корпусом с глухой панелью.' },
    { productId: 'headset-cloud2', userId: 'u-olga', author: 'Ольга Ким', rating: 5, daysAgo: 2, status: 'published', likes: 3,
      text: 'Микрофон чистый, коллеги в голосовом чате слышат без помех. Амбушюры из пены с эффектом памяти не давят.' },
    { productId: 'gpu-rx7600', userId: 'u-nikita', author: 'Никита Крылов', rating: 2, daysAgo: 3, status: 'pending', likes: 0,
      text: 'Драйвер подглючивает в старых играх, пришлось откатываться на предыдущую версию. В новых релизах всё ок.',
      reply: '' },
    { productId: 'cpu-i5-12400f', userId: 'u-maria', author: 'Мария Ветрова', rating: 5, daysAgo: 8, status: 'published', likes: 6,
      text: 'Идеальный вариант под бюджетную сборку: 65 Вт, греется мало, в играх не упирается в 4060.' },
    { productId: 'ssd-samsung-980-500', userId: 'u-pavel', author: 'Павел Гордеев', rating: 1, daysAgo: 5, status: 'rejected', likes: 1,
      text: 'Ожидал большего, скорость не дотягивает до заявленной. Возможно, брак, буду обращаться в сервис.', reply: '' }
  ];
  /* ------- Демонстрационная история продаж за последние N дней ------------ */
  /* Детерминированный генератор: данные стабильны между перезагрузками      */
  /* и дают наполненные графики в дашборде администратора.                   */
  seed.makeOrders = function (products, users, opts) {
    var U = BS.util;
    opts = opts || {};
    var days = opts.days || 90;
    var count = opts.count || 210;
    var rnd = U.rng(opts.seed || 20260227);
    var cities = [
      { city: 'Алматы', address: 'пр. Абая, 12, кв. 45' },
      { city: 'Астана', address: 'ул. Кабанбай батыра, 88, кв. 12' },
      { city: 'Шымкент', address: 'пр. Тауке хана, 34, кв. 7' },
      { city: 'Караганда', address: 'ул. Букетова, 24, оф. 302' },
      { city: 'Актобе', address: 'пр. Абилкайыр хана, 101, кв. 66' },
      { city: 'Тараз', address: 'ул. Толе би, 155, кв. 18' },
      { city: 'Павлодар', address: 'ул. Ломова, 42, кв. 9' }
    ];
    var payments = ['Картой онлайн', 'Картой онлайн', 'Единый QR', 'Единый QR', 'При получении'];
    var deliveryTypes = ['Курьер до двери', 'Курьер до двери', 'Самовывоз из пункта выдачи', 'Экспресс-доставка'];
    var statusPool = ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'shipped', 'processing', 'new', 'cancelled'];
    var orders = [];
    for (var i = 0; i < count; i++) {
      /* Смещение к «сегодня»: recent-заказы встречаются чаще */
      var daysAgo = Math.floor(Math.pow(rnd(), 0.72) * days);
      var createdAt = Date.now() - daysAgo * 86400000 - Math.floor(rnd() * 82800000);
      var itemsCount = 1 + (rnd() < 0.42 ? 1 : 0) + (rnd() < 0.16 ? 1 : 0);
      var used = {}, items = [], subtotal = 0;
      for (var k = 0; k < itemsCount; k++) {
        var product = products[Math.floor(rnd() * products.length)];
        if (used[product.id]) continue;
        used[product.id] = true;
        var qty = rnd() < 0.12 ? 2 : 1;
        var price = rnd() < 0.28 ? product.price : (product.oldPrice || product.price);
        subtotal += price * qty;
        items.push({ productId: product.id, name: product.name, categoryId: product.categoryId, price: price, qty: qty });
      }
      if (!items.length) continue;
      var promo = null, discount = 0;
      if (rnd() < 0.34) {
        var promos = seed.promos.filter(function (p) { return p.active; });
        promo = promos[Math.floor(rnd() * promos.length)];
        if (promo && subtotal >= promo.min) {
          discount = promo.type === 'percent' ? Math.round(subtotal * promo.value / 100) : promo.value;
        } else { promo = null; }
      }
      var deliveryCost = subtotal >= BS.util.APP.freeDeliveryFrom ? 0 : BS.util.APP.deliveryCost;
      var total = Math.max(subtotal - discount + deliveryCost, 0);
      var status = statusPool[Math.floor(rnd() * statusPool.length)];
      if (daysAgo < 2 && (status === 'delivered')) status = 'shipped';
      var user = users.length ? users[Math.floor(rnd() * users.length)] : null;
      var place = cities[Math.floor(rnd() * cities.length)];
      var guestName = ['Гость', 'Покупатель', 'Клиент'][Math.floor(rnd() * 3)] + ' ' + (i + 1);
      var customer = user
        ? { name: user.name, email: user.email, phone: user.phone }
        : { name: guestName, email: 'guest' + (1000 + i) + '@bytestore.kz', phone: '+7 700 000-00-' + U.pad(i % 100) };
      orders.push({
        id: 'ord-demo-' + i,
        number: 'BS-' + (24000 + i),
        userId: user ? user.id : null,
        customer: customer,
        city: place.city,
        address: place.address,
        items: items,
        subtotal: subtotal,
        discount: discount,
        deliveryCost: deliveryCost,
        total: total,
        promoCode: promo ? promo.code : '',
        payment: payments[Math.floor(rnd() * payments.length)],
        deliveryType: deliveryTypes[Math.floor(rnd() * deliveryTypes.length)],
        status: status,
        comment: '',
        source: reviewSource(rnd),
        createdAt: createdAt,
        history: buildHistory(status, createdAt)
      });
    }
    function reviewSource(r) { return ['Каталог', 'Каталог', 'ИИ-конфигуратор', 'Каталог', 'Чат-бот', 'Готовая сборка'][Math.floor(r * 6)]; }
    function buildHistory(status, created) {
      var chain = ['new', 'processing', 'shipped', 'delivered'];
      var steps = status === 'cancelled' ? ['new', 'cancelled'] : chain.slice(0, chain.indexOf(status) + 1);
      var ts = created;
      return steps.map(function (st, idx) {
        ts += (idx === 0 ? 0 : 3600000 * (6 + idx * 9));
        return { status: st, ts: Math.min(ts, Date.now()) };
      });
    }
    return orders.sort(function (a, b) { return a.createdAt - b.createdAt; });
  };

  /* ---------------- Демонстрационная посещаемость витрины ----------------- */
  seed.makeVisits = function (days, perDay, seedNum) {
    var U = BS.util, rnd = U.rng(seedNum || 777), out = [];
    for (var d = days; d >= 0; d--) {
      var day = Date.now() - d * 86400000;
      var weekend = [0, 6].indexOf(new Date(day).getDay()) !== -1;
      var visits = Math.round((perDay + rnd() * perDay * 0.5) * (weekend ? 1.25 : 1));
      for (var v = 0; v < visits; v++) {
        out.push(day - Math.floor(rnd() * 82800000) + Math.floor(rnd() * 3600000));
      }
    }
    return out.filter(function (t) { return t <= Date.now(); });
  };
})();


