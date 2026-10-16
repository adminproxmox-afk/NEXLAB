import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";
import { listFirebaseDocuments } from "./firebaseStore.js";

export async function getCommunityProjects() {
  if (!isFirebaseConfigured()) return (await request("community-projects")).projects;
  const { db, firestoreSdk } = await getFirebaseServices();
  const projects = await listFirebaseDocuments("community_projects");
  return Promise.all(projects.map(async (project) => {
    const [snapshot, questionSnapshot] = await Promise.all([
      firestoreSdk.getDocs(
        firestoreSdk.collection(db, "community_projects", project.id, "comments"),
      ),
      firestoreSdk.getDocs(
        firestoreSdk.collection(db, "community_projects", project.id, "questions"),
      ),
    ]);
    const comments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const questions = questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return {
      ...project,
      comments: comments.slice(0, 30),
      questions: questions.slice(0, 30),
      rating: comments.length
        ? comments.reduce((sum, item) => sum + item.rating, 0) / comments.length
        : 0,
    };
  }));
}

export async function submitCommunityProject(input) {
  if (!isFirebaseConfigured())
    return (await request("community-projects", { method: "POST", body: input })).project;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const user = auth.currentUser;
  const id = crypto.randomUUID();
  const project = {
    ...input,
    userId: user.uid,
    userName: user.displayName || "Учасник NEXLAB",
    date: new Date().toISOString(),
  };
  await firestoreSdk.setDoc(firestoreSdk.doc(db, "community_projects", id), project);
  return { id, ...project, comments: [], questions: [], rating: 0 };
}

export async function submitCommunityProjectComment({ projectId, rating, text }) {
  if (!isFirebaseConfigured())
    return (await request("community-projects/comments", {
      method: "POST",
      body: { projectId, rating, text },
    })).comment;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const comment = {
    userId: auth.currentUser.uid,
    userName: auth.currentUser.displayName || "Учасник NEXLAB",
    rating,
    text: text.trim(),
    date: new Date().toISOString(),
  };
  const ref = firestoreSdk.doc(
    firestoreSdk.collection(db, "community_projects", projectId, "comments"),
  );
  await firestoreSdk.setDoc(ref, comment);
  return { id: ref.id, ...comment };
}

export async function submitCommunityProjectQuestion({ projectId, text }) {
  if (!isFirebaseConfigured())
    return (await request("community-projects/questions", {
      method: "POST",
      body: { projectId, text },
    })).question;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const question = {
    userId: auth.currentUser.uid,
    userName: auth.currentUser.displayName || "Учасник NEXLAB",
    text: text.trim(),
    date: new Date().toISOString(),
  };
  const ref = firestoreSdk.doc(
    firestoreSdk.collection(db, "community_projects", projectId, "questions"),
  );
  await firestoreSdk.setDoc(ref, question);
  return { id: ref.id, projectId, ...question };
}

export async function answerCommunityProjectQuestion({ questionId, projectId, answer }) {
  if (!isFirebaseConfigured())
    return (await request("community-projects/questions/answer", {
      method: "PATCH",
      body: { id: questionId, answer },
    })).question;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const result = {
    answer: answer.trim(),
    answeredBy: auth.currentUser.displayName || "Учасник NEXLAB",
    answeredAt: new Date().toISOString(),
  };
  await firestoreSdk.updateDoc(
    firestoreSdk.doc(db, "community_projects", projectId, "questions", questionId),
    result,
  );
  return { id: questionId, projectId, ...result };
}
