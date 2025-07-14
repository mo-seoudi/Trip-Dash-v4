// src/services/tripService.js

import { db } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

/**
 * Fetch all trips
 */
export const getAllTrips = async () => {
  const q = query(collection(db, "trips"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Fetch trips by user name (createdBy)
 */
export const getTripsByUser = async (userName) => {
  const q = query(
    collection(db, "trips"),
    where("createdBy", "==", userName),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Create new trip
 */
export const createTrip = async (tripData) => {
  return await addDoc(collection(db, "trips"), tripData);
};

/**
 * Update trip by ID
 */
export const updateTrip = async (tripId, updates) => {
  return await updateDoc(doc(db, "trips", tripId), updates);
};

/**
 * Delete trip by ID
 */
export const deleteTrip = async (tripId) => {
  return await deleteDoc(doc(db, "trips", tripId));
};

/**
 * Assign buses to a trip (legacy function — for compatibility if needed)
 */
export const assignBusesToTrip = async (tripId, buses) => {
  return await updateDoc(doc(db, "trips", tripId), {
    buses,
    status: "Confirmed",
  });
};

/**
 * Create sub-trips for a given parent trip
 */
export const createSubTrips = async (parentTripId, buses) => {
  const subTripsRef = collection(db, "subTrips");
  const promises = buses.map(async (bus) => {
    return await addDoc(subTripsRef, {
      parentTripId,
      busType: bus.busType,
      busSeats: bus.busSeats,
      tripPrice: bus.tripPrice,
      status: "Pending",
      createdAt: new Date(),
    });
  });
  return Promise.all(promises);
};

/**
 * Get sub-trips by parent trip ID
 */
export const getSubTripsByParent = async (parentTripId) => {
  const q = query(
    collection(db, "subTrips"),
    where("parentTripId", "==", parentTripId),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};


