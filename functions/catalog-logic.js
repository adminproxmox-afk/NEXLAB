const imageTypes = new Set([
  "board", "arduino", "pi", "sensor", "display", "ultrasonic", "strip", "power",
  "tool", "cable", "kit", "filament", "components", "esp8266", "nano", "bme280",
  "pir", "probe", "soil", "servo", "motor-driver", "relay4", "level-shifter",
  "sd-module", "buzzer",
]);
const categories = new Set([
  "Мікроконтролери", "Електронні компоненти", "Датчики й модулі", "Інструменти", "Живлення",
  "Освітлення", "Комп’ютери", "3D-друк", "Кабелі й роз’єми", "Набори для проєктів", "Дисплеї",
  "Бездротовий зв’язок", "Мотори й робототехніка", "Акумулятори й заряджання", "Вимірювальні прилади",
]);

const string = (value, max) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const validImage = (image) => {
  if (typeof image !== "string" || image.length > 2000) return false;
  if (/^assets\/images\/(?:[\w.-]+\/)*[\w.-]+\.(?:jpg|jpeg|png|webp)$/i.test(image)) return true;
  try { return new URL(image).protocol === "https:"; } catch { return false; }
};

export function normalizeCatalogImport(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 200)
    throw new Error("INVALID_CATALOG_IMPORT");
  const ids = new Set();
  return input.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)
      || !string(item.id, 64) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)
      || ids.has(item.id) || !string(item.name, 120)
      || !string(item.category, 100) || !categories.has(item.category.trim()) || !string(item.description, 3000)
      || !string(item.brand, 100) || !string(item.subcategory, 120)
      || !string(item.sku, 100) || !imageTypes.has(item.image)
      || !Number.isInteger(item.price) || item.price < 0 || item.price > 10_000_000
      || !(item.oldPrice === null || (Number.isInteger(item.oldPrice)
        && item.oldPrice > item.price && item.oldPrice <= 10_000_000))
      || !Number.isInteger(item.stock) || item.stock < 0 || item.stock > 100_000
      || typeof item.featured !== "boolean" || typeof item.isNew !== "boolean"
      || !Array.isArray(item.tags) || item.tags.length > 20
      || !item.tags.every((tag) => string(tag, 40))
      || !Array.isArray(item.images) || item.images.length > 8
      || !item.images.every(validImage)
      || !item.specifications || typeof item.specifications !== "object"
      || Array.isArray(item.specifications) || Object.keys(item.specifications).length > 30
      || !Object.entries(item.specifications).every(([key, value]) =>
        string(key, 80) && string(value, 200)))
      throw new Error("INVALID_CATALOG_PRODUCT");
    ids.add(item.id);
    return {
      id: item.id,
      name: item.name.trim(),
      category: item.category.trim(),
      description: item.description.trim(),
      shortDescription: item.description.trim().split(/[.!?]/)[0],
      brand: item.brand.trim(),
      subcategory: item.subcategory.trim(),
      sku: item.sku.trim(),
      image: item.image,
      price: item.price,
      oldPrice: item.oldPrice,
      stock: item.stock,
      tags: item.tags.map((tag) => tag.trim()),
      featured: item.featured,
      isNew: item.isNew,
      specifications: item.specifications,
      images: item.images.map((image) => image.trim()),
    };
  });
}
