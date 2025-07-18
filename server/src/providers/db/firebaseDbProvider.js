// src/providers/db/firebaseDbProvider.js
import admin from "firebase-admin";

const firebaseApps = new Map(); // Keep initialized apps per tenant

export function getFirebaseConnection(tenantId, firebaseConfig) {
  if (firebaseApps.has(tenantId)) {
    return firebaseApps.get(tenantId);
  }

  const app = admin.initializeApp(
    {
      credential: admin.credential.cert(firebaseConfig.serviceAccount),
      databaseURL: firebaseConfig.databaseURL,
    },
    tenantId
  );

  const connection = {
    app,
    db: app.firestore(),
    auth: app.auth(),
  };

  firebaseApps.set(tenantId, connection);
  return connection;
}
