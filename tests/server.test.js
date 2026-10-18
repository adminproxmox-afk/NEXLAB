import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../backend/server/app.js";
import { products } from "../frontend/js/products.js";

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

test("demo coupon is available in a new local database and enforces its minimum", async () => {
  const f = await fixture();
  try {
    const client = f.client();
    await client.init();
    const valid = await client.call("/api/coupons/validate", "POST", {
      code: "nexlab10",
      subtotal: 1000,
      bundleDiscount: 0,
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.data.coupon.discount, 100);

    const belowMinimum = await client.call("/api/coupons/validate", "POST", {
      code: "NEXLAB10",
      subtotal: 999,
      bundleDiscount: 0,
    });
    assert.equal(belowMinimum.status, 422);

    await client.register();
    const order = await submit(
      client,
      [{ ...item, quantity: 4 }],
      crypto.randomUUID(),
      { couponCode: "NEXLAB10" },
    );
    assert.equal(order.status, 201);
    assert.equal(order.data.order.couponDiscount, 140);
    assert.equal(order.data.order.total, 1260);
    assert.equal(f.db.prepare("SELECT used_count FROM coupons WHERE code='NEXLAB10'").get().used_count, 1);
  } finally {
    await f.close();
  }
});

test("static pages, scripts and assets work; private files are inaccessible", async () => {
  const f = await fixture();
  try {
    const home = await fetch(f.origin + "/");
    assert.match(home.headers.get("content-security-policy"), /img-src 'self' https: data:/);
    for (const path of [
      "/",
      "/checkout.html",
      "/delivery.html",
      "/sitemap.xml",
      "/manifest.webmanifest",
      "/js/main.js",
      "/api/client.js",
      "/guides/weather-station.ino",
      "/assets/images/products/arduino-uno-front.webp",
    ])
      assert.equal((await fetch(f.origin + path)).status, 200, path);
    const appManifest = await fetch(f.origin + "/manifest.webmanifest");
    assert.match(appManifest.headers.get("content-type"), /application\/manifest\+json/);
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
    const offlineManifest = await fetch(f.origin + "/offline-assets.json");
    assert.equal(offlineManifest.status, 200);
    const offlineAssets = await offlineManifest.json();
    assert.ok(offlineAssets.includes("index.html"));
    assert.ok(offlineAssets.includes("offline.html"));
    assert.ok(offlineAssets.includes("service-worker.js"));
    assert.ok(offlineAssets.includes("manifest.webmanifest"));
    assert.ok(offlineAssets.includes("assets/images/app-icon-192.png"));
    const offlineResponses = await Promise.all(
      offlineAssets.map((asset) => fetch(`${f.origin}/${asset}`)),
    );
    const unavailable = offlineAssets.filter(
      (_, index) => !offlineResponses[index].ok,
    );
    assert.deepEqual(unavailable, []);
    assert.match(await (await fetch(f.origin + "/sitemap.xml")).text(), /<urlset/);
  } finally {
    await f.close();
  }
});
test("legacy catalog photo paths are repaired to their existing product assets", async () => {
  const f = await fixture();
  try {
    const row = f.db.prepare("SELECT body FROM product_data WHERE id=?").get("esp32-devkit");
    const product = JSON.parse(row.body);
    product.images = ["assets/images/esp32-devkit.jpg"];
    f.db.prepare("UPDATE product_data SET body=? WHERE id=?").run(JSON.stringify(product), product.id);

    const response = await fetch(f.origin + "/api/products");
    assert.equal(response.status, 200);
    const saved = (await response.json()).products.find((item) => item.id === product.id);
    assert.deepEqual(saved.images, ["assets/images/products/esp32-devkit.webp"]);
    assert.equal((await fetch(f.origin + "/assets/images/products/esp32-devkit.webp")).status, 200);
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
test("concurrent retries of one checkout request create only one order", async () => {
  const f = await fixture();
  try {
    const c = f.client();
    await c.register();
    const stockBefore = f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock;
    const key = crypto.randomUUID();
    const results = await Promise.all([
      submit(c, [item], key),
      submit(c, [item], key),
    ]);

    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 201]);
    assert.equal(results[0].data.order.id, results[1].data.order.id);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM orders").get().count, 1);
    assert.equal(
      f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock,
      stockBefore - item.quantity,
    );
    assert.equal(
      f.db.prepare("SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id=? AND reason='order_reserved'").get(item.id).count,
      1,
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
    assert.equal(saved[0].steps.length, 5);
    assert.deepEqual(saved[0].stepChecklist, [false, false, false, false, false]);
    assert.equal(
      (
        await a.call("/api/my-projects", "PATCH", {
          projectId: "weather-station",
          checklist: [true, false, true, false],
          stepChecklist: [true, true, true, false, false],
        })
      ).status,
      200,
    );
    saved = (await a.call("/api/my-projects")).data.projects;
    assert.equal(saved[0].progress, 56);
    assert.deepEqual(saved[0].checklist, [true, false, true, false]);
    assert.deepEqual(saved[0].stepChecklist, [true, true, true, false, false]);
    assert.equal(
      (
        await a.call("/api/my-projects", "PATCH", {
          projectId: "weather-station",
          checklist: [true, false, true, false],
          stepChecklist: [true],
        })
      ).status,
      400,
    );
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
    const c = f.client(), second = f.client();
    await c.register();
    await second.register("second@example.com");
    const product = () =>
      c
        .call("/api/products")
        .then((result) => result.data.products.find((p) => p.id === item.id));
    const photo = `data:image/webp;base64,${Buffer.from("RIFF0000WEBPVP8 ").toString("base64")}`;
    assert.equal((await product()).reviewsCount, 0);
    for (const [author, rating] of [[c, 5], [second, 3]])
      assert.equal(
        (
          await author.call("/api/reviews", "POST", {
            productId: item.id,
            rating,
            text: "Тестовий відгук",
            ...(author === c ? { imageUrl: photo } : {}),
          })
        ).status,
        201,
      );
    assert.equal((await c.call("/api/reviews", "POST", {
      productId: item.id,
      rating: 4,
      text: "Другий відгук з того самого акаунта",
    })).status, 409);
    assert.equal((await product()).reviewsCount, 2);
    assert.equal((await product()).rating, 4);
    assert.equal(
      (await c.call("/api/reviews?productId=" + item.id)).data.reviews.length,
      2,
    );
    assert.equal((await c.call("/api/reviews?productId=" + item.id)).data.reviews.find((review) => review.imageUrl)?.imageUrl, photo);
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
test("concurrent review submissions from the same account create exactly one review", async () => {
  const f = await fixture();
  try {
    const first = f.client();
    await first.register();
    const second = f.client();
    await second.init();
    await second.call("/api/auth/login", "POST", {
      email: "test@example.com",
      password: "sample-password-42",
    });
    const submitReview = (client, rating) => client.call("/api/reviews", "POST", {
      productId: item.id,
      rating,
      text: "Перевірка повторної одночасної відправки",
    });
    const results = await Promise.all([
      submitReview(first, 4),
      submitReview(second, 5),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM reviews WHERE user_id=(SELECT id FROM users WHERE email='test@example.com') AND product_id=?").get(item.id).count, 1);
  } finally {
    await f.close();
  }
});
test("community project questions can be answered by the author but not another member", async () => {
  const f = await fixture();
  try {
    const owner = f.client(), member = f.client();
    await owner.register("owner@example.com");
    await member.register("member@example.com");
    const photo = `data:image/webp;base64,${Buffer.from("RIFF0000WEBPVP8 ").toString("base64")}`;
    const created = await owner.call("/api/community-projects", "POST", {
      title: "Тестова збірка",
      description: "Перевірка запитань і відповідей.",
      photoUrl: photo,
      schematicUrl: "",
      codeUrl: "https://example.com/project.ino",
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.project.photoUrl, photo);
    assert.equal((await owner.call("/api/community-projects", "POST", {
      title: "Некоректне фото",
      description: "Цей проєкт не повинен зберегтися.",
      photoUrl: "data:image/svg+xml,<svg>",
      schematicUrl: "",
      codeUrl: "https://example.com/project.ino",
    })).status, 400);
    const projectId = created.data.project.id;
    const rateProject = (client, rating) => client.call("/api/community-projects/comments", "POST", {
      projectId,
      rating,
      text: "Перевірка оцінки проєкту",
    });
    assert.equal((await rateProject(member, 5)).status, 201);
    assert.equal((await rateProject(member, 4)).status, 409);
    assert.equal((await rateProject(owner, 3)).status, 201);
    const asked = await member.call("/api/community-projects/questions", "POST", {
      projectId,
      text: "Яке живлення потрібно для цієї збірки?",
    });
    assert.equal(asked.status, 201);
    const questionId = asked.data.question.id;
    assert.equal(
      (await member.call("/api/community-projects/questions/answer", "PATCH", {
        id: questionId,
        answer: "Неправильна відповідь",
      })).status,
      403,
    );
    assert.equal(
      (await owner.call("/api/community-projects/questions/answer", "PATCH", {
        id: questionId,
        answer: "Використай стабілізоване живлення 5 V.",
      })).status,
      200,
    );
    const project = (await member.call("/api/community-projects")).data.projects[0];
    assert.equal(project.questions[0].text, "Яке живлення потрібно для цієї збірки?");
    assert.equal(project.questions[0].answer, "Використай стабілізоване живлення 5 V.");
    assert.equal(project.questionCount, 1);
    assert.equal(project.commentCount, 2);
    assert.equal(project.rating, 4);
    assert.equal(project.hasRated, true);
    const detail = await member.call(`/api/community-projects/${encodeURIComponent(projectId)}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.project.title, "Тестова збірка");
    assert.equal(detail.data.project.photoUrl, photo);
    assert.equal(detail.data.project.codeUrl, "https://example.com/project.ino");
    assert.equal(detail.data.project.comments.length, 2);
    assert.equal(detail.data.project.questions[0].answer, "Використай стабілізоване живлення 5 V.");
    assert.equal(detail.data.project.hasRated, true);
    assert.equal((await member.call("/api/community-projects/missing-project")).status, 404);
  } finally {
    await f.close();
  }
});
test("community project listing is paginated with stable offsets", async () => {
  const f = await fixture();
  try {
    const owner = f.client();
    await owner.register("owner@example.com");
    for (const title of ["Збірка A", "Збірка B"]) {
      assert.equal((await owner.call("/api/community-projects", "POST", {
        title,
        description: "Тестова збірка для пагінації.",
        photoUrl: "https://example.com/project.jpg",
        schematicUrl: "",
        codeUrl: "https://example.com/project.ino",
      })).status, 201);
    }
    const first = await owner.call("/api/community-projects?limit=1&offset=0");
    const second = await owner.call("/api/community-projects?limit=1&offset=1");
    assert.equal(first.data.projects.length, 1);
    assert.equal(first.data.hasMore, true);
    assert.equal(first.data.nextOffset, 1);
    assert.equal(second.data.projects.length, 1);
    assert.equal(second.data.hasMore, false);
    assert.equal(second.data.nextOffset, 2);
    assert.notEqual(first.data.projects[0].id, second.data.projects[0].id);
  } finally {
    await f.close();
  }
});
test("employee roles restrict admin API access and warehouse edits to stock", async () => {
  const f = await fixture({ adminEmail: "admin@example.com", adminPassword: "admin-sample-password-42" });
  try {
    const employee = f.client(), admin = f.client();
    const registered = await employee.register("employee@example.com");
    await admin.init();
    await admin.call("/api/auth/login", "POST", {
      email: "admin@example.com",
      password: "admin-sample-password-42",
    });
    assert.equal((await admin.call("/api/admin/users/role", "PATCH", {
      id: registered.data.user.id,
      role: "warehouse",
    })).status, 200);
    assert.equal((await employee.call("/api/session")).data.user.role, "warehouse");
    assert.equal((await employee.call("/api/admin/inventory-movements")).status, 200);
    assert.equal((await employee.call("/api/admin/products/import", "POST", { products: [products[0]] })).status, 403);
    assert.equal((await employee.call("/api/admin/products", "PATCH", {
      id: item.id,
      stock: 7,
    })).status, 200);
    assert.equal(f.db.prepare("SELECT stock FROM inventory WHERE id=?").get(item.id).stock, 7);
    assert.equal((await employee.call("/api/admin/products", "PATCH", {
      id: item.id,
      stock: 8,
      price: 1,
    })).status, 403);
    assert.equal((await employee.call("/api/admin/orders")).status, 403);
    assert.equal((await admin.call("/api/admin/users/role", "PATCH", {
      id: (await admin.call("/api/session")).data.user.id,
      role: "user",
    })).status, 409);
  } finally {
    await f.close();
  }
});
test("restock alerts use an expiring claim and acknowledge only after delivery", async () => {
  const f = await fixture();
  try {
    const customer = f.client();
    await customer.register();
    f.db.prepare("UPDATE inventory SET stock=0 WHERE id=?").run(item.id);
    assert.equal((await customer.call("/api/stock-alerts", "POST", { productId: item.id })).status, 201);
    const claimPath = "/api/stock-alerts/claim";
    const acknowledgePath = "/api/stock-alerts/acknowledge";
    assert.equal((await customer.call(claimPath, "POST", {})).data.alerts.length, 0);
    f.db.prepare("UPDATE inventory SET stock=1 WHERE id=?").run(item.id);
    const first = await customer.call(claimPath, "POST", {});
    assert.equal(first.data.alerts.length, 1);
    assert.equal(first.data.alerts[0].productId, item.id);
    assert.equal((await customer.call(claimPath, "POST", {})).data.alerts.length, 0);
    assert.equal((await customer.call(acknowledgePath, "POST", { alerts: first.data.alerts })).data.acknowledged, 1);
    assert.equal((await customer.call(claimPath, "POST", {})).data.alerts.length, 0);
    f.db.prepare("UPDATE inventory SET stock=0 WHERE id=?").run(item.id);
    assert.equal((await customer.call("/api/stock-alerts", "POST", { productId: item.id })).status, 201);
    f.db.prepare("UPDATE inventory SET stock=1 WHERE id=?").run(item.id);
    const rearmed = await customer.call(claimPath, "POST", {});
    assert.equal(rearmed.data.alerts.length, 1);

    f.db.prepare("UPDATE stock_alerts SET claim_expires_at=? WHERE user_id=? AND product_id=?")
      .run("2000-01-01T00:00:00.000Z", (await customer.call("/api/session")).data.user.id, item.id);
    assert.equal((await customer.call(claimPath, "POST", {})).data.alerts.length, 1);
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
test("catalog import commits the whole batch or rolls every product and stock movement back", async () => {
  const f = await fixture({
    adminEmail: "admin@example.com",
    adminPassword: "admin-sample-password-42",
    logger: { error() {} },
  });
  try {
    const admin = f.client();
    await admin.init();
    await admin.call("/api/auth/login", "POST", {
      email: "admin@example.com",
      password: "admin-sample-password-42",
    });
    const existing = structuredClone(products[0]);
    const imported = { ...structuredClone(products[1]), id: "import-first", sku: "IMPORT-FIRST", stock: 6 };
    const movementsBefore = f.db.prepare("SELECT COUNT(*) AS count FROM inventory_movements").get().count;
    f.db.exec("CREATE TRIGGER fail_catalog_import BEFORE INSERT ON product_data WHEN NEW.id='zz-import-fail' BEGIN SELECT RAISE(ABORT,'test failure'); END;");
    const failed = await admin.call("/api/admin/products/import", "POST", {
      products: [imported, { ...existing, id: "zz-import-fail", sku: "IMPORT-FAIL", stock: 8 }],
    });
    assert.equal(failed.status, 500);
    assert.equal(f.db.prepare("SELECT id FROM product_data WHERE id IN ('import-first','zz-import-fail')").all().length, 0);
    assert.equal(f.db.prepare("SELECT id FROM inventory WHERE id IN ('import-first','zz-import-fail')").all().length, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM inventory_movements").get().count, movementsBefore);

    const invalid = await admin.call("/api/admin/products/import", "POST", {
      products: [imported, { ...existing, stock: -1 }],
    });
    assert.equal(invalid.status, 400);
    assert.equal(f.db.prepare("SELECT id FROM product_data WHERE id='import-first'").all().length, 0);

    const success = await admin.call("/api/admin/products/import", "POST", {
      products: [imported, { ...existing, price: existing.price + 10, stock: existing.stock + 1 }],
    });
    assert.equal(success.status, 200);
    assert.equal(success.data.imported, 2);
    assert.equal(f.db.prepare("SELECT stock FROM inventory WHERE id='import-first'").get().stock, 6);
    assert.equal(f.db.prepare("SELECT price FROM inventory WHERE id=?").get(existing.id).price, existing.price + 10);
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
    const change = (status, trackingNumber) =>
      admin.call("/api/admin/orders", "PATCH", { id, status, trackingNumber });
    assert.equal(stock(), 22);
    assert.equal((await change("cancelled")).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("cancelled")).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("processing")).status, 200);
    assert.equal(stock(), 22);
    assert.equal((await change("confirmed")).status, 200);
    assert.equal((await change("shipped", "TEST-TRACKING-123")).status, 200);
    assert.equal((await change("delivered")).status, 200);
    assert.equal(stock(), 22);
    assert.equal((await change("cancelled")).status, 409);
      assert.equal((await change("returned")).status, 409);
    assert.equal(stock(), 22);
      const stranger = f.client();
      assert.equal((await stranger.register("stranger@example.com")).status, 201);
      assert.equal((await stranger.call("/api/orders/return-request", "POST", { orderId: id, reason: "Не моє замовлення" })).status, 404);
      assert.equal((await customer.call("/api/orders/return-request", "POST", { orderId: id, reason: " " })).status, 400);
      assert.equal((await customer.call("/api/orders/return-request", "POST", { orderId: id, reason: "Пошкоджений корпус" })).status, 201);
      assert.equal(stock(), 22);
      assert.equal((await customer.call("/api/orders/return-request", "POST", { orderId: id, reason: "Повтор" })).status, 409);
      assert.equal((await admin.call("/api/admin/orders/return", "PATCH", { id, decision: "accepted" })).status, 200);
    assert.equal(stock(), 24);
    assert.equal((await change("processing")).status, 409);
    assert.equal(stock(), 24);
      const returnedOrder = (await customer.call("/api/orders")).data.orders[0];
      assert.equal(returnedOrder.status, "returned");
      assert.equal(returnedOrder.returnRequest.status, "accepted");
      assert.equal(returnedOrder.returnRequest.reason, "Пошкоджений корпус");
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
    await a.call("/api/my-projects", "POST", { projectId: "weather-station" });
    await a.call("/api/my-projects", "PATCH", {
      projectId: "weather-station",
      checklist: [true, true, true, true],
      stepChecklist: [true, true, true, true, true],
    });
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
    const savedProjects = (await b.call("/api/my-projects")).data.projects;
    assert.equal(savedProjects.length, 1);
    assert.equal(savedProjects[0].progress, 100);
    assert.deepEqual(savedProjects[0].checklist, [true, true, true, true]);
    assert.deepEqual(savedProjects[0].stepChecklist, [true, true, true, true, true]);
  } finally {
    await f.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
