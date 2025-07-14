import admin from "../config/firebase.js";

const tripsCollection = admin.firestore().collection("Trips");

// 🟢 Create trip
export async function createTrip(data) {
  const newDoc = await tripsCollection.add(data);
  const doc = await newDoc.get();
  return { id: newDoc.id, ...doc.data() };
}

// 🟢 Update trip status
export async function updateTripStatus(tripId, status) {
  const tripRef = tripsCollection.doc(tripId);
  await tripRef.update({ status });
  const doc = await tripRef.get();
  return { id: doc.id, ...doc.data() };
}

// 🟢 Assign bus
export async function assignBus(tripId, busData) {
  const tripRef = tripsCollection.doc(tripId);
  await tripRef.update({
    busesAssigned: admin.firestore.FieldValue.arrayUnion(busData),
    status: "Confirmed",
  });
  const doc = await tripRef.get();
  return { id: doc.id, ...doc.data() };
}

// 🟢 Find one trip by ID
export async function findTripById(tripId) {
  const doc = await tripsCollection.doc(tripId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// 🟢 Find all trips for an organization
export async function findTripsByOrganization(organizationId) {
  const snapshot = await tripsCollection.where("organizationId", "==", organizationId).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
