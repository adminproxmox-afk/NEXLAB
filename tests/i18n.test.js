import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { formatProductCount, translateText } from "../frontend/js/i18n.js";
import { checkoutErrorMessage } from "../frontend/js/checkout.js";
import { projectGuides } from "../frontend/js/project-guides.js";
import { products } from "../frontend/js/products.js";
import { shopConfig } from "../frontend/js/shop-config.js";

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : path.endsWith(".html") ? [path] : [];
  });
}

test("shared UI translations work in Ukrainian and English", () => {
  assert.equal(translateText("Каталог", "uk"), "Каталог");
  assert.equal(translateText("Каталог", "en"), "Catalog");
  assert.equal(translateText("Перейти до основного вмісту", "en"), "Skip to main content");
  assert.equal(translateText("NEXLAB — головна сторінка", "en"), "NEXLAB — home page");
  assert.equal(translateText("Демо-код NEXLAB10 дає 10% знижки на товари від 1 000 ₴.", "en"), "Demo code NEXLAB10 takes 10% off items totaling at least UAH 1,000.");
  assert.equal(translateText("Ти вже залишав відгук про цей товар.", "en"), "You have already reviewed this product.");
  assert.equal(translateText("Ти вже оцінив цей проєкт.", "en"), "You have already rated this project.");
  assert.equal(translateText("Збірку видалено або посилання застаріло.", "en"), "This build was removed or its link has expired.");
  assert.equal(translateText("Імпортовано товарів: 2.", "en"), "Products imported: 2.");
  assert.equal(translateText("Не вдалося підтвердити результат. Імпорт атомарний: пакет оновлюється повністю або не змінюється. Онови список і перевір каталог.", "en"), "Could not confirm the result. The import is atomic: the full batch is applied or nothing changes. Refresh and check the catalog.");
  assert.equal(translateText("Завантажити ще проєкти", "en"), "Load more projects");
  assert.equal(translateText("У Firebase ще немає товарів: показуємо демонстраційний каталог.", "en"), "Firebase has no products yet; the demo catalog is shown.");
  assert.equal(translateText("Є в наявності · 24 шт.", "uk"), "Є в наявності · 24 шт.");
  assert.equal(translateText("Прогрес навчання: ESP32 DevKit V1", "uk"), "Прогрес навчання: ESP32 DevKit V1");
  assert.equal(translateText("3 із 8 завдань виконано", "en"), "3 of 8 tasks complete");
  assert.equal(translateText("Прогрес навчання: ESP32 DevKit V1", "en"), "Learning progress: ESP32 DevKit V1");
  assert.equal(translateText("Главная", "en"), "Home");
  assert.equal(translateText("Додати ESP32 DevKit V1 до кошика", "en"), "Add ESP32 DevKit V1 to cart");
  assert.equal(translateText("Додати Ультразвуковий датчик HC-SR04 до кошика", "en"), "Add HC-SR04 ultrasonic sensor to cart");
  assert.equal(translateText("Докладніше: Ультразвуковий датчик HC-SR04", "en"), "Details: HC-SR04 ultrasonic sensor");
  assert.equal(translateText("Знайдено 99 товарів", "en"), "99 products found");
  assert.equal(translateText("Мікроконтролери · GENERIC", "en"), "Microcontrollers · GENERIC");
  assert.equal(translateText("Мікроконтролери · Сумісна плата", "en"), "Microcontrollers · Compatible board");
  assert.equal(translateText("позицій доступно", "en"), "parts available");
  assert.equal(translateText("~2 год.", "en"), "~2 hr");
  assert.equal(translateText("Компоненти, інструменти й ідеї для електронних проєктів.", "en"), "Components, tools, and ideas for electronics projects.");
  assert.equal(translateText("Для навчального макета щодо повернення можна звернутися телефоном +380684467143. Місто відправлення — Вінниця; фактичну адресу повернення та порядок пересилання не визначено.", "en"), "For this demo, contact +380684467143 about returns. The dispatch city is Vinnytsia; no actual return address or shipping process has been set.");
  assert.equal(translateText("4 компонента у наборі", "en"), "4 components in the kit");
  assert.equal(translateText("Немає з’єднання", "en"), "You're offline");
});

