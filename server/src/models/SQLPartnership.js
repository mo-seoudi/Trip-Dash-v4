// Refactored for ESM, tenant-aware, no activeDbConfig
export default function definePartnershipModel(sequelize, DataTypes) {
  return sequelize.define("Partnership", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
