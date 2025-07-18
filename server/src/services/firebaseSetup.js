// services/firebaseSetup.js

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export async function setupFirebaseTenant({ tenantId, organizationId, adminEmail }) {
  // 1. Create Firebase user
  const user = await admin.auth().createUser({
    email: adminEmail,
    password: 'Temp12345!', // use secure password generator in prod
  });

  // 2. Set custom claims
  await admin.auth().setCustomUserClaims(user.uid, {
    tenantId,
    organizationId,
    role: 'admin',
  });

  // 3. Seed Firestore data
  await db.doc(`tenants/${tenantId}`).set({
    name: tenantId,
    type: 'firebase',
    createdAt: new Date(),
  });

  await db.doc(`tenants/${tenantId}/orgs/${organizationId}`).set({
    name: organizationId,
    type: 'school',
  });

  await db.doc(`users/${user.uid}`).set({
    email: adminEmail,
    tenantId,
    organizationId,
    role: 'admin',
    createdAt: new Date(),
  });

  return {
    success: true,
    userId: user.uid,
  };
}
