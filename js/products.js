// Демонстраційний каталог українською; сторінки отримують його через productService.js.
export const products = [
  {
    id: "esp32-devkit",
    name: "ESP32 DevKit V1",
    category: "Мікроконтролери",
    description:
      "Компактна плата для IoT-пристроїв і прототипів: Wi-Fi, Bluetooth та роз’єми для сенсорів і модулів.",
    price: 350,
    oldPrice: null,
    image: "board",
    stock: 24,
    tags: ["ESP32", "Wi-Fi", "Bluetooth"],
    featured: true,
  },
  {
    id: "arduino-uno",
    name: "Arduino UNO R3",
    category: "Мікроконтролери",
    description:
      "Надійна плата для навчання, швидких прототипів та інтерактивних пристроїв.",
    price: 490,
    oldPrice: 560,
    image: "arduino",
    stock: 18,
    tags: ["Arduino", "ATmega328P", "USB"],
    featured: true,
  },
  {
    id: "raspberry-pi-5",
    name: "Raspberry Pi 5 · 4 GB",
    category: "Комп’ютери",
    description:
      "Одноплатний комп’ютер для домашнього сервера, медіаплеєра, робота чи настільного проєкту на Linux.",
    price: 3890,
    oldPrice: null,
    image: "pi",
    stock: 7,
    tags: ["Raspberry Pi", "4 GB", "Linux"],
    featured: true,
  },
  {
    id: "dht22",
    name: "Датчик температури DHT22",
    category: "Датчики й модулі",
    description:
      "Цифровий датчик температури та вологості для метеостанцій, теплиць і систем розумного дому.",
    price: 145,
    oldPrice: null,
    image: "sensor",
    stock: 32,
    tags: ["Температура", "Вологість", "1-Wire"],
    featured: true,
  },
  {
    id: "oled-096",
    name: "OLED-дисплей 0.96″",
    category: "Датчики й модулі",
    description:
      "Монохромний екран 128×64 з інтерфейсом I²C. Чітко показує вимірювання та меню пристрою.",
    price: 185,
    oldPrice: null,
    image: "display",
    stock: 41,
    tags: ["OLED", "I²C", "128×64"],
    featured: true,
  },
  {
    id: "hc-sr04",
    name: "Ультразвуковий датчик HC-SR04",
    category: "Датчики й модулі",
    description:
      "Вимірює відстань від 2 см до 4 м. Стане у пригоді для роботів, паркувальних сенсорів та автоматизації.",
    price: 89,
    oldPrice: null,
    image: "ultrasonic",
    stock: 56,
    tags: ["Відстань", "5 V", "Echo"],
    featured: true,
  },
  {
    id: "rgb-strip",
    name: "Адресна RGB LED-стрічка · 1 м",
    category: "Освітлення",
    description:
      "Стрічка з керованими RGB-світлодіодами для підсвічування та світлових інсталяцій.",
    price: 320,
    oldPrice: null,
    image: "strip",
    stock: 14,
    tags: ["RGB", "WS2812B", "5 V"],
    featured: false,
  },
  {
    id: "usb-c-power",
    name: "Модуль живлення USB-C",
    category: "Живлення",
    description:
      "Зручний модуль для живлення прототипів із роз’ємом USB-C, захистом і виходами 5 V та 3,3 V.",
    price: 120,
    oldPrice: null,
    image: "power",
    stock: 29,
    tags: ["USB-C", "5 V", "3.3 V"],
    featured: false,
  },
  {
    id: "solder-kit",
    name: "Стартовий набір для паяння",
    category: "Інструменти",
    description:
      "Паяльник, підставка та витратні матеріали — усе необхідне для домашньої майстерні.",
    price: 790,
    oldPrice: null,
    image: "tool",
    stock: 10,
    tags: ["Паяння", "Для початківців"],
    featured: false,
  },
  {
    id: "jumper-wires",
    name: "Набір дротів Dupont",
    category: "Кабелі й роз’єми",
    description:
      "120 з’єднувальних дротів трьох типів для макетних плат і швидкого складання схем.",
    price: 110,
    oldPrice: null,
    image: "cable",
    stock: 64,
    tags: ["Dupont", "Jumper", "120 шт."],
    featured: false,
  },
  {
    id: "breadboard-kit",
    name: "Набір для прототипування",
    category: "Набори для проєктів",
    description:
      "Макетна плата, дроти й базові компоненти — зручний старт для перших електронних експериментів.",
    price: 430,
    oldPrice: null,
    image: "kit",
    stock: 16,
    tags: ["Макетна плата", "Для початківців"],
    featured: false,
  },
  {
    id: "pla-filament",
    name: "Філамент PLA · 1 кг",
    category: "3D-друк",
    description:
      "Універсальний PLA-пластик для корпусів, тримачів та інших деталей власного проєкту.",
    price: 540,
    oldPrice: null,
    image: "filament",
    stock: 21,
    tags: ["PLA", "1.75 мм", "1 кг"],
    featured: false,
  },
  {
    id: "resistor-pack",
    name: "Набір резисторів · 600 шт.",
    category: "Електронні компоненти",
    description:
      "Популярні номінали для створення прототипів і ремонту електронних схем.",
    price: 160,
    oldPrice: null,
    image: "components",
    stock: 38,
    tags: ["Резистори", "Набір", "600 шт."],
    featured: false,
  },
  {
    id: "esp32-cam",
    name: "ESP32-CAM",
    category: "Мікроконтролери",
    description:
      "Плата ESP32 із вбудованою камерою для відеоспостереження, розпізнавання об’єктів та IoT-пристроїв.",
    price: 420,
    oldPrice: null,
    image: "board",
    stock: 11,
    tags: ["ESP32", "Камера", "Wi-Fi"],
    featured: false,
  },
  {
    id: "esp32-oled",
    name: "Плата ESP32 з OLED-дисплеєм",
    category: "Мікроконтролери",
    description:
      "Компактна плата ESP32 із вбудованим OLED-екраном для автономних індикаторів і прототипів.",
    price: 620,
    oldPrice: null,
    image: "display",
    stock: 0,
    tags: ["ESP32", "OLED", "Wi-Fi"],
    featured: false,
  },
  {
    id: "esp32-relay",
    name: "Релейний модуль ESP32 · 2 канали",
    category: "Мікроконтролери",
    description:
      "Двоканальний Wi-Fi-контролер із реле для керування побутовими пристроями та автоматизацією.",
    price: 560,
    oldPrice: null,
    image: "power",
    stock: 8,
    tags: ["ESP32", "Реле", "Розумний дім"],
    featured: false,
  },
];

