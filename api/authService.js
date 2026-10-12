import { request } from "./client.js";
import { setSession, logout as endSession } from "../js/session.js";
import { firebaseLogin, firebaseRegister, isFirebaseConfigured } from "./firebaseAuth.js";
export async function register(input) {
  if (isFirebaseConfigured())
    return setSession({ user: await firebaseRegister(input), csrf: "firebase" });
  return setSession(
    await request("auth/register", { method: "POST", body: input }),
  );
}
export async function login(input) {
  if (isFirebaseConfigured())
    return setSession({ user: await firebaseLogin(input), csrf: "firebase" });
  return setSession(
    await request("auth/login", { method: "POST", body: input }),
  );
}
export const authenticate = login;
export const logout = endSession;
