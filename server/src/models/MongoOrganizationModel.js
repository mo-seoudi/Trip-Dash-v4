import mongoose from "../providers/db/mongoDbProvider.js";

const Schema = mongoose.Schema;

const ModelSchema = new Schema({
  name: String,
  description: String,
  status: String,
  // Add more fields as needed
}, { timestamps: true });

export default mongoose.model("MongoOrganization", ModelSchema);