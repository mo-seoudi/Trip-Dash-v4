import mongoose from "mongoose";
const { Schema } = mongoose;

const schema = new Schema({}, { strict: false });

const Model = mongoose.model("MongoPartnership", schema);

export class MongoPartnershipRepository {
  async insert(data) {
    const created = new Model(data);
    await created.save();
    return created;
  }

  async findAll() {
    return await Model.find();
  }

  async findById(id) {
    const found = await Model.findById(id);
    if (!found) throw new Error("Entry not found");
    return found;
  }

  async update(id, data) {
    const updated = await Model.findByIdAndUpdate(id, data, { new: true });
    if (!updated) throw new Error("Entry not found");
    return updated;
  }
}