import { getFirebaseConnection } from "../../providers/db/firebaseDbProvider.js";

export class FirebaseUserRepository {
  constructor(config) {}

  async insert(data) {
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
    });

    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: data.email,
      role: data.role,
      status: "pending",
      createdAt: new Date(),
      ...data.extraFields,
    });

    return { uid: userRecord.uid, email: userRecord.email };
  }

  async findAll() {
    const snapshot = await admin.firestore().collection("users").get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async findById(id) {
    const doc = await admin.firestore().collection("users").doc(id).get();
    if (!doc.exists) throw new Error("User not found");
    return { id: doc.id, ...doc.data() };
  }

  async update(id, data) {
    const ref = admin.firestore().collection("users").doc(id);
    await ref.update(data);
    const updatedDoc = await ref.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  }
}