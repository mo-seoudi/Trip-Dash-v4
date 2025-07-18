// services/tenantProvisioningService.js

import { setupFirebaseTenant } from './firebaseSetup.js';
import { setupMongoTenant } from './mongoSetup.js';
import { setupSQLTenant } from './sqlSetup.js';

export async function setupTenant(tenantData) {
  const { dbType } = tenantData;

  switch (dbType) {
    case 'firebase':
      return await setupFirebaseTenant(tenantData);
    case 'mongo':
      return await setupMongoTenant(tenantData);
    case 'sql':
      return await setupSQLTenant(tenantData);
    default:
      throw new Error(`Unsupported DB type: ${dbType}`);
  }
}
