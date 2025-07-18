// services/sqlSetup.js

import { Pool } from 'pg';

export async function setupSQLTenant({ tenantId, organizationId, adminEmail }) {
  const pool = new Pool({
    connectionString: process.env.SQL_DB_URL,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'INSERT INTO tenants (id, name) VALUES ($1, $2)',
      [tenantId, tenantId]
    );

    await client.query(
      'INSERT INTO organizations (id, tenant_id, name) VALUES ($1, $2, $3)',
      [organizationId, tenantId, organizationId]
    );

    await client.query(
      'INSERT INTO users (email, tenant_id, organization_id, role) VALUES ($1, $2, $3, $4)',
      [adminEmail, tenantId, organizationId, 'admin']
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