test("language changes update the document language before reloading", async () => {
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const documentStub = { documentElement: { lang: "uk" } };
  let reloads = 0;
  globalThis.document = documentStub;
  globalThis.location = { reload() { reloads += 1; } };
  try {
    const { setLanguage } = await import(`../frontend/js/i18n.js?lang-test=${Date.now()}`);
    setLanguage("en");
    assert.equal(documentStub.documentElement.lang, "en");
    assert.equal(reloads, 1);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});

test("translation leaves unsupported locales and unknown copy unchanged", () => {
  assert.equal(translateText("Каталог", "ru"), "Каталог");
  assert.equal(translateText("Нова фраза", "en"), "Нова фраза");
  assert.equal(translateText("Каталог", "fr"), "Каталог");
});

test("checkout and account feedback is localized, including dynamic values", () => {
  assert.equal(translateText("Каталог товарів ще не синхронізований із базою замовлень. Адміністратору потрібно ініціалізувати каталог у Firebase; спробуй пізніше.", "en"), "The catalog is not synchronized with the order database yet. An administrator needs to initialize the Firebase catalog; please try again later.");
  assert.equal(translateText("Оформлення замовлень у Firebase ще не налаштовано: серверна функція не опублікована. Для локального демо запусти сайт командою npm start.", "en"), "Firebase checkout is not set up yet: the server function has not been deployed. For the local demo, start the site with npm start.");
  assert.equal(translateText("Введи коректну адресу електронної пошти.", "en"), "Enter a valid email address.");
  assert.equal(translateText("Кількість товарів змінилася. Перевір оновлене замовлення та підтвердь його ще раз.", "en"), "Item availability changed. Review the updated order and submit it again.");
  assert.equal(translateText("Сервер не підтвердив результат. Перевір замовлення в історії; якщо його там немає, повтори оформлення — запит не створить дублікат.", "en"), "The server did not confirm the result. Check your order history; if the order is not there, try checkout again—the request will not create a duplicate.");
  assert.equal(translateText("Купон застосовано: знижка 10% (125 ₴).", "en"), "Coupon applied: 10% off (125 ₴).");
  assert.equal(translateText("Твій кошик поки порожній", "en"), "Your cart is empty for now");
});

test("checkout explains when Firebase order functions are not deployed", () => {
  const missingFunction = "Оформлення замовлень у Firebase ще не налаштовано: серверна функція не опублікована. Для локального демо запусти сайт командою npm start.";
  const uncertainOrder = "Сервер не підтвердив результат. Перевір замовлення в історії; якщо його там немає, повтори оформлення — запит не створить дублікат.";
  assert.equal(checkoutErrorMessage({ code: "functions/not-found" }, true), missingFunction);
  assert.equal(checkoutErrorMessage({ code: "functions/not-found" }, false), "Не вдалося зберегти замовлення. Спробуй ще раз.");
  assert.equal(checkoutErrorMessage({ message: "BACKEND_UNAVAILABLE" }), uncertainOrder);
  assert.equal(checkoutErrorMessage({ status: 500 }), uncertainOrder);
  assert.equal(checkoutErrorMessage({ code: "functions/deadline-exceeded" }), uncertainOrder);
  assert.match(checkoutErrorMessage({ code: "permission-denied" }, true), /firebase\/firestore\.rules/);
});

test("footer community and demo newsletter copy is localized", () => {
  assert.equal(translateText("Оновлення майстерні", "en"), "Workshop updates");
  assert.equal(translateText("Демо-підписку перевірено: адресу не збережено й не надіслано.", "en"), "Demo signup checked: the address was not stored or sent.");
});

test("home, community, shipping, privacy, and build guides localize page copy", () => {
  assert.equal(translateText("Ідеї, які", "en"), "Ideas are");
  assert.equal(translateText("Від першого прототипу до готового пристрою", "en"), "From first prototype to finished device");
  assert.equal(translateText("Проєкти спільноти", "en"), "Community projects");
  assert.equal(translateText("Ідеї, які", "en"), "Ideas are");
  assert.equal(translateText("вже працюють.", "en"), "already working.");
  assert.equal(translateText("Контактні дані для навчального макета.", "en"), "Contact details for this educational demo.");
  assert.equal(translateText("Умови доставки наведені як навчальний приклад; сайт не приймає реальні замовлення.", "en"), "Shipping terms are an educational example; this site does not accept real orders.");
  assert.equal(translateText("Платіжний сервіс не підключений, дані банківських карток сайт не запитує. Не вводь номер картки, CVV, пароль чи код підтвердження. Хостинг може обробляти технічні дані запитів відповідно до власних правил; це залежить від платформи, на якій розміщено сайт.", "en"), "No payment service is connected, and the site does not request bank card details. Do not enter a card number, CVV, password, or verification code. The hosting provider may process technical request data under its own policies; this depends on the hosting platform.");
  assert.match(translateText("Онлайн-платіжний сервіс не підключений, сайт не запитує дані банківських карток. Для опублікованої версії використовуються GitHub Pages і налаштований у коді проєкт Firebase; Google/Firebase може обробляти дані, необхідні для увімкнених сервісів, за власними правилами. Не вводь номер картки, CVV, пароль чи код підтвердження.", "en"), /Google\/Firebase may process data/);
  assert.equal(translateText("Вимкни ESP32 та переконайся, що OLED має інтерфейс I²C і адресу 0x3C.", "en"), "Power off the ESP32 and confirm that the OLED uses I²C and address 0x3C.");
});

test("all project guide copy has English translations", () => {
  const untranslated = [];
  const cyrillic = /[А-Яа-яІіЇїЄєҐґ]/;
  const scan = (value, path) => {
    if (typeof value === "string" && cyrillic.test(value)) {
      for (const language of ["en"]) {
        if (translateText(value, language) === value) untranslated.push(`${language}: ${path}: ${value}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => scan(item, `${path}.${key}`));
    }
  };
  scan(projectGuides, "projectGuides");
  assert.deepEqual(untranslated, []);
  assert.equal(translateText("Схема з’єднань Arduino UNO R3", "en"), "Wiring diagram Arduino UNO R3");
  assert.equal(translateText("1 шт.", "en"), "1 pcs");
  assert.equal(translateText("Є в наявності · 18 шт.", "en"), "In stock · 18 pcs");
});

test("catalog product labels, descriptions, tags and specifications localize", () => {
  const untranslated = [];
  const cyrillic = /[А-Яа-яІіЇїЄєҐґ]/;
  for (const [index, product] of products.entries()) {
    for (const field of ["name", "category", "brand", "subcategory", "description"]) {
      const value = product[field];
      if (!value || !cyrillic.test(value)) continue;
      for (const language of ["en"]) {
        if (translateText(value, language) === value) {
          untranslated.push(`${language}: products[${index}].${field}: ${value}`);
        }
      }
    }
    const metadata = [
      ...product.tags.map((value, tagIndex) => [`tags[${tagIndex}]`, value]),
      ...Object.entries(product.specifications).flatMap(([key, value]) => [[`specifications.${key}`, key], [`specifications.${key}`, String(value)]]),
    ];
    for (const [field, value] of metadata) {
      if (cyrillic.test(value) && translateText(value, "en") === value) untranslated.push(`en: products[${index}].${field}: ${value}`);
    }
  }
  assert.deepEqual(untranslated, []);
  assert.equal(translateText("Артикул ESP32-WROOM-32", "en"), "SKU ESP32-WROOM-32");
  assert.equal(translateText("✓ Є в наявності · 24 шт.", "en"), "✓ In stock · 24 pcs");
  assert.equal(translateText("GENERIC · Плати ESP32", "en"), "GENERIC · ESP32 boards");
  assert.equal(translateText("ESP32 DevKit V1 — фото для ознайомлення", "en"), "ESP32 DevKit V1 — illustrative photo");
  assert.equal(translateText("Досвід спільноти", "en"), "Community feedback");
  assert.equal(translateText("Фото (необов’язково)", "en"), "Photo (optional)");
});

test("all static frontend HTML copy has English translations", () => {
  const untranslated = [];
  const cyrillic = /[А-Яа-яІіЇїЄєҐґ]/;
  for (const path of htmlFiles(resolve("frontend"))) {
    const html = readFileSync(path, "utf8").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
    const textNodes = [...html.matchAll(/>([^<>]+)</g)].map((match) => match[1]);
    const translatedAttributes = [...html.matchAll(/\b(?:aria-label|aria-description|placeholder|title|alt|content)="([^"]*)"/g)].map((match) => match[1]);
    for (const value of [...textNodes, ...translatedAttributes]) {
      const text = value
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
      if (cyrillic.test(text) && translateText(text, "en") === text) {
        untranslated.push(`${path}: ${text}`);
      }
    }
  }
  assert.deepEqual(untranslated, []);
});

test("admin workspace labels and dynamic order details localize", () => {
  assert.equal(translateText("Аналітика замовлень", "en"), "Order analytics");
  assert.equal(translateText("Журнал руху залишків", "en"), "Stock movement log");
  assert.equal(translateText("Імпорт JSON", "en"), "Import JSON");
  assert.equal(translateText("Заявка на повернення · очікує рішення", "en"), "Return request · awaiting a decision");
  assert.equal(translateText("Склад замовлення (4)", "en"), "Order items (4)");
  assert.equal(translateText("Вітаємо, Данііл. Тут можна стежити за замовленнями, каталогом і клієнтами.", "en"), "Welcome, Данііл. Track orders, the catalog, and customers here.");
});

test("commerce, community, offline, and learning states localize", () => {
  assert.equal(translateText("Фото, схеми, код і відгуки до DIY-збірок учасників NEXLAB.", "en"), "Photos, schematics, code, and reviews for NEXLAB community DIY builds.");
  assert.equal(translateText("Купон можна застосувати під час оформлення. Доставка оплачується окремо за тарифом перевізника.", "en"), "Apply coupons at checkout. Shipping is charged separately at the carrier's rate.");
  assert.equal(translateText("Ще немає оцінок. Стань першим, хто поділиться враженням.", "en"), "No ratings yet. Be the first to share your thoughts.");
  assert.equal(translateText("Немає з’єднання. Доступні лише збережені сторінки й локальний каталог.", "en"), "You're offline. Only cached pages and the local catalog are available.");
  assert.equal(translateText("Заявку на повернення надіслано", "en"), "Return request submitted");
  assert.equal(translateText("Номер відстеження: NP123456789", "en"), "Tracking number: NP123456789");
  assert.equal(translateText("Завантажуємо твою майстерню…", "en"), "Loading your workshop…");
  assert.equal(translateText("DIY · ПОКРОКОВІ ЗБІРКИ", "en"), "DIY · STEP-BY-STEP BUILDS");
  assert.equal(translateText("Проєкт збережено в твоїй майстерні.", "en"), "Project saved to your workshop.");
  assert.equal(translateText("Тимчасово немає в наявності", "en"), "Temporarily out of stock");
});

test("payment information and product illustrations localize", () => {
  assert.equal(translateText("Схематична ілюстрація", "en"), "Schematic illustration");
  const methods = shopConfig.paymentMethods.map((item) => item.name).join(", ");
  assert.equal(
    translateText(`Спосіб «${methods}» наведено у формі лише як демонстраційний приклад. Магазин не підтверджує його для реальних продажів.`, "en"),
    "Method “Cash on delivery” is listed in the form for demonstration only. The store does not support it for real sales.",
  );
  const amount = `${shopConfig.priceNote} Перед реальним замовленням магазин має показати повну суму, вартість доставки й можливі комісії до підтвердження покупки.`;
  assert.equal(
    translateText("Платіжний сервіс не підключений. Не надсилай номер картки, CVV, паролі чи коди підтвердження через цей сайт або контакти магазину.", "en"),
    "No payment service is connected. Do not send card numbers, CVVs, passwords, or verification codes through this site or store contacts.",
  );
});

test("product result counts use the correct plural form in Ukrainian and English", () => {
  assert.equal(formatProductCount(1, "uk"), "Знайдено 1 товар");
  assert.equal(formatProductCount(2, "uk"), "Знайдено 2 товари");
  assert.equal(formatProductCount(5, "uk"), "Знайдено 5 товарів");
  assert.equal(formatProductCount(1, "en"), "1 product found");
  assert.equal(formatProductCount(2, "en"), "2 products found");
});

test("photo upload guidance, validation, and privacy copy are localized", () => {
  assert.equal(translateText("Фото з пристрою", "en"), "Upload a photo");
  assert.equal(translateText("Підтримуються справжні фото JPG, PNG або WebP.", "en"), "Use a valid JPG, PNG, or WebP image.");
  assert.notEqual(translateText("Якщо запущений сервер і створюється тестовий обліковий запис, сайт отримує ім’я, адресу електронної пошти та пароль. Пароль зберігається у вигляді криптографічного хешу. Під час входу використовується сесійний cookie. У демонстраційному оформленні замовлення форма також містить ім’я отримувача, телефон, місто, адресу доставки, перевізника, спосіб оплати та дані товарів у замовленні. Для відгуків можуть зберігатися оцінка, текст і фото; для збірок спільноти — опис, фото та посилання на схему й код; для збережених проєктів — їхні ідентифікатори.", "en"), "Якщо запущений сервер і створюється тестовий обліковий запис, сайт отримує ім’я, адресу електронної пошти та пароль. Пароль зберігається у вигляді криптографічного хешу. Під час входу використовується сесійний cookie. У демонстраційному оформленні замовлення форма також містить ім’я отримувача, телефон, місто, адресу доставки, перевізника, спосіб оплати та дані товарів у замовленні. Для відгуків можуть зберігатися оцінка, текст і фото; для збірок спільноти — опис, фото та посилання на схему й код; для збережених проєктів — їхні ідентифікатори.");
});

test("restock subscription and availability feedback is localized", () => {
  assert.equal(translateText("Стежимо за наявністю", "en"), "Watching availability");
  assert.equal(translateText("Повідомимо в цьому акаунті, коли товар з’явиться.", "en"), "We’ll notify you in this account when the item is back.");
  assert.equal(translateText("Повідомлення на пристрої", "en"), "Device notifications");
  assert.equal(translateText("Сповіщення працюватимуть, поки сайт відкрито в браузері.", "en"), "Notifications work while the site is open in your browser.");
});
