import Model from "../../models/SQLTrip.js";

export class SQLTripRepository {
  async insert(data) {
    const created = await Model.create(data);
    return created;
  }

  async findAll() {
    return await Model.findAll();
  }

  async findById(id) {
    const found = await Model.findByPk(id);
    if (!found) throw new Error("Entry not found");
    return found;
  }

  async update(id, data) {
    const found = await Model.findByPk(id);
    if (!found) throw new Error("Entry not found");
    await found.update(data);
    return found;
  }
}