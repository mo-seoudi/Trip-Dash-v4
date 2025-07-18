import { getFirebaseConnection } from "../../providers/db/firebaseDbProvider.js";

export class FirebaseSettingsRepository {
  async insert(data) {
    const ref = await admin.firestore().collection("settings").add({
      ...data,
      createdAt: new Date(),
    });
    return { id: ref.id, ...data };
  }

  async findAll() {
    const snapshot = await admin.firestore().collection("settings").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async findById(id) {
    const doc = await admin.firestore().collection("settings").doc(id).get();
    if (!doc.exists) throw new Error("Settings entry not found");
    return { id: doc.id, ...doc.data() };
  }

  async update(id, data) {
    const ref = admin.firestore().collection("settings").doc(id);
    await ref.update(data);
    const updatedDoc = await ref.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  }
}