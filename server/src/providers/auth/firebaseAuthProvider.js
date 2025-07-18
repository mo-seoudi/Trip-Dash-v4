import { getFirebaseConnection } from "../db/firebaseDbProvider.js";

export async function verifyToken(token, tenantConfig, tenantId) {
  const { auth } = getFirebaseConnection(tenantId, tenantConfig.firebase);
  return await auth.verifyIdToken(token);
}

export async function login(email, password, tenantConfig, tenantId) {
  const { db } = getFirebaseConnection(tenantId, tenantConfig.firebase);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${tenantConfig.firebase.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const userDoc = await db.collection("users").doc(data.localId).get();
  if (!userDoc.exists) throw new Error("Profile not found");

  const userData = userDoc.data();
  if (userData.status !== "approved") throw new Error("User not approved");

  return {
    token: data.idToken,
    user: userData,
  };
}
