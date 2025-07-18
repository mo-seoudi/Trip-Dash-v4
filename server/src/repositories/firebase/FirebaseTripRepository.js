import { getFirebaseConnection } from "../../providers/db/firebaseDbProvider.js";

export class FirebaseTripRepository {
  async insert(data) {
    const ref = await admin.firestore().collection("trips").add({
      ...data,
      createdAt: new Date(),
    });
    return { id: ref.id, ...data };
  }

  async findAll() {
    const snapshot = await admin.firestore().collection("trips").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async findById(id) {
    const doc = await admin.firestore().collection("trips").doc(id).get();
    if (!doc.exists) throw new Error("Trip not found");
    return { id: doc.id, ...doc.data() };
  }

  async update(id, data) {
    const ref = admin.firestore().collection("trips").doc(id);
    await ref.update(data);
    const updatedDoc = await ref.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  }
}