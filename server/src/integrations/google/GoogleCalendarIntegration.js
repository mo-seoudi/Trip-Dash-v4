import { CalendarIntegration } from "../CalendarIntegration.js";

export class GoogleCalendarIntegration extends CalendarIntegration {
  constructor(tenantConfig) {
    super();
    // Save tenantConfig details (client ID, secret, etc.)
  }

  async createEvent(eventData) {
    throw new Error("Google Calendar createEvent not implemented yet.");
  }

  async deleteEvent(eventId) {
    throw new Error("Google Calendar deleteEvent not implemented yet.");
  }
}
