import { currentLanguage, translateText } from "./i18n.js";

const normalize = (value) =>
  String(value || "")
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
const localizedCache = new Map();

function localized(value, language) {
  const source = String(value);
  if (language === "uk") return source;
  const key = `${language}\0${source}`;
  if (localizedCache.has(key)) return localizedCache.get(key);
  const result = translateText(source, language);
  if (localizedCache.size >= 5_000)
    localizedCache.delete(localizedCache.keys().next().value);
  localizedCache.set(key, result);
  return result;
}

export function matchesSearch(query, values, language = currentLanguage()) {
  const term = normalize(query);
  if (!term) return true;
  return (values || [])
    .filter((value) => value !== undefined && value !== null)
    .some((value) =>
      [value, localized(value, language)].some((candidate) =>
        normalize(candidate).includes(term),
      ),
    );
}

export function searchProducts(products, query, language = currentLanguage()) {
  if (!normalize(query)) return products;
  return products.filter((product) =>
    matchesSearch(query, [
      product.name,
      product.description,
      product.shortDescription,
      product.id,
      product.category,
      product.subcategory,
      product.brand,
      ...(product.tags || []),
    ], language),
  );
}
