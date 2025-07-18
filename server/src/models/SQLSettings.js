// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineSettingsModel(sequelize, DataTypes) {
  return sequelize.define("Settings", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