// Локальні фото з карток виробників/продавців. Пояснення про репрезентативний характер показуємо в інтерфейсі.
export const productPhotos = {
  "esp32-devkit": ["assets/images/esp32-devkit.jpg"],
  "arduino-uno": [
    "assets/images/arduino-uno-front.jpg",
    "assets/images/arduino-uno-back.jpg",
  ],
  "raspberry-pi-5": ["assets/images/raspberry-pi-5.png"],
  dht22: ["assets/images/dht22.jpg"],
  "oled-096": ["assets/images/oled-096.jpg"],
  "hc-sr04": ["assets/images/hc-sr04.jpg"],
  "rgb-strip": ["assets/images/rgb-strip.jpg"],
  "usb-c-power": ["assets/images/usb-c-power.jpg"],
  "solder-kit": ["assets/images/solder-kit.jpg"],
  "jumper-wires": ["assets/images/jumper-wires.jpg"],
  "breadboard-kit": ["assets/images/breadboard-kit.jpg"],
  "pla-filament": ["assets/images/pla-filament.jpg"],
  "resistor-pack": ["assets/images/resistor-pack.png"],
  "esp32-cam": ["assets/images/ai-thinker-esp32-cam.jpg"],
  "esp32-oled": ["assets/images/esp32-oled.jpg"],
  "esp32-relay": ["assets/images/esp32-relay.jpg"],
};
// Catalog metadata.
const details = {
  "esp32-devkit": [
    "Generic",
    "Плати ESP32",
    "ESP32-WROOM-32",
    {
      Живлення: "5 V через USB",
      "Wi-Fi": "802.11 b/g/n",
      Bluetooth: "4.2",
      Частота: "240 МГц",
    },
  ],
  "arduino-uno": [
    "Arduino",
    "Плати Arduino",
    "ATmega328P",
    {
      Живлення: "5 V",
      "Пам’ять": "32 КБ",
      Частота: "16 МГц",
      Інтерфейс: "USB-B",
    },
  ],
  "raspberry-pi-5": [
    "Raspberry Pi",
    "Одноплатні комп’ютери",
    "Broadcom BCM2712",
    {
      "Пам’ять": "4 ГБ",
      "Wi-Fi": "802.11ac",
      Bluetooth: "5.0",
      USB: "2 × USB 3.0",
    },
  ],
  dht22: [
    "Aosong",
    "Датчики температури й вологості",
    "AM2302",
    {
      Живлення: "3,3–5 V",
      Температура: "−40…80 °C",
      Вологість: "0–100%",
      Інтерфейс: "Цифровий",
    },
  ],
  "oled-096": [
    "Generic",
    "OLED-дисплеї",
    "SSD1306",
    {
      Діагональ: "0.96″",
      "Роздільна здатність": "128 × 64",
      Інтерфейс: "I²C",
      Живлення: "3,3–5 V",
    },
  ],
  "hc-sr04": [
    "Generic",
    "Ультразвукові датчики",
    "HC-SR04",
    {
      Живлення: "5 V",
      Діапазон: "2–400 см",
      Кут: "15°",
      Інтерфейс: "Echo / Trig",
    },
  ],
  "rgb-strip": [
    "WS2812B",
    "Адресні LED-стрічки",
    "WS2812B",
    {
      Живлення: "5 V",
      Щільність: "60 світлодіодів/м",
      Колір: "RGB",
      Довжина: "1 м",
    },
  ],
  "usb-c-power": [
    "NEXLAB",
    "Модулі живлення",
    "Модуль живлення",
    { Вхід: "USB-C", Виходи: "5 V / 3,3 V", Захист: "Від короткого замикання" },
  ],
  "solder-kit": [
    "NEXLAB",
    "Обладнання для паяння",
    "Стартовий набір",
    {
      Потужність: "60 Вт",
      Регулювання: "200–450 °C",
      Комплектація: "Паяльник, підставка",
    },
  ],
  "jumper-wires": [
    "NEXLAB",
    "Монтажні дроти",
    "Dupont",
    {
      Кількість: "120 шт.",
      Тип: "тато–тато / мама–мама / тато–мама",
      Довжина: "20 см",
    },
  ],
  "breadboard-kit": [
    "NEXLAB",
    "Набори для прототипування",
    "Макетний набір",
    { Плата: "830 контактів", Дроти: "65 шт.", Живлення: "3,3 V / 5 V" },
  ],
  "pla-filament": [
    "NEXLAB",
    "Матеріали для 3D-друку",
    "PLA",
    { Діаметр: "1,75 мм", Вага: "1 кг", "Температура друку": "190–220 °C" },
  ],
  "resistor-pack": [
    "NEXLAB",
    "Резистори",
    "Набір номіналів",
    { Кількість: "600 шт.", Допуск: "±5%", Потужність: "0,25 Вт" },
  ],
  "esp32-cam": [
    "AI-Thinker",
    "Камери й IoT-плати",
    "ESP32-CAM",
    {
      Живлення: "5 V",
      "Wi-Fi": "802.11 b/g/n",
      Камера: "OV2640",
      Bluetooth: "4.2",
    },
  ],
  "esp32-oled": [
    "Generic",
    "Плати з дисплеями",
    "ESP32 + SSD1306",
    {
      Живлення: "5 V",
      "Wi-Fi": "802.11 b/g/n",
      Bluetooth: "4.2",
      Дисплей: "0.96″ OLED",
    },
  ],
  "esp32-relay": [
    "NEXLAB",
    "Релейні модулі",
    "ESP32",
    {
      Живлення: "5 V",
      "Кількість каналів": "2",
      "Wi-Fi": "802.11 b/g/n",
      Контакти: "10 A / 250 V",
    },
  ],
};

