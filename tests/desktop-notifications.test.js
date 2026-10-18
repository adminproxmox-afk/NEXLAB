import assert from "node:assert/strict";
import test from "node:test";
import {
  desktopNotificationsEnabled,
  enableDesktopNotifications,
  setDesktopNotificationsEnabled,
  showDesktopNotification,
} from "../frontend/js/notifications.js";

test("desktop notification consent is per account and can be disabled", async () => {
  const previous = {
    Notification: Object.getOwnPropertyDescriptor(globalThis, "Notification"),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
  };
  const values = new Map();
  class NotificationMock {
    static permission = "granted";
    static requestPermission = async () => "granted";
  }
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: NotificationMock });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  try {
    assert.equal(await enableDesktopNotifications("user-a"), "granted");
    assert.equal(desktopNotificationsEnabled("user-a"), true);
    assert.equal(desktopNotificationsEnabled("user-b"), false);
    assert.equal(setDesktopNotificationsEnabled("user-a", false), true);
    assert.equal(desktopNotificationsEnabled("user-a"), false);
  } finally {
    if (previous.Notification) Object.defineProperty(globalThis, "Notification", previous.Notification);
    else delete globalThis.Notification;
    if (previous.localStorage) Object.defineProperty(globalThis, "localStorage", previous.localStorage);
    else delete globalThis.localStorage;
  }
});

test("desktop alerts are created only in a hidden tab with saved consent", () => {
  const previous = {
    Notification: Object.getOwnPropertyDescriptor(globalThis, "Notification"),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    location: Object.getOwnPropertyDescriptor(globalThis, "location"),
  };
  const values = new Map([["nexlab_desktop_notifications_user-a", "enabled"]]);
  class NotificationMock extends EventTarget {
    static permission = "granted";
    static last;
    constructor(title, options) { super(); this.title = title; this.options = options; NotificationMock.last = this; }
    close() { this.closed = true; }
  }
  let focused = false;
  let navigated = "";
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: NotificationMock });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => values.get(key) ?? null } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { focus: () => { focused = true; } } });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { href: "https://nexlab.test/NEXLAB/profile.html", origin: "https://nexlab.test", assign: (url) => { navigated = url; } },
  });
  try {
    const input = { userId: "user-a", title: "Order update", body: "Order shipped", href: "orders.html", tag: "orders" };
    assert.equal(showDesktopNotification(input), false);
    globalThis.document.hidden = true;
    assert.equal(showDesktopNotification(input), true);
    NotificationMock.last.dispatchEvent(new Event("click"));
    assert.equal(focused, true);
    assert.equal(navigated, "https://nexlab.test/NEXLAB/orders.html");
    assert.equal(NotificationMock.last.closed, true);
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
