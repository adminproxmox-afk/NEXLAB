import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";

const path = (uid, projectId) => ["users", uid, "userProjects", projectId];
async function currentUid() {
  const { auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  return auth.currentUser.uid;
}

export async function getMyProjects() {
  if (isFirebaseConfigured()) {
    const uid = await currentUid();
    const { db, firestoreSdk } = await getFirebaseServices();
    const snapshot = await firestoreSdk.getDocs(
      firestoreSdk.collection(db, "users", uid, "userProjects"),
    );
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  }
  return (await request("my-projects")).projects;
}
export async function saveMyProject(projectId) {
  if (isFirebaseConfigured()) {
    const uid = await currentUid();
    const { db, firestoreSdk } = await getFirebaseServices();
    const [collection, ownerId, subcollection, id] = path(uid, projectId);
    await firestoreSdk.setDoc(
      firestoreSdk.doc(db, collection, ownerId, subcollection, id),
      { projectId, checklist: [], updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { projectId };
  }
  return request("my-projects", { method: "POST", body: { projectId } });
}
export async function updateMyProject(projectId, checklist) {
  if (isFirebaseConfigured()) {
    const uid = await currentUid();
    const { db, firestoreSdk } = await getFirebaseServices();
    const [collection, ownerId, subcollection, id] = path(uid, projectId);
    await firestoreSdk.updateDoc(
      firestoreSdk.doc(db, collection, ownerId, subcollection, id),
      { checklist, updatedAt: new Date().toISOString() },
    );
    return;
  }
  return request("my-projects", {
    method: "PATCH",
    body: { projectId, checklist },
  });
}
export async function deleteMyProject(projectId) {
  if (isFirebaseConfigured()) {
    const uid = await currentUid();
    const { db, firestoreSdk } = await getFirebaseServices();
    const [collection, ownerId, subcollection, id] = path(uid, projectId);
    await firestoreSdk.deleteDoc(
      firestoreSdk.doc(db, collection, ownerId, subcollection, id),
    );
    return;
  }
  return request("my-projects", { method: "DELETE", body: { projectId } });
}
