// tenantResolver.js

import firebaseDb from "../providers/db/firebaseDbProvider.js";
import { connectMongo } from "../providers/db/mongoDbProvider.js";
import { connectSQL } from "../providers/db/sqlDbProvider.js";

export async function getTenantConfigFromBootstrap(tenantId, bootstrapDbType, bootstrapDbOptions) {
  switch (bootstrapDbType) {
    case "firebase": {
      const db = firebaseDb(); // returns admin.firestore()
      const doc = await db.collection("tenants").doc(tenantId).get();
      if (!doc.exists) {
        throw new Error("Tenant not found in Firebase");
      }
      return { id: doc.id, ...doc.data() };
    }

    case "mongo": {
      const mongoose = await connectMongo(bootstrapDbOptions.uri);
      const schema = new mongoose.Schema({}, { strict: false });
      const Tenant = mongoose.model("Tenant", schema);
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        throw new Error("Tenant not found in MongoDB");
      }
      return tenant.toObject();
    }

    case "sql": {
      const sequelize = connectSQL(bootstrapDbOptions.url);
      const [results] = await sequelize.query("SELECT * FROM tenants WHERE id = ?", {
        replacements: [tenantId],
      });
      if (!results.length) {
        throw new Error("Tenant not found in SQL");
      }
      return results[0];
    }

    default:
      throw new Error("Unsupported bootstrap DB type");
  }
}
