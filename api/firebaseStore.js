import { getFirebaseServices } from "./firebaseAuth.js";

export async function listFirebaseDocuments(collectionName) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const snapshot = await firestoreSdk.getDocs(
    firestoreSdk.collection(db, collectionName),
  );
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function getFirebaseDocument(collectionName, id) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const snapshot = await firestoreSdk.getDoc(
    firestoreSdk.doc(db, collectionName, id),
  );
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveFirebaseDocument(collectionName, id, value) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const { id: _ignored, ...data } = value;
  await firestoreSdk.setDoc(
    firestoreSdk.doc(db, collectionName, id),
    data,
  );
  return { id, ...data };
}

export async function deleteFirebaseDocument(collectionName, id) {
  const { db, firestoreSdk } = await getFirebaseServices();
  await firestoreSdk.deleteDoc(firestoreSdk.doc(db, collectionName, id));
}

export async function listFirebaseQuery(collectionName, field, value) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const snapshot = await firestoreSdk.getDocs(
    firestoreSdk.query(
      firestoreSdk.collection(db, collectionName),
      firestoreSdk.where(field, "==", value),
    ),
  );
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function updateFirebaseDocument(collectionName, id, value) {
  const { db, firestoreSdk } = await getFirebaseServices();
  await firestoreSdk.updateDoc(
    firestoreSdk.doc(db, collectionName, id),
    value,
  );
}
