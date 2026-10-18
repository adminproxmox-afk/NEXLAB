import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../frontend");
function htmlFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : path.endsWith(".html")
        ? [path]
        : [];
  });
}

test("HTML pages do not link to missing local pages or assets", async () => {
  const broken = [];
  for (const source of htmlFiles()) {
    const html = await readFile(source, "utf8");
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
      const value = match[2].trim();
      if (!value || /^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
      const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      if (!path) continue;
      const target = resolve(dirname(source), path);
      if (!target.startsWith(root + sep) && target !== root) {
        broken.push(`${source}: link escapes the frontend: ${value}`);
      } else if (!existsSync(target)) {
        broken.push(`${source}: missing ${value}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test("DIY project cards have a section heading in the page hierarchy", async () => {
  const html = await readFile(join(root, "projects.html"), "utf8");
  assert.match(html, /<h1\b/);
  assert.match(html, /<section[^>]*data-projects-directory[^>]*>[\s\S]*?<h2\b/);
});

test("every HTML page declares a language and a main landmark with a focusable skip link", async () => {
  for (const source of htmlFiles()) {
    const html = await readFile(source, "utf8");
    assert.match(html, /<html\b[^>]*\blang="[a-z]{2}"/i, source);
    assert.match(html, /<main\b/i, source);
  }
  const [ui, styles] = await Promise.all([
    readFile(join(root, "js", "ui.js"), "utf8"),
    readFile(join(root, "css", "experience.css"), "utf8"),
  ]);
  assert.match(ui, /class="skip-link" href="#main-content"/);
  assert.match(styles, /\.skip-link:focus\s*\{/);
  assert.match(styles, /:focus-visible\s*\{/);
});

test("admin navigation hides links for sections the current role cannot access", async () => {
  const [css, admin] = await Promise.all([
    readFile(join(root, "css/fixes.css"), "utf8"),
    readFile(join(root, "js/admin.js"), "utf8"),
  ]);
  assert.match(css, /\.admin-section-nav\s+a\[hidden\]\s*\{\s*display:\s*none\s*;?\s*\}/);
  assert.match(admin, /href="#admin-orders-section" aria-controls="admin-orders-section"/);
  assert.match(admin, /heading\.focus\(\{ preventScroll: true \}\)/);
  assert.match(admin, /addEventListener\("hashchange", \(\) => activateAdminSection\(\{ focusHeading: true \}\)\)/);
});

test("compact navigation follows the CSS-controlled menu toggle", async () => {
  const ui = await readFile(join(root, "js", "ui.js"), "utf8");
  assert.match(ui, /const isCompactHeader = \(\) =>\s*toggle && getComputedStyle\(toggle\)\.display !== "none"/);
  assert.doesNotMatch(ui, /matchMedia\("\(max-width:/);
});

test("account menu reports its expanded state and restores focus on Escape", async () => {
  const ui = await readFile(join(root, "js", "ui.js"), "utf8");
  assert.match(ui, /data-account-toggle aria-expanded="false" aria-controls="header-account-menu"/);
  assert.match(ui, /id="header-account-menu" data-account-dropdown hidden/);
  assert.match(ui, /accountToggle\?\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(ui, /if \(returnFocus\) accountToggle\?\.focus\(\)/);
  assert.match(ui, /closeAccountMenu\(true\)/);
  assert.match(ui, /if \(!event\.target\.closest\("\.account-control"\)\)\s*\{\s*closeAccountMenu\(\);/);
});

test("header search keeps its combobox and listbox ARIA target connected", async () => {
  const ui = await readFile(join(root, "js", "ui.js"), "utf8");
  const styles = await readFile(join(root, "css", "header.css"), "utf8");
  assert.match(ui, /class="header-search-submit" type="submit"[^>]*aria-label="Шукати товар"/);
  assert.match(ui, /event\.target\.closest\("\[data-header-search-submit\]"\)[\s\S]*searchInput\.focus\(\)/);
  assert.match(styles, /\.header-search-submit:focus-visible\s*\{/);
  assert.match(ui, /role="combobox"[^>]*aria-controls="header-search-listbox"/);
  assert.match(ui, /id="header-search-listbox" role="listbox"/);
  assert.match(ui, /const searchListbox = searchResults\?\.querySelector\("#header-search-listbox"\)/);
  assert.match(ui, /searchListbox\.innerHTML = ""/);
  assert.match(ui, /searchInput\.setAttribute\("aria-expanded", "true"\)/);
});

test("restock alerts refresh stock and update an already open product page", async () => {
  const [notifications, productPage] = await Promise.all([
    readFile(join(root, "js", "stock-alert-notifications.js"), "utf8"),
    readFile(join(root, "js", "product-page.js"), "utf8"),
  ]);
  assert.match(notifications, /const products = await getProducts\(\);\s*const alerts = await consumeAvailableStockAlerts\(products\)/);
  assert.match(notifications, /nexlab:stock-restocked/);
  assert.match(productPage, /addEventListener\("nexlab:stock-restocked"/);
  assert.match(productPage, /removeAttribute\("disabled"\)/);
  assert.match(productPage, /querySelector\("\[data-stock-alert\]"\)\?\.remove\(\)/);
});

test("order and restock checks continue in the background only after notification opt-in", async () => {
  const [orders, stock] = await Promise.all([
    readFile(join(root, "js", "order-notifications.js"), "utf8"),
    readFile(join(root, "js", "stock-alert-notifications.js"), "utf8"),
  ]);
  assert.match(orders, /document\.hidden && !desktopNotificationsEnabled\(uid\)/);
  assert.match(stock, /document\.hidden && !desktopNotificationsEnabled\(uid\)/);
});

test("mobile commerce controls keep usable touch targets", async () => {
  const [theme, product, style] = await Promise.all([
    readFile(join(root, "css", "theme.css"), "utf8"),
    readFile(join(root, "css", "product.css"), "utf8"),
    readFile(join(root, "css", "style.css"), "utf8"),
  ]);
  assert.match(theme, /\.tool-link\s*\{[^}]*min-width:\s*24px[^}]*height:\s*32px/s);
  assert.match(product, /\.remove-button\s*\{[^}]*min-height:\s*32px/s);
  assert.match(style, /\.breadcrumbs a\s*\{[^}]*min-height:\s*24px/s);
});

test("product quantity changes are announced to screen readers", async () => {
  const productPage = await readFile(join(root, "js", "product-page.js"), "utf8");
  assert.match(productPage, /<span data-detail-quantity-value aria-live="polite" aria-atomic="true">1<\/span>/);
  assert.match(productPage, /root\.querySelector\("\[data-detail-quantity-value\]"\)\.textContent = quantity/);
});

test("mobile product gallery cannot cover product information while scrolling", async () => {
  const productStyles = await readFile(join(root, "css", "product.css"), "utf8");
  assert.match(productStyles, /\.detail-gallery\s*\{\s*position:\s*sticky;\s*top:\s*100px;/);
  assert.match(productStyles, /@media \(max-width: 700px\)\s*\{\s*\.product-detail\s*\{\s*display:\s*block;\s*\}\s*\.detail-gallery\s*\{\s*position:\s*relative;\s*top:\s*auto;\s*\}\s*\}/);
});

test("Firebase setup diagnostics are shown to admins, not public shoppers", async () => {
  const main = await readFile(join(root, "js", "main.js"), "utf8");
  assert.match(main, /if \(dataWarnings\.length && document\.querySelector\("\[data-admin-content\]"\)\)/);
});

test("public pages share the NEXLAB card and private pages stay out of search results", async () => {
  const privatePages = new Set([
    "admin/index.html", "cart.html", "checkout.html", "compare.html",
    "favorites.html", "login.html", "my-projects.html", "offline.html",
    "orders.html", "profile.html", "register.html",
  ]);
  const expectedCard = "https://adminproxmox-afk.github.io/NEXLAB/assets/images/nexlab-social-card.png";
  for (const source of htmlFiles()) {
    const page = relative(root, source).split(sep).join("/");
    const html = await readFile(source, "utf8");
    if (privatePages.has(page)) {
      assert.match(html, /<meta\s+name="robots"\s+content="noindex,follow"\s*\/>/, page);
      continue;
    }
    const imageTag = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    assert.ok(imageTag, `${page}: missing social image`);
    assert.equal(imageTag[1], expectedCard, page);
  }
  const image = await readFile(join(root, "assets", "images", "nexlab-social-card.png"));
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});

test("GitHub Pages sitemap contains only existing public pages", async () => {
  const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locations.length > 0);
  for (const location of locations) {
    const url = new URL(location);
    assert.equal(url.origin, "https://adminproxmox-afk.github.io");
    assert.ok(url.pathname.startsWith("/NEXLAB/"), location);
    assert.equal(url.search, "", location);
    const path = url.pathname.slice("/NEXLAB/".length) || "index.html";
    assert.ok(existsSync(join(root, path)), location);
    assert.doesNotMatch(path, /^(?:admin\/|cart\.html|checkout\.html|compare\.html|favorites\.html|login\.html|my-projects\.html|orders\.html|profile\.html|register\.html)/, location);
  }
});
