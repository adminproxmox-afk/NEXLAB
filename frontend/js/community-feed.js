export const communityIdeas = [
  {
    id: "plant-moisture",
    title: "Індикатор вологості ґрунту",
    summary: "Додай світловий сигнал, коли рослину час полити.",
    components: ["ESP32 DevKit", "датчик вологості ґрунту", "світлодіод"],
    difficulty: "Легкий",
    href: "project.html?id=soil-moisture-indicator",
  },
  {
    id: "motion-light",
    title: "Світло з датчиком руху",
    summary: "Увімкни підсвічування на кілька секунд після виявлення руху.",
    components: ["ESP32 DevKit", "PIR-датчик", "світлодіодна стрічка"],
    difficulty: "Середній",
    href: "project.html?id=smart-lamp",
  },
  {
    id: "room-climate",
    title: "Екран кімнатного клімату",
    summary: "Вимірюй температуру й вологість та показуй їх на дисплеї.",
    components: ["ESP32 DevKit", "DHT22", "OLED-дисплей"],
    difficulty: "Середній",
    href: "project.html?id=weather-station",
  },
];

export function collectCommunityQuestions(projects = []) {
  return projects.flatMap((project) =>
    (Array.isArray(project.questions) ? project.questions : []).map((question) => ({
      id: `${project.id}:${question.id}`,
      projectId: project.id,
      projectTitle: project.title || project.name || "",
      userName: question.userName || question.authorName || "",
      text: question.text || "",
      date: question.date,
      answer: question.answer || "",
      answeredBy: question.answeredBy || "",
      answeredAt: question.answeredAt,
      _sortDate: Date.parse(question.date),
    })),
  ).map(({ _sortDate, ...question }) => ({ question, sortDate: _sortDate }))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.sortDate);
      const bValid = Number.isFinite(b.sortDate);
      if (aValid && bValid) return b.sortDate - a.sortDate;
      return Number(bValid) - Number(aValid);
    })
    .map(({ question }) => question);
}

export function buildCommunityOffers({ products = [], projects = [], coupon } = {}) {
  const offers = [];
  for (const product of products) {
    if (Number.isFinite(product.price) && Number.isFinite(product.oldPrice) && product.oldPrice > product.price) {
      offers.push({
        id: `product:${product.id}`,
        kind: "product",
        title: product.name,
        href: `product.html?id=${encodeURIComponent(product.id)}`,
        price: product.price,
        oldPrice: product.oldPrice,
      });
    }
  }
  for (const project of projects) {
    if (Number.isInteger(project.bundleDiscountPercent) && project.bundleDiscountPercent > 0) {
      const offer = {
        id: `kit:${project.id}`,
        kind: "kit",
        title: project.name || project.title || "",
        href: `project.html?id=${encodeURIComponent(project.id)}`,
        percent: project.bundleDiscountPercent,
        projectId: project.id,
      };
      const productById = new Map(products.map((product) => [product.id, product]));
      const kitSubtotal = Array.isArray(project.components) && project.components.length
        ? project.components.reduce((total, component) => {
            const product = productById.get(component.productId);
            return total + (product && Number.isFinite(product.price) && Number.isFinite(component.quantity)
              ? product.price * component.quantity
              : 0);
          }, 0)
        : project.estimatedPrice;
      if (Number.isFinite(kitSubtotal) && kitSubtotal > 0) {
        offer.oldPrice = kitSubtotal;
        offer.price = kitSubtotal - Math.floor(kitSubtotal * project.bundleDiscountPercent / 100);
      }
      offers.push(offer);
    }
  }
  if (coupon && String(coupon.code || "").trim().toUpperCase() === "NEXLAB10"
    && coupon.active !== false && Number.isFinite(coupon.percent) && coupon.percent > 0
    && Number.isFinite(coupon.minTotal) && coupon.minTotal >= 0) {
    offers.push({
      id: "coupon:NEXLAB10",
      kind: "coupon",
      title: "Промокод NEXLAB10",
      href: "catalog.html?tag=sale",
      percent: coupon.percent,
      minTotal: coupon.minTotal,
      code: "NEXLAB10",
    });
  }
  return offers;
}
