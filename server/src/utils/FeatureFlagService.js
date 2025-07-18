export function isFeatureEnabled(tenant, featureName) {
  return tenant.features && tenant.features[featureName] === true;
}
