// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineTenantModel(sequelize, DataTypes) {
  return sequelize.define("Tenant", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
