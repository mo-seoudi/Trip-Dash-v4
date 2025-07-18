// Refactored for ESM, tenant-aware, no activeDbConfig
export default function defineTripModel(sequelize, DataTypes) {
  return sequelize.define("Trip", {
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING }
  });
}
