import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";
import { listFirebaseQuery } from "./firebaseStore.js";

export async function getReviews(productId) {
  if (isFirebaseConfigured()) {
    const reviews = await listFirebaseQuery("reviews", "productId", productId);
    return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return (await request("reviews?productId=" + encodeURIComponent(productId)))
    .reviews;
}
export async function createReview(input) {
  if (isFirebaseConfigured()) {
    const { auth, db, firestoreSdk } = await getFirebaseServices();
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    const id = `${input.productId}__${user.uid}`;
    const review = {
      productId: input.productId,
      userId: user.uid,
      userName: user.displayName || "Користувач",
      rating: input.rating,
      text: input.text.trim(),
      imageUrl: input.imageUrl || null,
      date: new Date().toISOString(),
    };
    await firestoreSdk.setDoc(firestoreSdk.doc(db, "reviews", id), review);
    return { id, ...review };
  }
  return (await request("reviews", { method: "POST", body: input })).review;
}
