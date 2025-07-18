import { db } from "../../providers/db/firebaseProvider.js";

const collectionName = "organizations";

export const FirebaseOrganizationModel = {
  collection: db.collection(collectionName),

  async create(data) {
    const docRef = await db.collection(collectionName).add(data);
    console.log("Firebase: Organization created with ID:", docRef.id);
    return docRef.id;
  },

  async getById(id) {
    const doc = await db.collection(collectionName).doc(id).get();
    if (!doc.exists) throw new Error("Organization not found");
    return { id: doc.id, ...doc.data() };
  },

  async update(id, data) {
    await db.collection(collectionName).doc(id).update(data);
    console.log("Firebase: Organization updated:", id);
  },

  async delete(id) {
    await db.collection(collectionName).doc(id).delete();
    console.log("Firebase: Organization deleted:", id);
  },
};
