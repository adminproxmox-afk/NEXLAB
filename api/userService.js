import { request } from "./client.js";
import { setSession } from "../js/session.js";
import { firebaseChangePassword, firebaseSession, firebaseUpdateProfile, isFirebaseConfigured } from "./firebaseAuth.js";
export async function updateProfile(input) {
  if (isFirebaseConfigured())
    return setSession({ user: await firebaseUpdateProfile(input), csrf: "firebase" });
  return setSession(await request("profile", { method: "PATCH", body: input }));
}
export async function changePassword(input) {
  if (isFirebaseConfigured()) {
    await firebaseChangePassword(input);
    return setSession(await firebaseSession());
  }
  return setSession(await request("password", { method: "POST", body: input }));
}
