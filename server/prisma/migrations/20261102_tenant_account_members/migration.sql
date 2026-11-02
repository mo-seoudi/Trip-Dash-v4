-- Tenant subscription access is independent of organization operational membership.
CREATE TABLE IF NOT EXISTS "tenant_account_members" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "user_id" TEXT NOT NULL REFERENCES "app_users"("id") ON DELETE RESTRICT,
  "role" TEXT NOT NULL CHECK ("role" IN ('OWNER','BILLING_ADMIN')),
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','revoked')),
  "first_name" TEXT,
  "last_name" TEXT,
  "phone" TEXT,
  "job_title" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_account_members_tenant_id_user_id_key" UNIQUE ("tenant_id","user_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_account_members_one_owner" ON "tenant_account_members"("tenant_id") WHERE "role"='OWNER' AND "status"='active';
CREATE INDEX IF NOT EXISTS "tenant_account_members_user_id_status_idx" ON "tenant_account_members"("user_id","status");
