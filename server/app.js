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
import { products as catalog, categories, projects } from "../js/products.js";
import { shopConfig } from "../js/shop-config.js";

const scrypt = promisify(scryptCallback);
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
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
          ? /^assets\/images\/[\w.-]+\.(jpg|jpeg|png|webp)$/i.test(image)
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
  };
  if (result.steps.length > 20 || !['Легкий', 'Середній', 'Просунутий'].includes(result.difficulty) || !productImages.has(result.image))
    fail("INVALID_PROJECT");
  return result;
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
} = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY,price INTEGER NOT NULL CHECK(price>=0),old_price INTEGER,stock INTEGER NOT NULL CHECK(stock>=0));
    CREATE TABLE IF NOT EXISTS product_data(id TEXT PRIMARY KEY,body TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,body TEXT NOT NULL,UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL,date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS saved_projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,project_id));
    CREATE TABLE IF NOT EXISTS shop_settings(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS store_projects(id TEXT PRIMARY KEY,body TEXT NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO shop_settings(id,body) VALUES(1,?)").run(JSON.stringify(shopConfig));
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
            images: product.images || [],
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
    return db.prepare("SELECT body FROM store_projects ORDER BY rowid").all().map((row) => JSON.parse(row.body));
  }
  async function body(req) {
    if (!(req.headers["content-type"] || "").startsWith("application/json"))
      fail("JSON_REQUIRED", 415);
    let result = "";
    for await (const chunk of req) {
      result += chunk;
      if (Buffer.byteLength(result) > 32768) fail("BODY_TOO_LARGE", 413);
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
      if (path.startsWith("/api/") && !path.endsWith(".js")) {
        if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
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
        if (path === "/api/orders" && method === "POST") {
          requireUser();
          const input = await body(req),
            requestKey = text(req.headers["idempotency-key"], 100);
          const fingerprint = hash(
            JSON.stringify({ items: input.items, delivery: input.delivery }),
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
            const total = items.reduce((s, p) => s + p.price * p.quantity, 0),
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
              items,
              total,
              discount,
              delivery: customer,
              deliveryCost: null,
            };
            items.forEach((item) =>
              db
                .prepare("UPDATE inventory SET stock=stock-? WHERE id=?")
                .run(item.quantity, item.id),
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
                "SELECT r.id,r.product_id AS productId,r.rating,r.text,r.date,u.name AS userName FROM reviews r JOIN users u ON r.user_id=u.id WHERE product_id=? ORDER BY r.rowid DESC",
              )
              .all(url.searchParams.get("productId")),
          });
        if (path === "/api/reviews" && method === "POST") {
          requireUser();
          const input = await body(req);
          if (
            !allProducts().some((p) => p.id === input.productId) ||
            !Number.isInteger(input.rating) ||
            input.rating < 1 ||
            input.rating > 5
          )
            fail("INVALID_RATING");
          const review = {
            id: randomUUID(),
            productId: input.productId,
            rating: input.rating,
            text: text(input.text, 1000),
            date: new Date().toISOString(),
            userName: user.name,
          };
          db.prepare("INSERT INTO reviews VALUES(?,?,?,?,?,?)").run(
            review.id,
            user.id,
            review.productId,
            review.rating,
            review.text,
            review.date,
          );
          return send(res, 201, { review });
        }
        if (path === "/api/my-projects" && method === "GET") {
          requireUser();
          const saved = db
            .prepare(
              "SELECT id,project_id AS projectId,created_at AS createdAt,checklist FROM saved_projects WHERE user_id=? ORDER BY rowid DESC",
            )
            .all(user.id);
          const projectList = allProjects();
          return send(res, 200, {
            projects: saved.map((row) => {
              const components =
                projectList.find((project) => project.id === row.projectId)
                  ?.components || [];
              let checklist = [];
              try {
                checklist = JSON.parse(row.checklist);
              } catch {}
              checklist = components.map(
                (_, index) => checklist[index] === true,
              );
              return {
                ...row,
                checklist,
                progress: components.length
                  ? Math.round(
                      (checklist.filter(Boolean).length / components.length) *
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
            "INSERT OR IGNORE INTO saved_projects(id,user_id,project_id,created_at,checklist) VALUES(?,?,?,?,?)",
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
            !input.checklist.every((value) => typeof value === "boolean")
          )
            fail("INVALID_PROJECT_CHECKLIST");
          const result = db
            .prepare(
              "UPDATE saved_projects SET checklist=? WHERE user_id=? AND project_id=?",
            )
            .run(JSON.stringify(input.checklist), user.id, project.id);
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
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_PRODUCT");
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
            db.prepare(
              "UPDATE inventory SET price=?,old_price=?,stock=? WHERE id=?",
            ).run(product.price, product.oldPrice, product.stock, product.id);
            db.prepare(
              "UPDATE product_data SET body=? WHERE id=? AND deleted=0",
            ).run(JSON.stringify(product), product.id);
            db.exec("COMMIT");
            return send(res, 200, { saved: true });
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
        if (path === "/api/admin/projects" && method === "GET") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          return send(res, 200, { projects: allProjects() });
        }
        if (path === "/api/admin/projects" && ["POST", "PATCH"].includes(method)) {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const project = projectInput(await body(req));
          if (!project.components.every((item) => allProducts().some((product) => product.id === item.productId)))
            fail("INVALID_PROJECT_COMPONENT");
          const existing = db.prepare("SELECT id FROM store_projects WHERE id=?").get(project.id);
          if (method === "PATCH" && !existing) fail("PROJECT_NOT_FOUND", 404);
          if (method === "POST" && existing) fail("PROJECT_EXISTS", 409);
          db.prepare("INSERT INTO store_projects(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body")
            .run(project.id, JSON.stringify(project));
          return send(res, method === "POST" ? 201 : 200, { project });
        }
        if (path === "/api/admin/projects" && method === "DELETE") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const input = await body(req);
          if (typeof input.id !== "string") fail("INVALID_PROJECT");
          db.exec("BEGIN IMMEDIATE");
          try {
            const result = db.prepare("DELETE FROM store_projects WHERE id=?").run(input.id);
            if (!result.changes) fail("PROJECT_NOT_FOUND", 404);
            db.prepare("DELETE FROM saved_projects WHERE project_id=?").run(input.id);
            db.exec("COMMIT");
            return send(res, 200, { deleted: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/products" && method === "POST") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
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
            db.exec("COMMIT");
            return send(res, 201, { product });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/products" && method === "DELETE") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
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
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          return send(res, 200, {
            orders: db
              .prepare("SELECT body FROM orders ORDER BY rowid DESC")
              .all()
              .map((row) => JSON.parse(row.body)),
          });
        }
        if (path === "/api/admin/orders" && method === "PATCH") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          const input = await body(req);
          if (
            typeof input.id !== "string" ||
            !["processing", "delivered", "cancelled", "returned"].includes(
              input.status,
            )
          )
            fail("INVALID_ORDER_STATUS");
          db.exec("BEGIN IMMEDIATE");
          try {
            const row = db
              .prepare("SELECT id,body,status FROM orders WHERE id=?")
              .get(input.id);
            if (!row) fail("ORDER_NOT_FOUND", 404);
            if (row.status !== input.status) {
              const transitions = {
                processing: ["delivered", "cancelled"],
                cancelled: ["processing"],
                delivered: ["returned"],
                returned: [],
              };
              if (!transitions[row.status]?.includes(input.status))
                fail("INVALID_ORDER_TRANSITION", 409);
              const order = JSON.parse(row.body);
              if (row.status === "cancelled" && input.status !== "cancelled") {
                for (const item of order.items) {
                  const stock = db
                    .prepare("SELECT stock FROM inventory WHERE id=?")
                    .get(item.id);
                  if (!stock || stock.stock < item.quantity)
                    fail("OUT_OF_STOCK", 409);
                }
                for (const item of order.items)
                  db.prepare(
                    "UPDATE inventory SET stock=stock-? WHERE id=?",
                  ).run(item.quantity, item.id);
              } else if (
                (row.status === "processing" && input.status === "cancelled") ||
                (row.status === "delivered" && input.status === "returned")
              ) {
                for (const item of order.items)
                  db.prepare(
                    "UPDATE inventory SET stock=stock+? WHERE id=?",
                  ).run(item.quantity, item.id);
              }
              order.status = input.status;
              db.prepare("UPDATE orders SET status=?,body=? WHERE id=?").run(
                input.status,
                JSON.stringify(order),
                input.id,
              );
            }
            db.exec("COMMIT");
            return send(res, 200, { saved: true });
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }
        if (path === "/api/admin/users" && method === "GET") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          return send(res, 200, {
            users: db
              .prepare(
                "SELECT u.id,u.name,u.email,u.role,u.created_at AS createdAt,COUNT(o.id) AS orderCount FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC",
              )
              .all(),
          });
        }
        if (path === "/api/admin/users/reset-password" && method === "POST") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
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
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
          return send(res, 200, {
            reviews: db
              .prepare(
                "SELECT r.id,r.product_id AS productId,r.rating,r.text,r.date,u.name AS userName FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.rowid DESC",
              )
              .all(),
          });
        }
        if (path === "/api/admin/reviews" && method === "DELETE") {
          requireUser();
          if (user.role !== "admin") fail("FORBIDDEN", 403);
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
        if (user.role !== "admin") fail("FORBIDDEN", 403);
      }
      const decoded = decodeURIComponent(path),
        relative = decoded === "/" ? "index.html" : decoded.replace(/^\//, "");
      const permitted =
        /^[^/]+\.html$/.test(relative) ||
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
      if (status === 500) console.error(error);
      send(res, status, {
        error: status === 500 ? "SERVER_ERROR" : error.message,
      });
    }
  });
  return { server, db };
}
