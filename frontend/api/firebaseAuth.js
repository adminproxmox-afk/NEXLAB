import { firebaseConfig, firebaseConfigured } from "../js/firebase-config.js";

const sdk = "https://www.gstatic.com/firebasejs/13.0.0/";
let servicesPromise;

export const isFirebaseConfigured = firebaseConfigured;

async function services() {
  if (!firebaseConfigured()) return null;
  if (!servicesPromise)
    servicesPromise = Promise.all([
      import(`${sdk}firebase-app.js`),
      import(`${sdk}firebase-auth.js`),
      import(`${sdk}firebase-firestore.js`),
    ]).then(([appSdk, authSdk, firestoreSdk]) => {
      const app = appSdk.initializeApp(firebaseConfig);
      const auth = authSdk.getAuth(app);
      const db = firestoreSdk.getFirestore(app);
      return { auth, db, authSdk, firestoreSdk };
    });
  return servicesPromise;
}

export async function getFirebaseServices() {
  return services();
}

function mapError(error) {
  const codes = {
    "auth/email-already-in-use": "EMAIL_TAKEN",
    "auth/invalid-credential": "INVALID_CREDENTIALS",
    "auth/user-not-found": "INVALID_CREDENTIALS",
    "auth/wrong-password": "INVALID_CREDENTIALS",
    "auth/weak-password": "PASSWORD_TOO_SHORT",
    "auth/requires-recent-login": "REQUIRES_RECENT_LOGIN",
    "auth/too-many-requests": "TOO_MANY_ATTEMPTS",
    "auth/invalid-email": "INVALID_EMAIL",
  };
  return new Error(
    codes[error.code] || error.code || error.message || "FIREBASE_ERROR",
  );
}

async function profileFor(user, db, firestoreSdk) {
  const snapshot = await firestoreSdk.getDoc(
    firestoreSdk.doc(db, "users", user.uid),
  );
  const profile = snapshot.exists() ? snapshot.data() : {};
  return {
    id: user.uid,
    name: profile.name || user.displayName || "Користувач",
    email: user.email,
    role: profile.role === "admin" ? "admin" : "user",
    createdAt: profile.createdAt || user.metadata.creationTime,
  };
}

export async function firebaseSession() {
  const instance = await services();
  if (!instance) return null;
  const { auth, db, authSdk, firestoreSdk } = instance;
  const user = await new Promise((resolve, reject) => {
    const unsubscribe = authSdk.onAuthStateChanged(
      auth,
      (current) => {
        unsubscribe();
        resolve(current);
      },
      (error) => {
        unsubscribe();
        reject(mapError(error));
      },
    );
  });
  return {
    user: user ? await profileFor(user, db, firestoreSdk) : null,
    csrf: "firebase",
  };
}

export async function firebaseRegister({ name, email, password }) {
  try {
    const { auth, db, authSdk, firestoreSdk } = await services();
    const credential = await authSdk.createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await authSdk.updateProfile(credential.user, { displayName: name });
    await firestoreSdk.setDoc(
      firestoreSdk.doc(db, "users", credential.user.uid),
      {
        name,
        email: credential.user.email,
        role: "user",
        createdAt: new Date().toISOString(),
      },
    );
    return profileFor(credential.user, db, firestoreSdk);
  } catch (error) {
    throw mapError(error);
  }
}

export async function firebaseLogin({ email, password }) {
  try {
    const { auth, authSdk, db, firestoreSdk } = await services();
    const credential = await authSdk.signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return profileFor(credential.user, db, firestoreSdk);
  } catch (error) {
    throw mapError(error);
  }
}

export async function firebaseLogout() {
  const instance = await services();
  if (instance) await instance.authSdk.signOut(instance.auth);
}

export async function firebaseUpdateProfile({ name, email }) {
  try {
    const { auth, db, authSdk, firestoreSdk } = await services();
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    if (email !== user.email) await authSdk.updateEmail(user, email);
    await authSdk.updateProfile(user, { displayName: name });
    await firestoreSdk.setDoc(
      firestoreSdk.doc(db, "users", user.uid),
      { name, email: user.email, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return profileFor(user, db, firestoreSdk);
  } catch (error) {
    throw mapError(error);
  }
}

export async function firebaseChangePassword({ currentPassword, newPassword }) {
  try {
    const { auth, authSdk } = await services();
    const user = auth.currentUser;
    if (!user?.email) throw new Error("UNAUTHENTICATED");
    const credential = authSdk.EmailAuthProvider.credential(
      user.email,
      currentPassword,
    );
    await authSdk.reauthenticateWithCredential(user, credential);
    await authSdk.updatePassword(user, newPassword);
  } catch (error) {
    throw mapError(error);
  }
}

export async function firebaseSendPasswordReset(email) {
  try {
    const { auth, authSdk } = await services();
    await authSdk.sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw mapError(error);
  }
}
