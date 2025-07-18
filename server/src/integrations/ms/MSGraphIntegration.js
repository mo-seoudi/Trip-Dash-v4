import { CalendarIntegration } from "../CalendarIntegration.js";

export class MSGraphIntegration extends CalendarIntegration {
  constructor(tenantConfig) {
    super();
    // Save tenantConfig details (client ID, secret, etc.)
  }

  async createEvent(eventData) {
    throw new Error("MS Graph createEvent not implemented yet.");
  }

  async deleteEvent(eventId) {
    throw new Error("MS Graph deleteEvent not implemented yet.");
  }
}
