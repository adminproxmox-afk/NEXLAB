const normalize = value => String(value || '').toLocaleLowerCase().normalize('NFKC').trim();

export function searchProducts(products, query) {
  const term = normalize(query);
  if (!term) return products;
  return products.filter(product => normalize([
    product.name, product.description, product.shortDescription, product.category,
    product.subcategory, product.brand, ...(product.tags || [])
  ].join(' ')).includes(term));
}
