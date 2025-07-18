export default {
  tenantId: String,
  name: String,
  type: String, // 'school', 'school_group', 'bus_company'
  dbConfig: Object,
  brandingConfig: Object,
  featureFlags: {
    ms365Integration: Boolean,
    googleIntegration: Boolean,
    advancedReports: Boolean,
  },
  plan: String,
};