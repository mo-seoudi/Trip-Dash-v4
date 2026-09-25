BEGIN;

CREATE TABLE IF NOT EXISTS control.user_permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES control.app_users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES control.permissions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES control.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_grants_user_permission_org_key UNIQUE (user_id, permission_id, organization_id)
);

CREATE INDEX IF NOT EXISTS user_permission_grants_user_org_active_idx
  ON control.user_permission_grants(user_id, organization_id, is_active);
CREATE INDEX IF NOT EXISTS user_permission_grants_organization_idx
  ON control.user_permission_grants(organization_id);

COMMIT;
