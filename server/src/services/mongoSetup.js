// services/mongoSetup.js

import { MongoClient } from 'mongodb';

export async function setupMongoTenant({ tenantId, organizationId, adminEmail }) {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  await client.connect();
  const db = client.db(tenantId); // Each tenant gets its own DB

  await db.collection('organizations').insertOne({
    _id: organizationId,
    name: organizationId,
    type: 'school',
  });

  await db.collection('users').insertOne({
    email: adminEmail,
    tenantId,
    organizationId,
    role: 'admin',
  });

  await client.close();

  return { success: true };
}