products.forEach((product, index) => {
  const [brand, subcategory, sku, specifications] = details[product.id];
  Object.assign(product, {
    brand,
    subcategory,
    sku,
    specifications,
    shortDescription: product.description.split(/[.!?]/)[0],
    images: productPhotos[product.id] || [],
    reviewsCount: 0,
    rating: 0,
    isNew: index > 9,
    discount: product.oldPrice
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0,
  });
});

export const categories = [
  { name: "Мікроконтролери", desc: "Плати Arduino та ESP", icon: "⌘" },
  {
    name: "Електронні компоненти",
    desc: "Резистори, мікросхеми й деталі",
    icon: "◉",
  },
  { name: "Датчики й модулі", desc: "Вимірюй і керуй", icon: "⌁" },
  { name: "Інструменти", desc: "Для складання й ремонту", icon: "⚒" },
  { name: "Живлення", desc: "Блоки та перетворювачі", icon: "ϟ" },
  { name: "Освітлення", desc: "Світлодіоди й стрічки", icon: "✳" },
  { name: "Комп’ютери", desc: "Одноплатні комп’ютери", icon: "▣" },
  { name: "3D-друк", desc: "Пластик і приладдя", icon: "⌬" },
  { name: "Кабелі й роз’єми", desc: "Надійні з’єднання", icon: "⌁" },
  {
    name: "Набори для проєктів",
    desc: "Усе необхідне в одній коробці",
    icon: "◈",
  },
];

