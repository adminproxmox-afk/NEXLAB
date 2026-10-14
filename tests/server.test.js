import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../backend/server/app.js";

async function fixture(options = {}) {
  const app = await createApp(options);
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + app.server.address().port;
  const client = () => {
    let cookie = "",
      csrf = "";
    async function call(path, method = "GET", body, extra = {}) {
      const response = await fetch(origin + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: origin,
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.headers.get("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const data = await response.json();
      if (data.csrf) csrf = data.csrf;
      return { status: response.status, data, headers: response.headers };
    }
    return {
      call,
      async init() {
        await call("/api/session");
      },
      async register(address = "test@example.com") {
        await this.init();
        return call("/api/auth/register", "POST", {
          name: "Тестовий користувач",
          email: address,
          password: "sample-password-42",
          terms: true,
          role: "admin",
        });
      },
    };
  };
  return {
    ...app,
    origin,
    client,
    async close() {
      await new Promise((resolve) => app.server.close(resolve));
      app.db.close();
    },
  };
}
const delivery = {
  name: "Тест Одержувач",
  phone: "+380501234567",
  city: "Київ",
  address: "Тестове відділення 1",
  carrier: "nova-poshta",
  payment: "cod",
};
const item = { id: "esp32-devkit", quantity: 2, expectedPrice: 350 };
const submit = (
  client,
  items = [item],
  key = crypto.randomUUID(),
  extra = {},
) =>
  client.call(
    "/api/orders",
    "POST",
    { items, delivery, total: -999, discount: 999999, ...extra },
    { "Idempotency-Key": key },
  );

test("static pages, scripts and assets work; private files are inaccessible", async () => {
  const f = await fixture();
  try {
    for (const path of [
      "/",
      "/checkout.html",
      "/delivery.html",
      "/js/main.js",
      "/api/client.js",
      "/guides/weather-station.ino",
      "/assets/images/products/arduino-uno-front.jpg",
    ])
      assert.equal((await fetch(f.origin + path)).status, 200, path);
    for (const path of [
      "/server/app.js",
      "/.env",
      "/data/nexlab.sqlite",
      "/package.json",
      "/tests/server.test.js",
    ])
      assert.equal((await fetch(f.origin + path)).status, 404, path);
    assert.equal(
      (await fetch(f.origin + "/admin/index.html", { redirect: "manual" }))
        .status,
      302,
    );
  } finally {
    await f.close();
  }
});
test("accounts use password hashes, HttpOnly sessions and server roles", async () => {
  const f = await fixture();
  try {
    const c = f.client(),
      registered = await c.register();
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.role, "user");
    assert.equal(registered.data.user.password, undefined);
    assert.match(registered.headers.get("set-cookie"), /HttpOnly/);
    assert.match(registered.headers.get("set-cookie"), /SameSite=Lax/);
    const stored = f.db.prepare("SELECT password_hash FROM users").get();
    assert.notEqual(stored.password_hash, "sample-password-42");
    assert.match(stored.password_hash, /^[a-f0-9]+:[a-f0-9]+$/);
    assert.equal((await c.call("/api/admin/orders")).status, 403);
    assert.equal(
      (
        await c.call("/api/auth/register", "POST", {
          name: "Other",
          email: "test@example.com",
          password: "sample-password-42",
          terms: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await c.call("/api/auth/register", "POST", {
          name: "Other",
          email: "other@example.com",
          password: "short",
          terms: true,
        })
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test("CSRF and cross-origin writes are rejected; login errors do not leak users", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    assert.equal(
      (
        await c.call(
          "/api/profile",
          "PATCH",
          { name: "New", email: "new@example.com" },
          { "X-CSRF-Token": "" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await c.call(
          "/api/profile",
          "PATCH",
          { name: "New", email: "new@example.com" },
          { Origin: "https://foreign.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await c.call("/api/auth/login", "POST", {
          email: "absent@example.com",
          password: "wrong",
        })
      ).data.error,
      "INVALID_CREDENTIALS",
    );
    assert.equal(
      (
        await c.call("/api/auth/login", "POST", {
          email: "test@example.com",
          password: "wrong",
        })
      ).data.error,
      "INVALID_CREDENTIALS",
    );
    assert.equal(
      (
        await c.call("/api/auth/login", "POST", {
          email: "test@example.com",
          password: "sample-password-42",
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});
test("orders recalculate totals, reduce stock once and never seed fake orders", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    assert.deepEqual((await c.call("/api/orders")).data.orders, []);
    const key = crypto.randomUUID(),
      first = await submit(c, [item], key);
    assert.equal(first.status, 201);
    assert.equal(first.data.order.total, 700);
    assert.equal(first.data.order.discount, 0);
    assert.deepEqual(first.data.order.delivery, delivery);
    assert.equal(
      f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock,
      22,
    );
    const again = await submit(c, [item], key);
    assert.equal(again.status, 200);
    assert.equal(again.data.order.id, first.data.order.id);
    assert.equal(
      (await submit(c, [{ ...item, quantity: 1 }], key)).data.error,
      "ORDER_REQUEST_CHANGED",
    );
    assert.equal(
      f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock,
      22,
    );
  } finally {
    await f.close();
  }
});
test("invalid orders, stale prices and stock are rejected without partial changes", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    for (const items of [
      [],
      [{ ...item, quantity: 0 }],
      [{ ...item, quantity: 1.5 }],
      [{ ...item, quantity: 999 }],
      [{ ...item, expectedPrice: 1 }],
      [item, item],
      [{ ...item, id: "missing" }],
    ])
      assert.ok((await submit(c, items)).status >= 400);
    assert.equal(
      (
        await submit(c, [item], crypto.randomUUID(), {
          delivery: { ...delivery, phone: "123" },
        })
      ).data.error,
      "INVALID_PHONE",
    );
    assert.equal(
      (
        await submit(c, [item], crypto.randomUUID(), {
          delivery: { ...delivery, city: "" },
        })
      ).status,
      400,
    );
    f.db.prepare("UPDATE inventory SET price=375 WHERE id=?").run(item.id);
    assert.equal((await submit(c)).data.error, "PRICE_CHANGED");
    assert.equal(
      (await submit(c, [{ ...item, expectedPrice: 375 }])).data.order.total,
      750,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS count FROM orders").get().count,
      1,
    );
  } finally {
    await f.close();
  }
});
test("concurrent checkout cannot oversell the final unit", async () => {
  const f = await fixture();
  try {
    const a = f.client(),
      b = f.client();
    await a.register("a@example.com");
    await b.register("b@example.com");
    f.db.prepare("UPDATE inventory SET stock=1 WHERE id=?").run(item.id);
    const results = await Promise.all([
      submit(a, [{ ...item, quantity: 1 }]),
      submit(b, [{ ...item, quantity: 1 }]),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock,
      0,
    );
  } finally {
    await f.close();
  }
});
test("orders and projects belong to the authenticated account, not a supplied user ID", async () => {
  const f = await fixture();
  try {
    const a = f.client(),
      b = f.client();
    const user = await a.register("a@example.com");
    await b.register("b@example.com");
    await submit(a);
    assert.deepEqual(
      (await b.call("/api/orders?userId=" + user.data.user.id)).data.orders,
      [],
    );
    assert.equal((await f.client().call("/api/orders")).status, 401);
    assert.deepEqual((await a.call("/api/my-projects")).data.projects, []);
    await a.call("/api/my-projects", "POST", { projectId: "weather-station" });
    await a.call("/api/my-projects", "POST", { projectId: "weather-station" });
    let saved = (await a.call("/api/my-projects")).data.projects;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].progress, 0);
    assert.deepEqual(saved[0].checklist, [false, false, false, false]);
    assert.equal(
      (
        await a.call("/api/my-projects", "PATCH", {
          projectId: "weather-station",
          checklist: [true, false, true, false],
        })
      ).status,
      200,
    );
    saved = (await a.call("/api/my-projects")).data.projects;
    assert.equal(saved[0].progress, 50);
    assert.deepEqual(saved[0].checklist, [true, false, true, false]);
    assert.equal(
      (
        await a.call("/api/my-projects", "PATCH", {
          projectId: "weather-station",
          checklist: [true],
        })
      ).status,
      400,
    );
    assert.deepEqual((await b.call("/api/my-projects")).data.projects, []);
    assert.equal(
      (
        await a.call("/api/my-projects", "DELETE", {
          projectId: "weather-station",
        })
      ).status,
      200,
    );
    assert.deepEqual((await a.call("/api/my-projects")).data.projects, []);
  } finally {
    await f.close();
  }
});
test("review count and average come from actual reviews; validation rejects invalid entries", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    const product = () =>
      c
        .call("/api/products")
        .then((result) => result.data.products.find((p) => p.id === item.id));
    assert.equal((await product()).reviewsCount, 0);
    for (const rating of [5, 3])
      assert.equal(
        (
          await c.call("/api/reviews", "POST", {
            productId: item.id,
            rating,
            text: "Тестовий відгук",
          })
        ).status,
        201,
      );
    assert.equal((await product()).reviewsCount, 2);
    assert.equal((await product()).rating, 4);
    assert.equal(
      (await c.call("/api/reviews?productId=" + item.id)).data.reviews.length,
      2,
    );
    assert.equal(
      (
        await c.call("/api/reviews", "POST", {
          productId: item.id,
          rating: 6,
          text: "bad",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await c.call("/api/reviews", "POST", {
          productId: item.id,
          rating: 4,
          text: " ",
        })
      ).status,
      400,
    );
  } finally {
    await f.close();
  }
});
test("password change revokes other sessions; logout revokes its session", async () => {
  const f = await fixture();
  try {
    const a = f.client(),
      b = f.client();
    await a.register();
    await b.init();
    await b.call("/api/auth/login", "POST", {
      email: "test@example.com",
      password: "sample-password-42",
    });
    assert.equal(
      (
        await a.call("/api/password", "POST", {
          currentPassword: "sample-password-42",
          newPassword: "new-sample-password-42",
        })
      ).status,
      200,
    );
    assert.equal((await b.call("/api/orders")).status, 401);
    assert.equal((await a.call("/api/orders")).status, 200);
    await a.call("/api/auth/logout", "POST", {});
    assert.equal((await a.call("/api/orders")).status, 401);
  } finally {
    await f.close();
  }
});
test("admin inventory editing is authorized; project prices match current component prices", async () => {
  const f = await fixture({
    adminEmail: "admin@example.com",
    adminPassword: "admin-sample-password-42",
  });
  try {
    const c = f.client();
    await c.init();
    await c.call("/api/auth/login", "POST", {
      email: "admin@example.com",
      password: "admin-sample-password-42",
    });
    assert.equal(
      (
        await c.call("/api/admin/products", "PATCH", {
          id: item.id,
          price: 400,
          oldPrice: 500,
          stock: 20,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await c.call("/api/admin/products", "PATCH", {
          id: item.id,
          price: -1,
          oldPrice: null,
          stock: 20,
        })
      ).status,
      400,
    );
    const products = (await c.call("/api/products")).data.products,
      projects = (await c.call("/api/projects")).data.projects;
    for (const project of projects)
      assert.equal(
        project.estimatedPrice,
        project.components.reduce(
          (sum, part) =>
            sum +
            products.find((p) => p.id === part.productId).price * part.quantity,
          0,
        ),
      );
    assert.equal((await c.call("/api/admin/orders")).status, 200);
  } finally {
    await f.close();
  }
});
test("admin cancellation, reopening and confirmed returns adjust stock exactly once", async () => {
  const f = await fixture({
    adminEmail: "admin@example.com",
    adminPassword: "admin-sample-password-42",
  });
  try {
    const customer = f.client(),
      admin = f.client();
    await customer.register();
    await admin.init();
    await admin.call("/api/auth/login", "POST", {
      email: "admin@example.com",
      password: "admin-sample-password-42",
    });
    const created = await submit(customer);
    assert.equal(created.status, 201);
    const id = created.data.order.id;
    const stock = () =>
      f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock;
    const change = (status) =>
      admin.call("/api/admin/orders", "PATCH", { id, status });
    assert.equal(stock(), 22);
    assert.equal((await change("cancelled")).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("cancelled")).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("processing")).status, 200);
    assert.equal(stock(), 22);
    assert.equal((await change("delivered")).status, 200);
    assert.equal(stock(), 22);
    assert.equal((await change("cancelled")).status, 409);
    assert.equal(stock(), 22);
    assert.equal((await change("returned")).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("processing")).status, 409);
    assert.equal(stock(), 24);
    assert.equal(
      (await customer.call("/api/orders")).data.orders[0].status,
      "returned",
    );
  } finally {
    await f.close();
  }
});
test("admin password reset revokes sessions and issues a usable temporary password", async () => {
  const f = await fixture({
    adminEmail: "admin@example.com",
    adminPassword: "admin-sample-password-42",
  });
  try {
    const customer = f.client(),
      admin = f.client();
    await customer.register();
    await admin.init();
    const adminLogin = await admin.call("/api/auth/login", "POST", {
      email: "admin@example.com",
      password: "admin-sample-password-42",
    });
    const userId = (await customer.call("/api/session")).data.user.id;
    assert.equal(
      (
        await admin.call("/api/admin/users/reset-password", "POST", {
          id: adminLogin.data.user.id,
        })
      ).status,
      404,
    );
    const reset = await admin.call("/api/admin/users/reset-password", "POST", {
      id: userId,
    });
    assert.equal(reset.status, 200);
    assert.equal(typeof reset.data.temporaryPassword, "string");
    assert.ok(reset.data.temporaryPassword.length >= 10);
    assert.equal((await customer.call("/api/orders")).status, 401);
    const fresh = f.client();
    await fresh.init();
    assert.equal(
      (
        await fresh.call("/api/auth/login", "POST", {
          email: "test@example.com",
          password: reset.data.temporaryPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fresh.call("/api/auth/login", "POST", {
          email: "test@example.com",
          password: "sample-password-42",
        })
      ).data.error,
      "INVALID_CREDENTIALS",
    );
  } finally {
    await f.close();
  }
});
test("accounts and orders survive a server restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nexlab-test-")),
    dbPath = join(dir, "store.sqlite");
  let f = await fixture({ dbPath });
  try {
    const a = f.client();
    await a.register();
    await submit(a);
    await f.close();
    f = await fixture({ dbPath });
    const b = f.client();
    await b.init();
    assert.equal(
      (
        await b.call("/api/auth/login", "POST", {
          email: "test@example.com",
          password: "sample-password-42",
        })
      ).status,
      200,
    );
    assert.equal((await b.call("/api/orders")).data.orders.length, 1);
  } finally {
    await f.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
