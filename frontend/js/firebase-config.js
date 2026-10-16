// Firebase Web app settings are public client identifiers, not private keys.
// Paste the config from Firebase Console > Project settings > Your apps.
export const firebaseConfig = {
  apiKey: "AIzaSyDgaP4uAIDYx71k2gjHEy1iSBmBUWbL91Y",
  authDomain: "nexlab-e2df4.firebaseapp.com",
  projectId: "nexlab-e2df4",
  storageBucket: "nexlab-e2df4.firebasestorage.app",
  messagingSenderId: "652411265063",
  appId: "1:652411265063:web:2ccbecc4d5e73cfc676e02",
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0,
);

function dataMode() {
  if (typeof location === "undefined") return "firebase";
  const requested = new URLSearchParams(location.search).get("backend");
  if (requested === "local" || requested === "firebase") {
    try { localStorage.setItem("nexlab-backend-mode", requested); } catch {}
    return requested;
  }
  try {
    const saved = localStorage.getItem("nexlab-backend-mode");
    if (saved === "local" || saved === "firebase") return saved;
  } catch {}
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    ? "local"
    : "firebase";
}

// Use the local SQLite API during local development even when the hosted
// Firebase config is present. Add ?backend=firebase to force Firebase locally.
export const firebaseConfigured = () => hasFirebaseConfig && dataMode() === "firebase";
