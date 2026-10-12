import { request } from "./client.js";
export async function getMyProjects() {
  return (await request("my-projects")).projects;
}
export async function saveMyProject(projectId) {
  return request("my-projects", { method: "POST", body: { projectId } });
}
export async function updateMyProject(projectId, checklist) {
  return request("my-projects", {
    method: "PATCH",
    body: { projectId, checklist },
  });
}
export async function deleteMyProject(projectId) {
  return request("my-projects", { method: "DELETE", body: { projectId } });
}
