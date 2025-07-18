// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineUserModel(sequelize, DataTypes) {
  return sequelize.define("User", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
