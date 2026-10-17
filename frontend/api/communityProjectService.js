import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";

const pageSize = 12;
let localOffset = 0;
let firebaseCursor = null;

export function summarizeCommunityActivity(comments, questions, commentSummary, questionSummary) {
  const ratings = comments.map((comment) => comment.rating).filter(Number.isFinite);
  const rating = commentSummary?.rating ?? (ratings.length
    ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
    : 0);
  return {
    commentCount: commentSummary?.count ?? comments.length,
    commentCountApproximate: !commentSummary,
    questionCount: questionSummary?.count ?? questions.length,
    questionCountApproximate: !questionSummary,
    rating,
    ratingApproximate: !commentSummary,
  };
}

async function loadFirebaseProject(project, { auth, db, firestoreSdk }) {
  const commentsRef = firestoreSdk.collection(db, "community_projects", project.id, "comments");
  const questionsRef = firestoreSdk.collection(db, "community_projects", project.id, "questions");
  const [commentSnapshot, questionSnapshot, commentSummary, questionSummary, ownComment] = await Promise.all([
    firestoreSdk.getDocs(firestoreSdk.query(commentsRef, firestoreSdk.orderBy("date", "desc"), firestoreSdk.limit(30))),
    firestoreSdk.getDocs(firestoreSdk.query(questionsRef, firestoreSdk.orderBy("date", "desc"), firestoreSdk.limit(30))),
    firestoreSdk.getAggregateFromServer(commentsRef, {
      count: firestoreSdk.count(),
      rating: firestoreSdk.average("rating"),
    }).catch(() => null),
    firestoreSdk.getAggregateFromServer(questionsRef, { count: firestoreSdk.count() }).catch(() => null),
    auth.currentUser
      ? firestoreSdk.getDoc(firestoreSdk.doc(commentsRef, auth.currentUser.uid)).catch(() => null)
      : Promise.resolve(null),
  ]);
  const comments = commentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const questions = questionSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const summary = summarizeCommunityActivity(
    comments,
    questions,
    commentSummary?.data(),
    questionSummary?.data(),
  );
  return {
    ...project,
    comments,
    ...summary,
    hasRated: Boolean(ownComment?.exists() || comments.some((comment) => comment.userId === auth.currentUser?.uid)),
    questions,
  };
}

export async function getCommunityProjects({ append = false } = {}) {
  if (!append) {
    localOffset = 0;
    firebaseCursor = null;
  }
  if (!isFirebaseConfigured()) {
    const result = await request(`community-projects?limit=${pageSize}&offset=${localOffset}`);
    localOffset = result.nextOffset;
    return result;
  }
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  const projectCollection = firestoreSdk.collection(db, "community_projects");
  const constraints = [firestoreSdk.orderBy("date", "desc"), firestoreSdk.limit(pageSize + 1)];
  if (firebaseCursor) constraints.splice(1, 0, firestoreSdk.startAfter(firebaseCursor));
  const snapshot = await firestoreSdk.getDocs(firestoreSdk.query(projectCollection, ...constraints));
  const hasMore = snapshot.docs.length > pageSize;
  const projectDocs = snapshot.docs.slice(0, pageSize);
  const nextCursor = projectDocs.at(-1) || null;
  const projects = await Promise.all(projectDocs.map((projectDoc) =>
    loadFirebaseProject({ id: projectDoc.id, ...projectDoc.data() }, { auth, db, firestoreSdk }),
  ));
  firebaseCursor = nextCursor;
  return { projects, hasMore };
}

export async function getCommunityProjectById(id) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    throw Object.assign(new Error("PROJECT_NOT_FOUND"), { status: 404 });
  if (!isFirebaseConfigured())
    return (await request(`community-projects/${encodeURIComponent(id)}`)).project;
  const services = await getFirebaseServices();
  const { db, firestoreSdk } = services;
  const snapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "community_projects", id));
  if (!snapshot.exists()) throw Object.assign(new Error("PROJECT_NOT_FOUND"), { status: 404 });
  return loadFirebaseProject({ id: snapshot.id, ...snapshot.data() }, services);
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
  const ref = firestoreSdk.doc(db, "community_projects", projectId, "comments", auth.currentUser.uid);
  if ((await firestoreSdk.getDoc(ref)).exists()) throw new Error("COMMENT_ALREADY_EXISTS");
  try {
    await firestoreSdk.setDoc(ref, comment);
  } catch (error) {
    if (error.code === "permission-denied" && (await firestoreSdk.getDoc(ref)).exists())
      throw new Error("COMMENT_ALREADY_EXISTS");
    throw error;
  }
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