export const projects = [
  {
    id: "weather-station",
    name: "Розумна метеостанція",
    description:
      "Вимірюй температуру й вологість у кімнаті та виводь показники на компактний екран.",
    difficulty: "Середній",
    estimatedPrice: 1200,
    image: "sensor",
    components: [
      { productId: "esp32-devkit", quantity: 1 },
      { productId: "dht22", quantity: 1 },
      { productId: "oled-096", quantity: 1 },
      { productId: "jumper-wires", quantity: 1 },
    ],
  },
  {
    id: "arduino-robot",
    name: "Робот на Arduino",
    description: "Збери мобільного робота й навчи його оминати перешкоди.",
    difficulty: "Середній",
    estimatedPrice: 1850,
    image: "kit",
    components: [
      { productId: "arduino-uno", quantity: 1 },
      { productId: "hc-sr04", quantity: 1 },
      { productId: "breadboard-kit", quantity: 1 },
      { productId: "usb-c-power", quantity: 1 },
    ],
  },
  {
    id: "smart-lamp",
    name: "Розумна лампа",
    description:
      "Керуй адресним підсвічуванням через Wi-Fi та налаштовуй власні світлові сценарії.",
    difficulty: "Легкий",
    estimatedPrice: 980,
    image: "strip",
    components: [
      { productId: "esp32-devkit", quantity: 1 },
      { productId: "rgb-strip", quantity: 1 },
      { productId: "usb-c-power", quantity: 1 },
    ],
  },
  {
    id: "smart-home",
    name: "Контролер розумного дому",
    description: "Почни автоматизацію з керування реле та показників сенсорів.",
    difficulty: "Просунутий",
    estimatedPrice: 1640,
    image: "power",
    components: [
      { productId: "esp32-relay", quantity: 1 },
      { productId: "dht22", quantity: 1 },
      { productId: "jumper-wires", quantity: 1 },
    ],
  },
  {
    id: "mini-weather",
    name: "Міні метеостанція",
    description: "Компактний екран показує поточну температуру й вологість.",
    difficulty: "Легкий",
    estimatedPrice: 760,
    image: "display",
    components: [
      { productId: "esp32-oled", quantity: 1 },
      { productId: "dht22", quantity: 1 },
    ],
  },
  {
    id: "iot-controller",
    name: "Універсальний IoT-контролер",
    description:
      "Збери універсальний пульт для своїх пристроїв і сценаріїв автоматизації.",
    difficulty: "Середній",
    estimatedPrice: 1420,
    image: "board",
    components: [
      { productId: "esp32-devkit", quantity: 1 },
      { productId: "oled-096", quantity: 1 },
      { productId: "breadboard-kit", quantity: 1 },
    ],
  },
].map((project) => ({
  ...project,
  parts: project.components
    .map(
      (item) => products.find((product) => product.id === item.productId)?.name,
    )
    .join(" + "),
  count: project.components.reduce((sum, item) => sum + item.quantity, 0),
  estimatedPrice: project.components.reduce(
    (sum, item) =>
      sum +
      (products.find((p) => p.id === item.productId)?.price || 0) *
        item.quantity,
    0,
  ),
  cost: project.components.reduce(
    (sum, item) =>
      sum +
      (products.find((p) => p.id === item.productId)?.price || 0) *
        item.quantity,
    0,
  ),
  desc: project.description,
}));

