// controllers/superAdmin.controller.js

import { setupTenant } from '../services/tenantProvisioningService.js';

export async function createTenant(req, res) {
  try {
    const result = await setupTenant(req.body);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
