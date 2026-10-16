import test from "node:test";
import assert from "node:assert/strict";
import { translateText } from "../frontend/js/i18n.js";

test("shared UI translations work in Ukrainian, Russian and English", () => {
  assert.equal(translateText("Каталог", "uk"), "Каталог");
  assert.equal(translateText("Каталог", "ru"), "Каталог");
  assert.equal(translateText("Каталог", "en"), "Catalog");
  assert.equal(translateText("Главная", "en"), "Home");
  assert.equal(translateText("Додати ESP32 DevKit V1 до кошика", "en"), "Add ESP32 DevKit V1 to cart");
  assert.equal(translateText("Знайдено 99 товарів", "en"), "99 products found");
  assert.equal(translateText("Мікроконтролери · GENERIC", "en"), "Microcontrollers · GENERIC");
  assert.equal(translateText("позицій доступно", "en"), "parts available");
  assert.equal(translateText("~2 год.", "en"), "~2 hr");
  assert.equal(translateText("DIY-проєкти", "ru"), "DIY-проекты");
});

test("translation leaves unsupported locales and unknown copy unchanged", () => {
  assert.equal(translateText("Нова фраза", "en"), "Нова фраза");
  assert.equal(translateText("Каталог", "fr"), "Каталог");
});

test("checkout and account feedback is localized, including dynamic values", () => {
  assert.equal(translateText("Введи коректну адресу електронної пошти.", "en"), "Enter a valid email address.");
  assert.equal(translateText("Кількість товарів змінилася. Перевір оновлене замовлення та підтвердь його ще раз.", "en"), "Item availability changed. Review the updated order and submit it again.");
  assert.equal(translateText("Додано 2 шт. — решта недоступна", "ru"), "Добавлено 2 шт. — остальное недоступно");
  assert.equal(translateText("Купон застосовано: знижка 10% (125 ₴).", "en"), "Coupon applied: 10% off (125 ₴).");
  assert.equal(translateText("Твій кошик поки порожній", "en"), "Your cart is empty for now");
  assert.equal(translateText("Вхід до облікового запису NEXLAB.", "ru"), "Вход в учётную запись NEXLAB.");
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
  assert.equal(translateText("Вимкни ESP32 та переконайся, що OLED має інтерфейс I²C і адресу 0x3C.", "en"), "Power off the ESP32 and confirm that the OLED uses I²C and address 0x3C.");
});
