export function ratingMarkup(product) {
  if(!product.reviewsCount)return '<span class="no-rating">Ще немає відгуків</span>';
  const stars=Math.max(0,Math.min(5,Math.round(product.rating)));
  const noun={one:'відгук',few:'відгуки',many:'відгуків',other:'відгуку'}[new Intl.PluralRules('uk-UA').select(product.reviewsCount)];
  return '<span aria-hidden="true">'+'★'.repeat(stars)+'☆'.repeat(5-stars)+'</span> <span>'+product.rating.toLocaleString('uk-UA')+' · '+product.reviewsCount+' '+noun+'</span>';
}
