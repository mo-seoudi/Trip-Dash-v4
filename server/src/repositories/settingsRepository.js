import admin from "../config/firebase.js";

const settingsCollection = admin.firestore().collection("Settings");

export async function getSettingsByOrganization(organizationId) {
  const snapshot = await settingsCollection.where("organizationId", "==", organizationId).get();

  if (snapshot.empty) {
    return null;
  }

  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function updateSettings(organizationId, newSettings) {
  const snapshot = await settingsCollection.where("organizationId", "==", organizationId).get();

  if (snapshot.empty) {
    // Create new
    const newDoc = await settingsCollection.add({
      organizationId,
      ...newSettings,
    });
    const doc = await newDoc.get();
    return { id: doc.id, ...doc.data() };
  } else {
    // Update existing
    const docRef = snapshot.docs[0].ref;
    await docRef.update(newSettings);
    const updatedDoc = await docRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  }
}
