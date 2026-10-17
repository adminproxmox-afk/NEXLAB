import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { products as catalog, categories, projects } from "../../frontend/js/products.js";
import { getProjectSteps } from "../../frontend/js/project-guides.js";
import { shopConfig } from "../../frontend/js/shop-config.js";

const scrypt = promisify(scryptCallback);
const root = resolve(fileURLToPath(new URL("../../frontend/", import.meta.url)));
const catalogImagesById = new Map(catalog.map((product) => [product.id, product.images || []]));
const SESSION_AGE = 7 * 86400;
const productImages = new Set([
  "board",
  "arduino",
  "pi",
  "sensor",
  "display",
  "ultrasonic",
  "strip",
  "power",
  "tool",
  "cable",
  "kit",
  "filament",
  "components",
  "esp8266",
  "nano",
  "bme280",
  "pir",
  "probe",
  "soil",
  "servo",
  "motor-driver",
  "relay4",
  "level-shifter",
  "sd-module",
  "buzzer",
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");
function normalizeCatalogImages(productId, images) {
  const canonicalImages = catalogImagesById.get(productId) || [];
  if (!Array.isArray(images)) return [];
  return images.map((image) => {
    const legacyRootPath = typeof image === "string"
      ? image.match(/^assets\/images\/([^/]+)$/)
      : null;
    if (!legacyRootPath) return image;
    return canonicalImages.find((path) => path.endsWith(`/${legacyRootPath[1]}`)) || image;
  });
}
const publicUser = (user) =>
  user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      }
    : null;
function fail(code, status = 400) {
  const error = new Error(code);
  error.status = status;
  throw error;
}
function text(value, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    fail("INVALID_INPUT");
  return value.trim();
}
function safeImageUrl(value, code) {
  if (typeof value !== "string") fail(code);
  if (value.length <= 2000) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:") return parsed.href;
    } catch {}
  }
  const prefix = "data:image/webp;base64,";
  if (!value.startsWith(prefix) || value.length > 320_000) fail(code);
  const encoded = value.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail(code);
  const bytes = Buffer.from(encoded, "base64");
  if (
    bytes.toString("base64") !== encoded ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) fail(code);
  return value;
}
function email(value) {
  const result = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail("INVALID_EMAIL");
  return result;
}
function password(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128)
    fail("PASSWORD_TOO_SHORT");
  return value;
}
function productInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INVALID_PRODUCT");
  const id = text(input.id, 64).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail("INVALID_PRODUCT");
  const result = {
    id,
    name: text(input.name, 120),
    category: text(input.category, 100),
    description: text(input.description, 3000),
    brand: text(input.brand, 100),
    subcategory: text(input.subcategory, 120),
    sku: text(input.sku, 100),
    image: text(input.image, 30),
    price: input.price,
    oldPrice: input.oldPrice,
    stock: input.stock,
    tags: input.tags,
    featured: input.featured,
    isNew: input.isNew,
    specifications: input.specifications,
    images: input.images,
  };
  if (
    !categories.some((item) => item.name === result.category) ||
    !productImages.has(result.image) ||
    !Number.isInteger(result.price) ||
    result.price < 0 ||
    result.price > 10000000 ||
    !Number.isInteger(result.stock) ||
    result.stock < 0 ||
    result.stock > 100000 ||
    (result.oldPrice !== null &&
      (!Number.isInteger(result.oldPrice) ||
        result.oldPrice <= result.price ||
        result.oldPrice > 10000000)) ||
    typeof result.featured !== "boolean" ||
    typeof result.isNew !== "boolean" ||
    !Array.isArray(result.tags) ||
    result.tags.length > 20 ||
    !result.tags.every(
      (tag) => typeof tag === "string" && tag.trim() && tag.trim().length <= 40,
    ) ||
    !Array.isArray(result.images) ||
    result.images.length > 8 ||
    !result.images.every(
      (image) =>
        typeof image === "string" &&
        (image.startsWith("assets/images/")
          ? /^assets\/images\/(?:[\w.-]+\/)*[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(image)
          : /^https:\/\//i.test(image) &&
            (() => {
              try {
                return new URL(image).protocol === "https:";
              } catch {
                return false;
              }
            })()),
    )
  )
    fail("INVALID_PRODUCT");
  if (
    !result.specifications ||
    typeof result.specifications !== "object" ||
    Array.isArray(result.specifications) ||
    Object.keys(result.specifications).length > 30 ||
    !Object.entries(result.specifications).every(
      ([key, value]) =>
        key.trim().length > 0 &&
        key.length <= 80 &&
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 200,
    )
  )
    fail("INVALID_PRODUCT");
  result.tags = result.tags.map((tag) => tag.trim());
  result.images = result.images.map((image) => image.trim());
  result.shortDescription = result.description.split(/[.!?]/)[0];
  return result;
}
function shopSettingsInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INVALID_SETTINGS");
  const methods = (value) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 5)
      fail("INVALID_SETTINGS");
    return value.map((item) => {
      const id = text(item?.id, 40).toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail("INVALID_SETTINGS");
      return { id, name: text(item.name, 80) };
    });
  };
  const result = {
    name: text(input.name, 80),
    sellerName: text(input.sellerName, 120),
    sellerCity: text(input.sellerCity, 100),
    supportEmail: input.supportEmail ? email(input.supportEmail) : null,
    supportPhone: input.supportPhone ? text(input.supportPhone, 30) : null,
    warrantyMonths: input.warrantyMonths === null || input.warrantyMonths === "" ? null : Number(input.warrantyMonths),
    returnInstructions: text(input.returnInstructions, 2000),
    demoNotice: text(input.demoNotice, 500),
    deliveryNote: text(input.deliveryNote, 2000),
    deliveryMethods: methods(input.deliveryMethods),
    paymentMethods: methods(input.paymentMethods),
    priceNote: text(input.priceNote, 1000),
  };
  if (result.warrantyMonths !== null && (!Number.isInteger(result.warrantyMonths) || result.warrantyMonths < 0 || result.warrantyMonths > 120)) fail("INVALID_SETTINGS");
  if (new Set(result.deliveryMethods.map((item) => item.id)).size !== result.deliveryMethods.length || new Set(result.paymentMethods.map((item) => item.id)).size !== result.paymentMethods.length) fail("INVALID_SETTINGS");
  return result;
}
function projectInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("INVALID_PROJECT");
  const id = text(input.id, 64).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail("INVALID_PROJECT");
  if (!Array.isArray(input.components) || input.components.length < 1 || input.components.length > 30)
    fail("INVALID_PROJECT");
  const components = input.components.map((item) => {
    if (!item || typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)
      fail("INVALID_PROJECT");
    return { productId: text(item.productId, 64), quantity: item.quantity };
  });
  if (new Set(components.map((item) => item.productId)).size !== components.length) fail("INVALID_PROJECT");
  const result = {
    id,
    name: text(input.name, 120),
    description: text(input.description, 2000),
    difficulty: text(input.difficulty, 30),
    image: text(input.image, 30),
    components,
    steps: Array.isArray(input.steps) ? input.steps.map((step) => text(step, 500)) : [],
    bundleDiscountPercent: input.bundleDiscountPercent === undefined ? 0 : Number(input.bundleDiscountPercent),
  };
  if (result.steps.length > 20 || !['Легкий', 'Середній', 'Просунутий'].includes(result.difficulty) || !productImages.has(result.image) || !Number.isInteger(result.bundleDiscountPercent) || result.bundleDiscountPercent < 0 || result.bundleDiscountPercent > 50)
    fail("INVALID_PROJECT");
  return result;
}
function couponInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_COUPON");
  const code = text(input.code, 24).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) fail("INVALID_COUPON");
  const percent = Number(input.percent), minTotal = Number(input.minTotal || 0);
  const maxUses = input.maxUses === null || input.maxUses === "" ? null : Number(input.maxUses);
  const validUntil = input.validUntil ? text(input.validUntil, 40) : null;
  if (!Number.isInteger(percent) || percent < 1 || percent > 80 || !Number.isInteger(minTotal) || minTotal < 0 || minTotal > 10000000 || (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000000)) || (validUntil !== null && !Number.isFinite(Date.parse(validUntil)))) fail("INVALID_COUPON");
  return { code, percent, minTotal, maxUses, validUntil, active: input.active !== false };
}
async function passwordHash(value) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(value, salt, 64)).toString("hex")}`;
}
async function matches(value, stored) {
  if (typeof value !== "string" || value.length > 128) return false;
  const [salt, encoded] = stored.split(":");
  const actual = await scrypt(value, salt, 64);
  const expected = Buffer.from(encoded, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function createApp({
  dbPath = ":memory:",
  publicOrigin,
  secureCookies = false,
  adminEmail,
  adminPassword,
  logger = console,
} = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY,price INTEGER NOT NULL CHECK(price>=0),old_price INTEGER,stock INTEGER NOT NULL CHECK(stock>=0));
    CREATE TABLE IF NOT EXISTS product_data(id TEXT PRIMARY KEY,body TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,product_id TEXT NOT NULL,quantity_change INTEGER NOT NULL,reason TEXT NOT NULL,order_id TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stock_alerts(user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL,created_at TEXT NOT NULL,notified_at TEXT,claim_id TEXT,claim_expires_at TEXT,PRIMARY KEY(user_id,product_id));
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL,date TEXT NOT NULL,image_url TEXT);
    CREATE TABLE IF NOT EXISTS community_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),user_name TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,photo_url TEXT NOT NULL,schematic_url TEXT,code_url TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS community_project_comments(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),user_name TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS community_project_questions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES community_projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),user_name TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL,answer TEXT,answered_by TEXT,answered_at TEXT);
    CREATE TABLE IF NOT EXISTS coupons(code TEXT PRIMARY KEY,percent INTEGER NOT NULL,min_total INTEGER NOT NULL DEFAULT 0,max_uses INTEGER,used_count INTEGER NOT NULL DEFAULT 0,valid_until TEXT,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS saved_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,project_id));
    CREATE TABLE IF NOT EXISTS shop_settings(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS store_projects(id TEXT PRIMARY KEY,body TEXT NOT NULL);`);
  const stockAlertColumns = db.prepare("PRAGMA table_info(stock_alerts)").all().map((column) => column.name);
  if (!stockAlertColumns.includes("claim_id")) db.exec("ALTER TABLE stock_alerts ADD COLUMN claim_id TEXT");
  if (!stockAlertColumns.includes("claim_expires_at")) db.exec("ALTER TABLE stock_alerts ADD COLUMN claim_expires_at TEXT");
  if (!db.prepare("PRAGMA table_info(reviews)").all().some((column) => column.name === "image_url"))
    db.exec("ALTER TABLE reviews ADD COLUMN image_url TEXT");
  db.exec(`
    DELETE FROM reviews
    WHERE rowid NOT IN (
      SELECT MAX(rowid) FROM reviews GROUP BY user_id, product_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_user_product
      ON reviews(user_id, product_id);
  `);
  db.exec(`
    DELETE FROM community_project_comments
    WHERE rowid NOT IN (
      SELECT MAX(rowid) FROM community_project_comments GROUP BY project_id, user_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS community_comments_one_per_user_project
      ON community_project_comments(project_id, user_id);
  `);
  db.prepare("INSERT OR IGNORE INTO shop_settings(id,body) VALUES(1,?)").run(JSON.stringify(shopConfig));
  db.prepare("INSERT OR IGNORE INTO coupons(code,percent,min_total,max_uses,used_count,valid_until,active) VALUES('NEXLAB10',10,1000,NULL,0,NULL,1)").run();
  const seedProject = db.prepare("INSERT OR IGNORE INTO store_projects(id,body) VALUES(?,?)");
  for (const project of projects) seedProject.run(project.id, JSON.stringify(project));
  function currentShopSettings() {
    return JSON.parse(db.prepare("SELECT body FROM shop_settings WHERE id=1").get().body);
  }
  if (
    !db
      .prepare("PRAGMA table_info(saved_projects)")
      .all()
      .some((column) => column.name === "checklist")
  )
    db.exec(
      "ALTER TABLE saved_projects ADD COLUMN checklist TEXT NOT NULL DEFAULT '[]'",
    );
  if (
    !db
      .prepare("PRAGMA table_info(saved_projects)")
      .all()
      .some((column) => column.name === "step_checklist")
  )
    db.exec(
      "ALTER TABLE saved_projects ADD COLUMN step_checklist TEXT NOT NULL DEFAULT '[]'",
    );
  if (
    !db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .some((column) => column.name === "fingerprint")
  )
    db.exec(
      "ALTER TABLE orders ADD COLUMN fingerprint TEXT NOT NULL DEFAULT ''",
    );
  if (
    !db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .some((column) => column.name === "status")
  ) {
    db.exec(
      "ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'processing'",
    );
    for (const row of db.prepare("SELECT id,body FROM orders").all()) {
      try {
        const status = JSON.parse(row.body).status;
        if (
          ["processing", "delivered", "cancelled", "returned"].includes(status)
        )
          db.prepare("UPDATE orders SET status=? WHERE id=?").run(
            status,
            row.id,
          );
      } catch {}
    }
  }
  const seed = db.prepare(
    "INSERT OR IGNORE INTO inventory(id,price,old_price,stock) VALUES(?,?,?,?)",
  );
  const seedProduct = db.prepare(
    "INSERT OR IGNORE INTO product_data(id,body,deleted) VALUES(?,?,0)",
  );
  const addCatalogImages = db.prepare(
    "UPDATE product_data SET body=? WHERE id=? AND deleted=0",
  );
  catalog.forEach((p) => {
    seed.run(p.id, p.price, p.oldPrice, p.stock);
    seedProduct.run(p.id, JSON.stringify(p));
    if (p.images?.length) {
      const stored = db
        .prepare("SELECT body FROM product_data WHERE id=? AND deleted=0")
        .get(p.id);
      if (stored) {
        try {
          const product = JSON.parse(stored.body);
          if (!Array.isArray(product.images) || product.images.length === 0) {
            product.images = p.images;
            addCatalogImages.run(JSON.stringify(product), p.id);
          }
        } catch {
          /* Leave a malformed record for explicit admin repair. */
        }
      }
    }
  });
  if (adminEmail && adminPassword) {
    const address = email(adminEmail);
    const existing = db
      .prepare("SELECT id,role FROM users WHERE email=?")
      .get(address);
    if (existing && existing.role !== "admin")
      throw new Error(`ADMIN_EMAIL_IN_USE: ${address}`);
    if (!existing)
      db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
        randomUUID(),
        "Адміністратор",
        address,
        await passwordHash(password(adminPassword)),
        "admin",
        new Date().toISOString(),
      );
  }
  const dummyHash = await passwordHash(randomBytes(32).toString("hex"));
  const attempts = new Map();
  const send = (res, status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  function cookie(res, token) {
    res.setHeader(
      "Set-Cookie",
      `nexlab_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_AGE}${secureCookies ? "; Secure" : ""}`,
    );
  }
  function newSession(res, userId = null, oldId) {
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    if (oldId) db.prepare("DELETE FROM sessions WHERE id=?").run(oldId);
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
      hash(token),
      userId,
      csrf,
      Date.now() + SESSION_AGE * 1000,
    );
    cookie(res, token);
    return {
      csrf,
      user: publicUser(
        userId
          ? db.prepare("SELECT * FROM users WHERE id=?").get(userId)
          : null,
      ),
    };
  }
  function currentSession(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("nexlab_sid="))
      ?.slice(11);
    return token
      ? db
          .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
          .get(hash(token), Date.now())
      : null;
  }
  function allProducts() {
    const inventory = new Map(
      db
        .prepare("SELECT * FROM inventory")
        .all()
        .map((row) => [row.id, row]),
    );
    const stats = new Map(
      db
        .prepare(
          "SELECT product_id,COUNT(*) AS count,AVG(rating) AS average FROM reviews GROUP BY product_id",
        )
        .all()
        .map((row) => [row.product_id, row]),
    );
    return db
      .prepare("SELECT body FROM product_data WHERE deleted=0 ORDER BY rowid")
      .all()
      .map(({ body }) => JSON.parse(body))
      .flatMap((product) => {
        const row = inventory.get(product.id),
          stat = stats.get(product.id);
        if (!row) return [];
        return [
          {
            ...product,
            price: row.price,
            oldPrice: row.old_price,
            stock: row.stock,
            images: normalizeCatalogImages(product.id, product.images),
            tags: product.tags || [],
            specifications: product.specifications || {},
            reviewsCount: stat?.count || 0,
            rating: stat ? Math.round(stat.average * 10) / 10 : 0,
            discount:
              row.old_price > row.price
                ? Math.round((1 - row.price / row.old_price) * 100)
                : 0,
          },
        ];
      });
  }
  function allProjects() {
    return db
      .prepare("SELECT body FROM store_projects ORDER BY rowid")
      .all()
      .map((row) => JSON.parse(row.body))
      .filter((project) => !project.deleted);
  }
  function storedProject(id) {
    const row = db
      .prepare("SELECT body FROM store_projects WHERE id=?")
      .get(id);
    return row ? JSON.parse(row.body) : null;
  }
  async function body(req, maxBytes = 32768) {
    if (!(req.headers["content-type"] || "").startsWith("application/json"))
      fail("JSON_REQUIRED", 415);
    let result = "";
    for await (const chunk of req) {
      result += chunk;
      if (Buffer.byteLength(result) > maxBytes) fail("BODY_TOO_LARGE", 413);
    }
    try {
      const parsed = JSON.parse(result);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
        fail("INVALID_JSON");
      return parsed;
    } catch {
      fail("INVALID_JSON");
    }
  }
  function throttle(req) {
    const key = req.socket.remoteAddress,
      now = Date.now();
    for (const [ip, value] of attempts)
      if (value.expires < now) attempts.delete(ip);
    const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60000 };
    if (++entry.count > 30) fail("TOO_MANY_ATTEMPTS", 429);
    attempts.set(key, entry);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname,
        method = req.method;
      let session = currentSession(req);
      const user = session?.user_id
        ? db.prepare("SELECT * FROM users WHERE id=?").get(session.user_id)
        : null;
      const requireUser = () => {
        if (!user) fail("UNAUTHENTICATED", 401);
        return user;
      };
      const rolePermissions = {
        order_manager: new Set(["orders"]),
        catalog_manager: new Set(["catalog"]),
        warehouse: new Set(["warehouse"]),
        support: new Set(["support"]),
      };
      const requirePermission = (permission) => {
        const current = requireUser();
        if (current.role !== "admin" && !rolePermissions[current.role]?.has(permission))
          fail("FORBIDDEN", 403);
        return current;
      };
      if (path.startsWith("/api/") && !path.endsWith(".js")) {
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
          fail("METHOD_NOT_ALLOWED", 405);
        if (method !== "GET") {
          const origin = req.headers.origin;
          const allowed = publicOrigin || `http://${req.headers.host}`;
          if (
            origin !== allowed ||
            req.headers["sec-fetch-site"] === "cross-site"
          )
            fail("INVALID_ORIGIN", 403);
          if (!session || req.headers["x-csrf-token"] !== session.csrf)
            fail("INVALID_CSRF", 403);
        }
        if (path === "/api/session" && method === "GET")
          return send(
            res,
            200,
            session
              ? { user: publicUser(user), csrf: session.csrf }
              : newSession(res),
          );
        if (path === "/api/auth/register" && method === "POST") {
          throttle(req);
          const input = await body(req),
            name = text(input.name, 80),
            address = email(input.email);
          if (input.terms !== true) fail("TERMS_REQUIRED");
          const encoded = await passwordHash(password(input.password));
          const id = randomUUID();
          try {
            db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?)").run(
              id,
              name,
              address,
              encoded,
              "user",
              new Date().toISOString(),
            );
          } catch (error) {
            if (db.prepare("SELECT id FROM users WHERE email=?").get(address))
              fail("EMAIL_TAKEN", 409);
            throw error;
          }
          return send(res, 201, newSession(res, id, session.id));
        }
        if (path === "/api/auth/login" && method === "POST") {
          throttle(req);
          const input = await body(req),
            address = email(input.email),
            found = db
              .prepare("SELECT * FROM users WHERE email=?")
              .get(address);
          const valid = await matches(
            input.password,
            found?.password_hash || dummyHash,
          );
          if (!found || !valid) fail("INVALID_CREDENTIALS", 401);
          return send(res, 200, newSession(res, found.id, session.id));
        }
        if (path === "/api/auth/logout" && method === "POST") {
          await body(req);
          return send(res, 200, newSession(res, null, session.id));
        }
        if (path === "/api/profile" && method === "PATCH") {
          requireUser();
          const input = await body(req),
            name = text(input.name, 80),
            address = email(input.email);
          const taken = db
            .prepare("SELECT id FROM users WHERE email=? AND id!=?")
            .get(address, user.id);
          if (taken) fail("EMAIL_TAKEN", 409);
          db.prepare("UPDATE users SET name=?,email=? WHERE id=?").run(
            name,
            address,
            user.id,
          );
          return send(res, 200, {
            user: publicUser(
              db.prepare("SELECT * FROM users WHERE id=?").get(user.id),
            ),
          });
        }
        if (path === "/api/password" && method === "POST") {
          requireUser();
          throttle(req);
          const input = await body(req);
          if (!(await matches(input.currentPassword, user.password_hash)))
            fail("WRONG_PASSWORD");
          const encoded = await passwordHash(password(input.newPassword));
          db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
            encoded,
            user.id,
          );
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
          return send(res, 200, newSession(res, user.id));
        }
        if (path === "/api/products" && method === "GET")
          return send(res, 200, {
            products: allProducts(),
            categories,
            settings: currentShopSettings(),
          });
        if (path === "/api/store" && method === "GET")
          return send(res, 200, { settings: currentShopSettings() });
        if (path === "/api/coupons/validate" && method === "POST") {
          throttle(req);
          const input = await body(req), code = text(input.code, 24).toUpperCase();
          const coupon = db.prepare("SELECT * FROM coupons WHERE code=? AND active=1").get(code);
          if (!coupon || (coupon.valid_until && Date.parse(coupon.valid_until) < Date.now()) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) fail("COUPON_INVALID", 404);
          if (!Number.isInteger(input.subtotal) || input.subtotal < coupon.min_total || !Number.isInteger(input.bundleDiscount || 0) || (input.bundleDiscount || 0) < 0 || (input.bundleDiscount || 0) > input.subtotal) fail("COUPON_MINIMUM_NOT_MET", 422);
          return send(res, 200, { coupon: { code: coupon.code, percent: coupon.percent, minTotal: coupon.min_total, validUntil: coupon.valid_until, discount: Math.floor((input.subtotal - (input.bundleDiscount || 0)) * coupon.percent / 100) } });
        }
        if (path === "/api/projects" && method === "GET") {
          const productList = allProducts(), projectList = allProjects();
          return send(res, 200, {
            projects: projectList.map((project) => ({
              ...project,
              estimatedPrice: project.components.reduce(
                (s, c) =>
                  s +
                  (productList.find((p) => p.id === c.productId)?.price || 0) *
                    c.quantity,
                0,
              ),
            })),
          });
        }
        if (path === "/api/orders" && method === "GET") {
          requireUser();
          return send(res, 200, {
            orders: db
              .prepare(
                "SELECT body FROM orders WHERE user_id=? ORDER BY rowid DESC",
              )
              .all(user.id)
              .map((row) => JSON.parse(row.body)),
          });
        }
        if (path === "/api/orders/return-request" && method === "POST") {
          requireUser();
          throttle(req);
          const input = await body(req);
          if (typeof input.orderId !== "string") fail("INVALID_ORDER");
          const reason = text(input.reason, 1000);
          db.exec("BEGIN IMMEDIATE");
          try {
            const row = db.prepare("SELECT body FROM orders WHERE id=? AND user_id=?").get(input.orderId, user.id);
            if (!row) fail("ORDER_NOT_FOUND", 404);
            const order = JSON.parse(row.body);
            if (order.status !== "delivered") fail("RETURN_NOT_AVAILABLE", 409);
            if (["requested", "accepted"].includes(order.returnRequest?.status)) fail("RETURN_ALREADY_REQUESTED", 409);
            order.returnRequest = { status: "requested", reason, requestedAt: new Date().toISOString() };
            db.prepare("UPDATE orders SET body=? WHERE id=?").run(JSON.stringify(order), order.id);
            db.exec("COMMIT");
            return send(res, 201, { returnRequest: order.returnRequest });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/orders" && method === "POST") {
          requireUser();
          const input = await body(req),
            requestKey = text(req.headers["idempotency-key"], 100);
          const couponCode = input.couponCode ? text(input.couponCode, 24).toUpperCase() : null;
          const fingerprint = hash(
            JSON.stringify({ items: input.items, delivery: input.delivery, couponCode }),
          );
          const delivery = input.delivery || {},
            customer = {
              name: text(delivery.name, 80),
              phone: text(delivery.phone, 30),
              city: text(delivery.city, 100),
              address: text(delivery.address, 200),
              carrier: delivery.carrier,
              payment: delivery.payment,
            };
          if (!/^\+?380\d{9}$/.test(customer.phone.replace(/[\s()-]/g, "")))
            fail("INVALID_PHONE");
          customer.phone = customer.phone.replace(/[\s()-]/g, "");
          const settings = currentShopSettings();
          if (
            !settings.deliveryMethods.some(
              (item) => item.id === customer.carrier,
            ) ||
            !settings.paymentMethods.some(
              (item) => item.id === customer.payment,
            )
          )
            fail("INVALID_DELIVERY");
          if (
            !Array.isArray(input.items) ||
            !input.items.length ||
            input.items.length > 100
          )
            fail("EMPTY_CART");
          const ids = new Set(),
            items = [];
          db.exec("BEGIN IMMEDIATE");
          try {
            const existing = db
              .prepare(
                "SELECT body,fingerprint FROM orders WHERE user_id=? AND request_key=?",
              )
              .get(user.id, requestKey);
            if (existing) {
              if (existing.fingerprint !== fingerprint)
                fail("ORDER_REQUEST_CHANGED", 409);
              db.exec("COMMIT");
              return send(res, 200, { order: JSON.parse(existing.body) });
            }
            const availableProducts = new Map(
              allProducts().map((product) => [product.id, product]),
            );
            for (const item of input.items) {
              if (
                typeof item.id !== "string" ||
                ids.has(item.id) ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
              )
                fail("INVALID_ITEMS");
              ids.add(item.id);
              const stock = db
                  .prepare("SELECT * FROM inventory WHERE id=?")
                  .get(item.id),
                product = availableProducts.get(item.id);
              if (!product || !stock || stock.stock < item.quantity)
                fail("OUT_OF_STOCK", 409);
              if (item.expectedPrice !== stock.price)
                fail("PRICE_CHANGED", 409);
              items.push({
                id: product.id,
                name: product.name,
                quantity: item.quantity,
                price: stock.price,
                oldPrice: stock.old_price,
              });
            }
            const subtotal = items.reduce((s, p) => s + p.price * p.quantity, 0);
            let bundleDiscount = 0;
            const bundlePromotions = [];
            const remaining = new Map(items.map((item) => [item.id, item.quantity]));
            const priced = new Map(items.map((item) => [item.id, item.price]));
            for (const project of allProjects()
              .filter((item) => Number.isInteger(item.bundleDiscountPercent) && item.bundleDiscountPercent > 0)
              .sort((a, b) => b.bundleDiscountPercent - a.bundleDiscountPercent)) {
              while (project.components.every((component) => (remaining.get(component.productId) || 0) >= component.quantity)) {
                let kitSubtotal = 0;
                for (const component of project.components) {
                  remaining.set(component.productId, remaining.get(component.productId) - component.quantity);
                  kitSubtotal += (priced.get(component.productId) || 0) * component.quantity;
                }
                const savings = Math.floor(kitSubtotal * project.bundleDiscountPercent / 100);
                bundleDiscount += savings;
                bundlePromotions.push({ projectId: project.id, name: project.name, percent: project.bundleDiscountPercent, discount: savings });
              }
            }
            let couponDiscount = 0;
            if (couponCode) {
              const coupon = db.prepare("SELECT * FROM coupons WHERE code=? AND active=1").get(couponCode);
              if (!coupon || (coupon.valid_until && Date.parse(coupon.valid_until) < Date.now()) || (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)) fail("COUPON_INVALID", 409);
              if (subtotal < coupon.min_total) fail("COUPON_MINIMUM_NOT_MET", 409);
              couponDiscount = Math.floor((subtotal - bundleDiscount) * coupon.percent / 100);
              db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE code=?").run(couponCode);
            }
            const total = subtotal - bundleDiscount - couponDiscount,
              discount = items.reduce(
                (s, p) =>
                  s +
                  Math.max(0, (p.oldPrice || p.price) - p.price) * p.quantity,
                0,
              );
            const order = {
              id: randomUUID(),
              userId: user.id,
              date: new Date().toISOString(),
              status: "processing",
              statusHistory: [{ status: "processing", date: new Date().toISOString() }],
              items,
              total,
              discount: discount + bundleDiscount + couponDiscount,
              bundleDiscount,
              bundlePromotions,
              couponCode,
              couponDiscount,
              delivery: customer,
              deliveryCost: null,
            };
            items.forEach((item) =>
              (() => {
                db.prepare("UPDATE inventory SET stock=stock-? WHERE id=?").run(item.quantity, item.id);
                db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
                  .run(randomUUID(), item.id, -item.quantity, "order_reserved", order.id, order.date);
              })(),
            );
            db.prepare(
              "INSERT INTO orders(id,user_id,request_key,body,fingerprint,status) VALUES(?,?,?,?,?,?)",
            ).run(
              order.id,
              user.id,
              requestKey,
              JSON.stringify(order),
              fingerprint,
              order.status,
            );
            db.exec("COMMIT");
            return send(res, 201, { order });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/reviews" && method === "GET")
          return send(res, 200, {
            reviews: db
              .prepare(
                "SELECT r.id,r.product_id AS productId,r.rating,r.text,r.date,r.image_url AS imageUrl,u.name AS userName FROM reviews r JOIN users u ON r.user_id=u.id WHERE product_id=? ORDER BY r.rowid DESC",
              )
              .all(url.searchParams.get("productId")),
          });
        if (path.startsWith("/api/community-projects/") && method === "GET") {
          let projectId;
          try { projectId = decodeURIComponent(path.slice("/api/community-projects/".length)); }
          catch { fail("PROJECT_NOT_FOUND", 404); }
          if (!projectId || projectId.length > 128 || projectId.includes("/")) fail("PROJECT_NOT_FOUND", 404);
          const project = db.prepare("SELECT id,user_id AS userId,user_name AS userName,title,description,photo_url AS photoUrl,schematic_url AS schematicUrl,code_url AS codeUrl,created_at AS date FROM community_projects WHERE id=?").get(projectId);
          if (!project) fail("PROJECT_NOT_FOUND", 404);
          const comments = db.prepare("SELECT id,project_id AS projectId,user_id AS userId,user_name AS userName,rating,text,created_at AS date FROM community_project_comments WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 30").all(projectId);
          const questions = db.prepare("SELECT id,project_id AS projectId,user_id AS userId,user_name AS userName,text,created_at AS date,answer,answered_by AS answeredBy,answered_at AS answeredAt FROM community_project_questions WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 30").all(projectId);
          const summary = db.prepare("SELECT COUNT(*) AS count,AVG(rating) AS rating FROM community_project_comments WHERE project_id=?").get(projectId);
          const questionCount = db.prepare("SELECT COUNT(*) AS count FROM community_project_questions WHERE project_id=?").get(projectId).count;
          return send(res, 200, { project: {
            ...project,
            rating: summary.rating || 0,
            commentCount: summary.count,
            hasRated: Boolean(user && db.prepare("SELECT 1 FROM community_project_comments WHERE project_id=? AND user_id=?").get(projectId, user.id)),
            comments,
            questions,
            questionCount,
          } });
        }
        if (path === "/api/community-projects" && method === "GET") {
          const requestedLimit = Number(url.searchParams.get("limit")) || 12;
          const limit = Math.max(1, Math.min(24, Math.floor(requestedLimit)));
          const requestedOffset = Number(url.searchParams.get("offset")) || 0;
          const offset = Math.max(0, Math.floor(requestedOffset));
          const entries = db.prepare("SELECT id,user_id AS userId,user_name AS userName,title,description,photo_url AS photoUrl,schematic_url AS schematicUrl,code_url AS codeUrl,created_at AS date FROM community_projects ORDER BY created_at DESC,rowid DESC LIMIT ? OFFSET ?").all(limit + 1, offset);
          const hasMore = entries.length > limit;
          const projects = entries.slice(0, limit).map((project) => {
            const comments = db.prepare("SELECT id,project_id AS projectId,user_id AS userId,user_name AS userName,rating,text,created_at AS date FROM community_project_comments WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 30").all(project.id);
            const questions = db.prepare("SELECT id,project_id AS projectId,user_id AS userId,user_name AS userName,text,created_at AS date,answer,answered_by AS answeredBy,answered_at AS answeredAt FROM community_project_questions WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 30").all(project.id);
            const summary = db.prepare("SELECT COUNT(*) AS count,AVG(rating) AS rating FROM community_project_comments WHERE project_id=?").get(project.id);
            const questionCount = db.prepare("SELECT COUNT(*) AS count FROM community_project_questions WHERE project_id=?").get(project.id).count;
            return {
              ...project,
              rating: summary.rating || 0,
              commentCount: summary.count,
              hasRated: Boolean(user && db.prepare("SELECT 1 FROM community_project_comments WHERE project_id=? AND user_id=?").get(project.id, user.id)),
              comments,
              questions,
              questionCount,
            };
          });
          return send(res, 200, { projects, hasMore, nextOffset: offset + projects.length });
        }
        if (path === "/api/community-projects" && method === "POST") {
          requireUser();
          throttle(req);
          const input = await body(req, 400_000);
          const secureUrl = (value, optional = false) => {
            if (optional && !value) return null;
            if (typeof value !== "string" || value.length > 2000) fail("INVALID_PROJECT_URL");
            try { const parsed = new URL(value); if (parsed.protocol !== "https:") fail("INVALID_PROJECT_URL"); return parsed.href; }
            catch { fail("INVALID_PROJECT_URL"); }
          };
          const project = {
            id: randomUUID(), userId: user.id, userName: user.name,
            title: text(input.title, 120), description: text(input.description, 2000),
            photoUrl: safeImageUrl(input.photoUrl, "INVALID_PROJECT_URL"), schematicUrl: secureUrl(input.schematicUrl, true),
            codeUrl: secureUrl(input.codeUrl), date: new Date().toISOString(),
          };
          db.prepare("INSERT INTO community_projects(id,user_id,user_name,title,description,photo_url,schematic_url,code_url,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            .run(project.id, project.userId, project.userName, project.title, project.description, project.photoUrl, project.schematicUrl, project.codeUrl, project.date);
          return send(res, 201, { project: { ...project, rating: 0, comments: [] } });
        }
        if (path === "/api/community-projects/comments" && method === "POST") {
          requireUser();
          throttle(req);
          const input = await body(req);
          if (typeof input.projectId !== "string" || !db.prepare("SELECT id FROM community_projects WHERE id=?").get(input.projectId)) fail("PROJECT_NOT_FOUND", 404);
          if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail("INVALID_RATING");
          const commentText = text(input.text, 1000);
          if (db.prepare("SELECT 1 FROM community_project_comments WHERE project_id=? AND user_id=?").get(input.projectId, user.id))
            fail("COMMENT_ALREADY_EXISTS", 409);
          const comment = { id: randomUUID(), projectId: input.projectId, userId: user.id, userName: user.name, rating: input.rating, text: commentText, date: new Date().toISOString() };
          try {
            db.prepare("INSERT INTO community_project_comments(id,project_id,user_id,user_name,rating,text,created_at) VALUES(?,?,?,?,?,?,?)")
              .run(comment.id, comment.projectId, comment.userId, comment.userName, comment.rating, comment.text, comment.date);
          } catch (error) {
            if (error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE") fail("COMMENT_ALREADY_EXISTS", 409);
            throw error;
          }
          return send(res, 201, { comment });
        }
        if (path === "/api/community-projects/questions" && method === "POST") {
          requireUser();
          throttle(req);
          const input = await body(req);
          if (typeof input.projectId !== "string" || !db.prepare("SELECT id FROM community_projects WHERE id=?").get(input.projectId)) fail("PROJECT_NOT_FOUND", 404);
          const question = { id: randomUUID(), projectId: input.projectId, userId: user.id, userName: user.name, text: text(input.text, 1000), date: new Date().toISOString() };
          db.prepare("INSERT INTO community_project_questions(id,project_id,user_id,user_name,text,created_at) VALUES(?,?,?,?,?,?)")
            .run(question.id, question.projectId, question.userId, question.userName, question.text, question.date);
          return send(res, 201, { question });
        }
        if (path === "/api/community-projects/questions/answer" && method === "PATCH") {
          requireUser();
          throttle(req);
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_QUESTION");
          const question = db.prepare("SELECT q.id,q.project_id AS projectId,p.user_id AS projectOwnerId FROM community_project_questions q JOIN community_projects p ON p.id=q.project_id WHERE q.id=?").get(input.id);
          if (!question) fail("QUESTION_NOT_FOUND", 404);
          if (question.projectOwnerId !== user.id && user.role !== "admin" && !rolePermissions[user.role]?.has("support")) fail("FORBIDDEN", 403);
          const answer = text(input.answer, 1000);
          const answeredAt = new Date().toISOString();
          db.prepare("UPDATE community_project_questions SET answer=?,answered_by=?,answered_at=? WHERE id=?")
            .run(answer, user.name, answeredAt, question.id);
          return send(res, 200, { question: { ...question, answer, answeredBy: user.name, answeredAt } });
        }
        if (path === "/api/stock-alerts" && method === "POST") {
          requireUser();
          const input = await body(req), productId = text(input.productId, 64);
          const product = db.prepare("SELECT i.stock FROM inventory i JOIN product_data p ON p.id=i.id WHERE i.id=? AND p.deleted=0").get(productId);
          if (!product) fail("PRODUCT_NOT_FOUND", 404);
          if (product.stock > 0) fail("PRODUCT_ALREADY_AVAILABLE", 409);
          db.prepare("INSERT INTO stock_alerts(user_id,product_id,created_at) VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET created_at=excluded.created_at,notified_at=NULL,claim_id=NULL,claim_expires_at=NULL")
            .run(user.id, productId, new Date().toISOString());
          return send(res, 201, { subscribed: true });
        }
        if (path === "/api/stock-alerts/claim" && method === "POST") {
          requireUser();
          const now = new Date();
          const nowIso = now.toISOString();
          const expiresAt = new Date(now.getTime() + 2 * 60_000).toISOString();
          const claimId = randomUUID();
          const rows = db.prepare("SELECT a.product_id AS productId,i.stock,p.body FROM stock_alerts a JOIN inventory i ON i.id=a.product_id JOIN product_data p ON p.id=a.product_id WHERE a.user_id=? AND a.notified_at IS NULL AND (a.claim_expires_at IS NULL OR a.claim_expires_at<=?) AND i.stock>0 AND p.deleted=0").all(user.id, nowIso);
          const updateClaim = db.prepare("UPDATE stock_alerts SET claim_id=?,claim_expires_at=? WHERE user_id=? AND product_id=? AND notified_at IS NULL AND (claim_expires_at IS NULL OR claim_expires_at<=?)");
          const alerts = rows.flatMap((row) => updateClaim.run(claimId, expiresAt, user.id, row.productId, nowIso).changes
            ? [{ productId: row.productId, name: JSON.parse(row.body).name, claimId }]
            : []);
          return send(res, 200, { alerts });
        }
        if (path === "/api/stock-alerts/acknowledge" && method === "POST") {
          requireUser();
          const input = await body(req);
          if (!Array.isArray(input.alerts) || input.alerts.length > 100) fail("INVALID_INPUT");
          const acknowledge = db.prepare("UPDATE stock_alerts SET notified_at=?,claim_id=NULL,claim_expires_at=NULL WHERE user_id=? AND product_id=? AND claim_id=? AND notified_at IS NULL");
          const notifiedAt = new Date().toISOString();
          const acknowledged = input.alerts.reduce((count, alert) => {
            if (!alert || typeof alert.productId !== "string" || typeof alert.claimId !== "string") fail("INVALID_INPUT");
            return count + acknowledge.run(notifiedAt, user.id, alert.productId, alert.claimId).changes;
          }, 0);
          return send(res, 200, { acknowledged });
        }
        if (path === "/api/reviews" && method === "POST") {
          requireUser();
          const input = await body(req, 400_000);
          if (
            !allProducts().some((p) => p.id === input.productId) ||
            !Number.isInteger(input.rating) ||
            input.rating < 1 ||
            input.rating > 5
          )
            fail("INVALID_RATING");
          const reviewText = text(input.text, 1000);
          if (db.prepare("SELECT 1 FROM reviews WHERE user_id=? AND product_id=?").get(user.id, input.productId))
            fail("REVIEW_ALREADY_EXISTS", 409);
          const review = {
            id: randomUUID(),
            productId: input.productId,
            rating: input.rating,
            text: reviewText,
            date: new Date().toISOString(),
            userName: user.name,
            imageUrl: input.imageUrl ? (() => {
              return safeImageUrl(input.imageUrl, "INVALID_REVIEW_IMAGE");
            })() : null,
          };
          try {
            db.prepare("INSERT INTO reviews(id,user_id,product_id,rating,text,date,image_url) VALUES(?,?,?,?,?,?,?)").run(
              review.id,
              user.id,
              review.productId,
              review.rating,
              review.text,
              review.date,
              review.imageUrl,
            );
          } catch (error) {
            if (error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE")
              fail("REVIEW_ALREADY_EXISTS", 409);
            throw error;
          }
          return send(res, 201, { review });
        }
        if (path === "/api/my-projects" && method === "GET") {
          requireUser();
          const saved = db
            .prepare(
              "SELECT id,project_id AS projectId,created_at AS createdAt,checklist,step_checklist AS stepChecklist FROM saved_projects WHERE user_id=? ORDER BY rowid DESC",
            )
            .all(user.id);
          const projectList = allProjects();
          return send(res, 200, {
            projects: saved.map((row) => {
              const project = projectList.find((item) => item.id === row.projectId);
              const components = project?.components || [];
              let checklist = [];
              let stepChecklist = [];
              try {
                checklist = JSON.parse(row.checklist);
              } catch {}
              try {
                stepChecklist = JSON.parse(row.stepChecklist);
              } catch {}
              checklist = components.map(
                (_, index) => checklist[index] === true,
              );
              const steps = project ? getProjectSteps(project) : [];
              stepChecklist = steps.map((_, index) => stepChecklist[index] === true);
              const totalTasks = components.length + steps.length;
              return {
                ...row,
                checklist,
                stepChecklist,
                steps,
                progress: totalTasks
                  ? Math.round(
                      ((checklist.filter(Boolean).length + stepChecklist.filter(Boolean).length) / totalTasks) *
                        100,
                    )
                  : 0,
                components,
              };
            }),
          });
        }
        if (path === "/api/my-projects" && method === "POST") {
          requireUser();
          const input = await body(req);
          if (!allProjects().some((p) => p.id === input.projectId))
            fail("PROJECT_NOT_FOUND", 404);
          db.prepare(
            "INSERT OR IGNORE INTO saved_projects(id,user_id,project_id,created_at,checklist,step_checklist) VALUES(?,?,?,?,?,'[]')",
          ).run(
            randomUUID(),
            user.id,
            input.projectId,
            new Date().toISOString(),
            "[]",
          );
          return send(res, 201, { saved: true });
        }
        if (path === "/api/my-projects" && method === "PATCH") {
          requireUser();
          const input = await body(req),
            project = allProjects().find((item) => item.id === input.projectId);
          if (
            !project ||
            !Array.isArray(input.checklist) ||
            input.checklist.length !== project.components.length ||
            !input.checklist.every((value) => typeof value === "boolean") ||
            (input.stepChecklist !== undefined &&
              (!Array.isArray(input.stepChecklist) ||
                input.stepChecklist.length !== getProjectSteps(project).length ||
                !input.stepChecklist.every((value) => typeof value === "boolean")))
          )
            fail("INVALID_PROJECT_CHECKLIST");
          const result = db
            .prepare(
              "UPDATE saved_projects SET checklist=?,step_checklist=COALESCE(?,step_checklist) WHERE user_id=? AND project_id=?",
            )
            .run(JSON.stringify(input.checklist), input.stepChecklist === undefined ? null : JSON.stringify(input.stepChecklist), user.id, project.id);
          if (!result.changes) fail("SAVED_PROJECT_NOT_FOUND", 404);
          return send(res, 200, { saved: true });
        }
        if (path === "/api/my-projects" && method === "DELETE") {
          requireUser();
          const input = await body(req);
          if (typeof input.projectId !== "string") fail("INVALID_PROJECT");
          const result = db
            .prepare(
              "DELETE FROM saved_projects WHERE user_id=? AND project_id=?",
            )
            .run(user.id, input.projectId);
          if (!result.changes) fail("SAVED_PROJECT_NOT_FOUND", 404);
          return send(res, 200, { deleted: true });
        }
        if (path === "/api/admin/products" && method === "PATCH") {
          const current = requireUser();
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_PRODUCT");
          if (current.role === "warehouse") {
            if (Object.keys(input).some((key) => !["id", "stock"].includes(key))) fail("FORBIDDEN", 403);
          } else if (current.role !== "admin" && !rolePermissions[current.role]?.has("catalog")) fail("FORBIDDEN", 403);
          const existing = db
            .prepare("SELECT body FROM product_data WHERE id=? AND deleted=0")
            .get(input.id);
          if (!existing) fail("PRODUCT_NOT_FOUND", 404);
          const inventory = db
            .prepare("SELECT price,old_price,stock FROM inventory WHERE id=?")
            .get(input.id);
          if (!inventory) fail("PRODUCT_NOT_FOUND", 404);
          const product = productInput({
            ...JSON.parse(existing.body),
            price: inventory.price,
            oldPrice: inventory.old_price,
            stock: inventory.stock,
            ...input,
          });
          db.exec("BEGIN IMMEDIATE");
          try {
            const stockChange = product.stock - inventory.stock;
            db.prepare(
              "UPDATE inventory SET price=?,old_price=?,stock=? WHERE id=?",
            ).run(product.price, product.oldPrice, product.stock, product.id);
            db.prepare(
              "UPDATE product_data SET body=? WHERE id=? AND deleted=0",
            ).run(JSON.stringify(product), product.id);
            if (stockChange) db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
              .run(randomUUID(), product.id, stockChange, "manual_adjustment", null, new Date().toISOString());
            db.exec("COMMIT");
            return send(res, 200, { saved: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/products/import" && method === "POST") {
          requirePermission("catalog");
          const input = await body(req, 2_500_000);
          if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > 200)
            fail("INVALID_CATALOG_IMPORT");
          const products = input.products.map(productInput);
          if (new Set(products.map((product) => product.id)).size !== products.length)
            fail("INVALID_CATALOG_IMPORT");
          db.exec("BEGIN IMMEDIATE");
          try {
            const findInventory = db.prepare("SELECT stock FROM inventory WHERE id=?");
            const saveInventory = db.prepare("INSERT INTO inventory(id,price,old_price,stock) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET price=excluded.price,old_price=excluded.old_price,stock=excluded.stock");
            const saveProduct = db.prepare("INSERT INTO product_data(id,body,deleted) VALUES(?,?,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body,deleted=0");
            const addMovement = db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)");
            const date = new Date().toISOString();
            let movements = 0;
            for (const product of products) {
              const inventory = findInventory.get(product.id);
              const stockChange = product.stock - (inventory?.stock || 0);
              saveInventory.run(product.id, product.price, product.oldPrice, product.stock);
              saveProduct.run(product.id, JSON.stringify(product));
              if (stockChange) {
                addMovement.run(randomUUID(), product.id, stockChange, inventory ? "manual_adjustment" : "initial_stock", null, date);
                movements++;
              }
            }
            db.exec("COMMIT");
            return send(res, 200, { imported: products.length, movements });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/settings" && method === "GET") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          return send(res, 200, { settings: currentShopSettings() });
        }
        if (path === "/api/admin/settings" && method === "PUT") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const settings = shopSettingsInput(await body(req));
          db.prepare("UPDATE shop_settings SET body=? WHERE id=1").run(JSON.stringify(settings));
          return send(res, 200, { settings });
        }
        if (path === "/api/admin/coupons" && method === "GET") {
          requirePermission("catalog");
          return send(res, 200, { coupons: db.prepare("SELECT code,percent,min_total AS minTotal,max_uses AS maxUses,used_count AS usedCount,valid_until AS validUntil,active FROM coupons ORDER BY code").all().map((coupon) => ({ ...coupon, active: Boolean(coupon.active) })) });
        }
        if (path === "/api/admin/coupons" && ["POST", "PATCH"].includes(method)) {
          requirePermission("catalog");
          const coupon = couponInput(await body(req));
          const existing = db.prepare("SELECT code FROM coupons WHERE code=?").get(coupon.code);
          if (method === "PATCH" && !existing) fail("COUPON_NOT_FOUND", 404);
          if (method === "POST" && existing) fail("COUPON_EXISTS", 409);
          db.prepare("INSERT INTO coupons(code,percent,min_total,max_uses,used_count,valid_until,active) VALUES(?,?,?,?,0,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,min_total=excluded.min_total,max_uses=excluded.max_uses,valid_until=excluded.valid_until,active=excluded.active")
            .run(coupon.code, coupon.percent, coupon.minTotal, coupon.maxUses, coupon.validUntil, coupon.active ? 1 : 0);
          return send(res, method === "POST" ? 201 : 200, { coupon });
        }
        if (path === "/api/admin/projects" && method === "GET") {
          requirePermission("catalog");
          return send(res, 200, { projects: allProjects() });
        }
        if (path === "/api/admin/projects" && ["POST", "PATCH"].includes(method)) {
          requirePermission("catalog");
          const project = projectInput(await body(req));
          if (!project.components.every((item) => allProducts().some((product) => product.id === item.productId)))
            fail("INVALID_PROJECT_COMPONENT");
          const existing = storedProject(project.id);
          if (method === "PATCH" && (!existing || existing.deleted)) fail("PROJECT_NOT_FOUND", 404);
          if (method === "POST" && existing && !existing.deleted) fail("PROJECT_EXISTS", 409);
          db.prepare("INSERT INTO store_projects(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
            .run(project.id, JSON.stringify(project));
          return send(res, method === "POST" ? 201 : 200, { project });
        }
        if (path === "/api/admin/projects" && method === "DELETE") {
          requirePermission("catalog");
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_PROJECT");
          db.exec("BEGIN IMMEDIATE");
          try {
            const existing = storedProject(input.id);
            if (!existing || existing.deleted) fail("PROJECT_NOT_FOUND", 404);
            db.prepare("UPDATE store_projects SET body=? WHERE id=?")
              .run(JSON.stringify({ id: input.id, deleted: true }), input.id);
            db.prepare("DELETE FROM saved_projects WHERE project_id=?").run(input.id);
            db.exec("COMMIT");
            return send(res, 200, { deleted: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/products" && method === "POST") {
          requirePermission("catalog");
          const product = productInput(await body(req));
          const existing = db
            .prepare("SELECT deleted FROM product_data WHERE id=?")
            .get(product.id);
          if (existing && !existing.deleted) fail("PRODUCT_EXISTS", 409);
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare(
              "INSERT INTO inventory(id,price,old_price,stock) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET price=excluded.price,old_price=excluded.old_price,stock=excluded.stock",
            ).run(product.id, product.price, product.oldPrice, product.stock);
            db.prepare(
              "INSERT INTO product_data(id,body,deleted) VALUES(?,?,0) ON CONFLICT(id) DO UPDATE SET body=excluded.body,deleted=0",
            ).run(product.id, JSON.stringify(product));
            db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
              .run(randomUUID(), product.id, product.stock, "initial_stock", null, new Date().toISOString());
            db.exec("COMMIT");
            return send(res, 201, { product });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/products" && method === "DELETE") {
          requirePermission("catalog");
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_PRODUCT");
          const exists = db
            .prepare("SELECT id FROM product_data WHERE id=? AND deleted=0")
            .get(input.id);
          if (!exists) fail("PRODUCT_NOT_FOUND", 404);
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare("UPDATE product_data SET deleted=1 WHERE id=?").run(
              input.id,
            );
            db.prepare("DELETE FROM reviews WHERE product_id=?").run(input.id);
            db.exec("COMMIT");
            return send(res, 200, { deleted: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/orders" && method === "GET") {
          requirePermission("orders");
          return send(res, 200, {
            orders: db
              .prepare("SELECT body FROM orders ORDER BY rowid DESC")
              .all()
              .map((row) => JSON.parse(row.body)),
          });
        }
        if (path === "/api/admin/orders" && method === "PATCH") {
          requirePermission("orders");
          const input = await body(req);
          if (
            typeof input.id !== "string" ||
            !["processing", "confirmed", "shipped", "delivered", "cancelled", "returned"].includes(
              input.status,
            )
          )
            fail("INVALID_ORDER_STATUS");
          if (input.trackingNumber != null && typeof input.trackingNumber !== "string") fail("INVALID_INPUT");
          const trackingNumber = input.trackingNumber == null ? null : input.trackingNumber.trim();
          if (trackingNumber?.length > 80) fail("INVALID_INPUT");
          db.exec("BEGIN IMMEDIATE");
          try {
            const row = db
              .prepare("SELECT id,body,status FROM orders WHERE id=?")
              .get(input.id);
            if (!row) fail("ORDER_NOT_FOUND", 404);
            if (row.status !== input.status) {
              const transitions = {
                processing: ["confirmed", "cancelled"],
                confirmed: ["shipped", "cancelled"],
                shipped: ["delivered"],
                cancelled: ["processing"],
                delivered: [],
                returned: [],
              };
              if (!transitions[row.status]?.includes(input.status))
                fail("INVALID_ORDER_TRANSITION", 409);
              if (input.status === "shipped" && !trackingNumber)
                fail("TRACKING_REQUIRED");
              const order = JSON.parse(row.body);
              if (row.status === "cancelled" && input.status !== "cancelled") {
                for (const item of order.items) {
                  const stock = db
                    .prepare("SELECT stock FROM inventory WHERE id=?")
                    .get(item.id);
                  if (!stock || stock.stock < item.quantity)
                    fail("OUT_OF_STOCK", 409);
                }
                for (const item of order.items) {
                  db.prepare(
                    "UPDATE inventory SET stock=stock-? WHERE id=?",
                  ).run(item.quantity, item.id);
                  db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
                    .run(randomUUID(), item.id, -item.quantity, "order_reopened", order.id, new Date().toISOString());
                }
              } else if (["processing", "confirmed"].includes(row.status) && input.status === "cancelled") {
                for (const item of order.items) {
                  db.prepare(
                    "UPDATE inventory SET stock=stock+? WHERE id=?",
                  ).run(item.quantity, item.id);
                  db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
                    .run(randomUUID(), item.id, item.quantity, "order_cancelled", order.id, new Date().toISOString());
                }
              }
              order.status = input.status;
              order.statusHistory = [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), { status: input.status, date: new Date().toISOString() }];
              if (trackingNumber !== null) order.trackingNumber = trackingNumber;
              db.prepare("UPDATE orders SET status=?,body=? WHERE id=?").run(
                input.status,
                JSON.stringify(order),
                input.id,
              );
            }
            if (trackingNumber !== null && row.status === input.status) {
              const order = JSON.parse(row.body);
              if ((order.trackingNumber || "") !== trackingNumber) {
                order.trackingNumber = trackingNumber;
                order.statusHistory = [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), { status: row.status, date: new Date().toISOString(), note: "Номер відстеження оновлено" }];
                db.prepare("UPDATE orders SET body=? WHERE id=?").run(JSON.stringify(order), input.id);
              }
            }
            db.exec("COMMIT");
            return send(res, 200, { saved: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/orders/return" && method === "PATCH") {
          const current = requirePermission("orders");
          const input = await body(req);
          if (typeof input.id !== "string" || !["accepted", "rejected"].includes(input.decision)) fail("INVALID_RETURN_DECISION");
          const decisionNote = input.note ? text(input.note, 300) : "";
          db.exec("BEGIN IMMEDIATE");
          try {
            const row = db.prepare("SELECT id,body,status FROM orders WHERE id=?").get(input.id);
            if (!row) fail("ORDER_NOT_FOUND", 404);
            const order = JSON.parse(row.body);
            if (row.status !== "delivered" || order.returnRequest?.status !== "requested") fail("RETURN_NOT_PENDING", 409);
            const reviewedAt = new Date().toISOString();
            order.returnRequest = {
              ...order.returnRequest,
              status: input.decision,
              reviewedAt,
              reviewedBy: current.name,
              decisionNote,
            };
            if (input.decision === "accepted") {
              order.status = "returned";
              order.statusHistory = [...(Array.isArray(order.statusHistory) ? order.statusHistory : []), {
                status: "returned",
                date: reviewedAt,
                note: "Повернення прийнято після отримання товару",
              }];
              for (const item of order.items) {
                const stock = db.prepare("SELECT id FROM inventory WHERE id=?").get(item.id);
                if (!stock) continue;
                db.prepare("UPDATE inventory SET stock=stock+? WHERE id=?").run(item.quantity, item.id);
                db.prepare("INSERT INTO inventory_movements VALUES(?,?,?,?,?,?)")
                  .run(randomUUID(), item.id, item.quantity, "order_returned", order.id, reviewedAt);
              }
            }
            db.prepare("UPDATE orders SET status=?,body=? WHERE id=?").run(order.status, JSON.stringify(order), order.id);
            db.exec("COMMIT");
            return send(res, 200, { order });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/inventory-movements" && method === "GET") {
          requirePermission("warehouse");
          return send(res, 200, { movements: db.prepare("SELECT id,product_id AS productId,quantity_change AS quantityChange,reason,order_id AS orderId,created_at AS date FROM inventory_movements ORDER BY rowid DESC LIMIT 500").all() });
        }
        if (path === "/api/admin/users" && method === "GET") {
          requirePermission("support");
          return send(res, 200, {
            users: db
              .prepare(
                "SELECT u.id,u.name,u.email,u.role,u.created_at AS createdAt,COUNT(o.id) AS orderCount FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC",
              )
              .all(),
          });
        }
        if (path === "/api/admin/users/role" && method === "PATCH") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const input = await body(req);
          const allowedRoles = ["user", "order_manager", "catalog_manager", "warehouse", "support"];
          if (typeof input.id !== "string" || !allowedRoles.includes(input.role)) fail("INVALID_ROLE");
          if (input.id === user.id) fail("CANNOT_CHANGE_OWN_ROLE", 409);
          const target = db.prepare("SELECT id,role FROM users WHERE id=?").get(input.id);
          if (!target) fail("USER_NOT_FOUND", 404);
          if (target.role === "admin" && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count <= 1)
            fail("LAST_ADMIN", 409);
          db.prepare("UPDATE users SET role=? WHERE id=?").run(input.role, input.id);
          return send(res, 200, { user: { id: target.id, role: input.role } });
        }
        if (path === "/api/admin/users/reset-password" && method === "POST") {
          requireUser();
          if (user.role !== "admin" && user.role !== "support") fail("FORBIDDEN", 403);
          throttle(req);
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_INPUT");
          const target = db
            .prepare("SELECT id FROM users WHERE id=? AND role='user'")
            .get(input.id);
          if (!target) fail("USER_NOT_FOUND", 404);
          const temporaryPassword = randomBytes(15).toString("base64url");
          db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
            await passwordHash(temporaryPassword),
            target.id,
          );
          db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
          return send(res, 200, { temporaryPassword });
        }
        if (path === "/api/admin/reviews" && method === "GET") {
          requirePermission("support");
          return send(res, 200, {
            reviews: db
              .prepare(
                "SELECT r.id,r.product_id AS productId,r.rating,r.text,r.date,r.image_url AS imageUrl,u.name AS userName FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.rowid DESC",
              )
              .all(),
          });
        }
        if (path === "/api/admin/reviews" && method === "DELETE") {
          requirePermission("support");
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_REVIEW");
          const result = db
            .prepare("DELETE FROM reviews WHERE id=?")
            .run(input.id);
          if (!result.changes) fail("REVIEW_NOT_FOUND", 404);
          return send(res, 200, { deleted: true });
        }
        fail("NOT_FOUND", 404);
      }
      if (!["GET", "HEAD"].includes(method)) fail("METHOD_NOT_ALLOWED", 405);
      if (path.startsWith("/admin/")) {
        if (!user) {
          res.writeHead(302, {
            Location: "/login.html?redirect=admin%2Findex.html",
          });
          return res.end();
        }
        if (!["admin", "order_manager", "catalog_manager", "warehouse", "support"].includes(user.role)) fail("FORBIDDEN", 403);
      }
      const decoded = decodeURIComponent(path),
        relative = decoded === "/" ? "index.html" : decoded.replace(/^\//, "");
      const permitted =
        /^[^/]+\.html$/.test(relative) ||
        /^offline-assets\.json$/.test(relative) ||
        /^service-worker\.js$/.test(relative) ||
        /^(favicon\.(svg|ico)|apple-touch-icon\.png)$/.test(relative) ||
        /^admin\/index\.html$/.test(relative) ||
        /^(js|api|css|assets|guides)\/[\w./-]+\.(js|css|jpg|jpeg|png|webp|svg|ino)$/.test(
          relative,
        );
      const file = resolve(root, relative);
      if (!permitted || !file.startsWith(root + sep) || relative.includes(".."))
        fail("NOT_FOUND", 404);
      let contents;
      try {
        contents = await readFile(file);
      } catch {
        fail("NOT_FOUND", 404);
      }
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".ino": "text/plain; charset=utf-8",
      };
      res.writeHead(200, {
        "Content-Type": mime[extname(file)],
        "Cache-Control": "no-cache",
      });
      res.end(method === "HEAD" ? undefined : contents);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) logger.error?.(error);
      send(res, status, {
        error: status === 500 ? "SERVER_ERROR" : error.message,
      });
    }
  });
  return { server, db };
}
