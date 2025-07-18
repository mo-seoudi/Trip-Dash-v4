// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineOrganizationModel(sequelize, DataTypes) {
  return sequelize.define("Organization", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
