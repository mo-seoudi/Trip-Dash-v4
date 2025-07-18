import { MSGraphIntegration } from "../integrations/ms/MSGraphIntegration.js";
import { GoogleCalendarIntegration } from "../integrations/google/GoogleCalendarIntegration.js";
import { SlackIntegration } from "../integrations/slack/SlackIntegration.js";

export function getCalendarIntegration(tenant) {
  if (!tenant.features?.calendarIntegration) {
    return null;
  }

  if (tenant.integrationProvider === "ms_graph") {
    return new MSGraphIntegration(tenant);
  }

  if (tenant.integrationProvider === "google") {
    return new GoogleCalendarIntegration(tenant);
  }

  return null;
}

export function getSlackIntegration(tenant) {
  if (!tenant.features?.slackIntegration) {
    return null;
  }

  return new SlackIntegration(tenant);
}
