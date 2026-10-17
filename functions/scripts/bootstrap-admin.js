import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run bootstrap:admin --prefix functions -- <registered-email>");
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "nexlab-e2df4",
});

try {
  const user = await getAuth().getUserByEmail(email);
  await getFirestore().doc(`users/${user.uid}`).set({
    name: user.displayName || email,
    email: user.email || email,
    role: "admin",
    createdAt: user.metadata.creationTime || new Date().toISOString(),
  }, { merge: true });
  console.log(`Admin role assigned to ${email}. Sign out and sign in again to refresh access.`);
} catch (error) {
  if (error.code === "auth/user-not-found") {
    console.error(`No Firebase Authentication account exists for ${email}. Register that account first.`);
  } else {
    console.error(`Could not assign admin role: ${error.message}`);
  }
  process.exitCode = 1;
}
