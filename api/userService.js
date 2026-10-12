import { request } from "./client.js";
import { setSession } from "../js/session.js";
export async function updateProfile(input) {
  return setSession(await request("profile", { method: "PATCH", body: input }));
}
export async function changePassword(input) {
  return setSession(await request("password", { method: "POST", body: input }));
}
