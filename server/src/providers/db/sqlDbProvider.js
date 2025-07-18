import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// ✅ Instead of creating an immediate default instance, we only export a function
export const connectSQL = (dbConfig) => {
  return new Sequelize(dbConfig.url, {
    logging: false,
    ...dbConfig.options,
  });
};
