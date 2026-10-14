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

export const firebaseConfigured = () =>
  Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