// Общая лаконичная иллюстрация помогает держать карточки цельными, пока не добавлены фото товаров.
export function productArt(product, large = false, view = 0) {
  const photo = product.images?.[view] || product.images?.[0];
  const safe = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  if (
    photo &&
    (/^assets\/images\/[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(photo) ||
      /^https:\/\//i.test(photo))
  )
    return `<div class="product-art product-photo"><span class="product-tag">${product.stock > 0 ? "Є В НАЯВНОСТІ" : "НЕМАЄ В НАЯВНОСТІ"}</span><span class="photo-source-label">Фото для ознайомлення</span><img src="${safe(photo)}" alt="${safe(product.name)} — фото для ознайомлення" loading="lazy" decoding="async"></div>`;
  const shapes = {
    board:
      '<rect x="66" y="38" width="128" height="94" rx="9" class="art-board"/><rect x="105" y="59" width="49" height="51" rx="4" class="art-chip"/><path d="M80 31v8m16-8v8m16-8v8m16-8v8m16-8v8m16-8v8m16-8v8M80 132v8m16-8v8m16-8v8m16-8v8m16-8v8m16-8v8m16-8v8" class="art-line"/><circle cx="85" cy="54" r="4" class="art-light"/><path d="M72 77h28m60 20h39m-139 3h25" class="art-line"/>',
    arduino:
      '<rect x="57" y="43" width="145" height="87" rx="9" class="art-board"/><rect x="105" y="67" width="55" height="36" rx="4" class="art-chip"/><rect x="65" y="64" width="23" height="43" rx="3" class="art-metal"/><path d="M99 39v8m18-8v8m18-8v8m18-8v8m18-8v8M99 130v8m18-8v8m18-8v8m18-8v8m18-8v8" class="art-line"/>',
    pi: '<rect x="61" y="39" width="138" height="100" rx="8" class="art-board"/><rect x="102" y="64" width="48" height="47" rx="5" class="art-chip"/><rect x="72" y="51" width="18" height="13" class="art-metal"/><rect x="170" y="50" width="18" height="14" class="art-metal"/><path d="M74 119h14m84 0h17" class="art-line"/><circle cx="174" cy="91" r="6" class="art-light"/>',
    sensor:
      '<rect x="81" y="43" width="101" height="93" rx="8" class="art-board"/><rect x="103" y="64" width="57" height="47" rx="5" class="art-chip"/><path d="M96 43v-9m18 9v-9m18 9v-9m18 9v-9m18 9v-9M96 136v9m18-9v9m18-9v9m18-9v9m18-9v9" class="art-line"/><circle cx="131" cy="87" r="9" class="art-accent"/>',
    display:
      '<rect x="73" y="39" width="116" height="101" rx="10" class="art-metal"/><rect x="83" y="49" width="96" height="81" rx="5" fill="#23352d"/><path d="M96 65h30v10H96zm42 0h24v10h-24zm-42 20h18v10H96zm28 0h38v10h-38zm-28 20h34v10H96z" fill="#b9d08e"/>',
    ultrasonic:
      '<rect x="60" y="67" width="142" height="55" rx="7" class="art-board"/><circle cx="94" cy="94" r="20" class="art-metal"/><circle cx="94" cy="94" r="13" fill="#515b50"/><circle cx="168" cy="94" r="20" class="art-metal"/><circle cx="168" cy="94" r="13" fill="#515b50"/><path d="M77 66v-12m18 12v-12m18 12v-12m18 12v-12m18 12v-12m18 12v-12" class="art-line"/>',
    strip:
      '<path d="M55 78c30-39 61 39 91 0s61 39 91 0" stroke="#bb7caa" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M55 78c30-39 61 39 91 0s61 39 91 0" stroke="#8be4d0" stroke-width="2" fill="none" stroke-dasharray="3 15"/><circle cx="68" cy="69" r="5" fill="#a5d1e0"/><circle cx="113" cy="91" r="5" fill="#c1dfa0"/><circle cx="160" cy="78" r="5" fill="#e4a5a5"/><circle cx="206" cy="89" r="5" fill="#c9b4e6"/>',
    power:
      '<rect x="69" y="45" width="133" height="88" rx="9" class="art-board"/><rect x="80" y="69" width="31" height="29" rx="4" class="art-metal"/><rect x="143" y="64" width="42" height="40" rx="4" class="art-chip"/><rect x="115" y="54" width="16" height="69" rx="3" class="art-metal"/><path d="M79 112h24m83 5h-17" class="art-line"/>',
    tool: '<path d="M97 47a33 33 0 0 0 42 43l44 43-20 19-44-45a33 33 0 0 1-42-42l20 20 18-18z" class="art-metal"/><path d="m148 110 15-15" stroke="#57cdb3" stroke-width="8"/>',
    cable:
      '<path d="M62 99c0-57 138-57 138 0s-138 57-138 0Z" stroke="#57cdb3" stroke-width="13" fill="none"/><path d="M61 98h-15V78m154 21h18v21" class="art-line"/><rect x="39" y="69" width="14" height="18" rx="3" class="art-metal"/><rect x="212" y="111" width="14" height="18" rx="3" class="art-metal"/>',
    kit: '<rect x="60" y="49" width="146" height="85" rx="8" class="art-board"/><path d="M73 62h119v59H73z" fill="#9dcabc"/><path d="M87 65v53m18-53v53m18-53v53m18-53v53m18-53v53m18-53v53M76 77h113m-113 18h113m-113 18h113" stroke="#708673" stroke-width="1"/><rect x="126" y="79" width="25" height="19" rx="3" class="art-chip"/>',
    filament:
      '<circle cx="130" cy="89" r="56" fill="none" stroke="#57cdb3" stroke-width="12"/><circle cx="130" cy="89" r="38" fill="none" stroke="#8be4d0" stroke-width="4"/><path d="M77 48c31-22 76-21 105 2m-95 83c31 22 70 20 96-1" stroke="#b8eadd" stroke-width="3" fill="none"/>',
    components:
      '<rect x="68" y="50" width="125" height="78" rx="8" class="art-board"/><path d="M86 70v38m17-38v38m17-38v38m17-38v38m17-38v38m17-38v38" stroke="#78cbb0" stroke-width="7"/><path d="M82 64h100m-100 50h100" class="art-line"/>',
  };
  const transform = large
    ? `transform="scale(${1.13 - view * 0.06}) rotate(${view * 3}deg)"`
    : "";
  return `<div class="product-art" style="--art-glow:${product.image === "strip" ? "#493544" : "#465846"}"><span class="product-tag">${product.stock === 0 ? "НЕМАЄ В НАЯВНОСТІ" : "Є В НАЯВНОСТІ"}</span><svg viewBox="0 0 260 180" fill="none" aria-hidden="true" ${transform}>${shapes[product.image] || shapes.board}</svg><span class="illustration-note">Ілюстрація · фото готується</span></div>`;
}
