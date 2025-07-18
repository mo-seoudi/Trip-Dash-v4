// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineFinanceModel(sequelize, DataTypes) {
  return sequelize.define("Finance", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
