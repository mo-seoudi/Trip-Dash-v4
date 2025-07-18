export class SlackIntegration {
  constructor(tenantConfig) {
    this.token = tenantConfig.slackToken;
  }

  async sendMessage(channel, message) {
    throw new Error("Slack sendMessage not implemented yet.");
  }
}
