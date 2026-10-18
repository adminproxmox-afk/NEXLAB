import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";

const path = (uid, projectId) => ["users", uid, "userProjects", projectId];
async function currentUid() {
  const { auth } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  return auth.currentUser.uid;
}

export async function ensureFirebaseProject(firestoreSdk, db, reference, projectId) {
  return firestoreSdk.runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists())
      transaction.set(reference, {
        projectId,
        checklist: [],
        stepChecklist: [],
        updatedAt: new Date().toISOString(),
      });
  });
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
    await ensureFirebaseProject(
      firestoreSdk,
      db,
      firestoreSdk.doc(db, collection, ownerId, subcollection, id),
      projectId,
    );
    return { projectId };
  }
  return request("my-projects", { method: "POST", body: { projectId } });
}
export async function updateMyProject(projectId, checklist, stepChecklist = []) {
  if (isFirebaseConfigured()) {
    const uid = await currentUid();
    const { db, firestoreSdk } = await getFirebaseServices();
    const [collection, ownerId, subcollection, id] = path(uid, projectId);
    await firestoreSdk.updateDoc(
      firestoreSdk.doc(db, collection, ownerId, subcollection, id),
      { checklist, stepChecklist, updatedAt: new Date().toISOString() },
    );
    return;
  }
  return request("my-projects", {
    method: "PATCH",
    body: { projectId, checklist, stepChecklist },
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
