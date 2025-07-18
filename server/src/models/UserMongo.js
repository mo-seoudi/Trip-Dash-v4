import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: String,
  email: String,
  tenantId: String,
  assignedSchools: [String],
  role: String,
  permissions: [String],
});

export default mongoose.model("User", userSchema);
