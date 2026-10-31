-- Canonical control-plane provider metadata. Apply ONLY after reviewing the read-only audit.
-- This migration is additive: it does not copy, delete, or overwrite legacy public records.
BEGIN;
ALTER TABLE control.organizations
 ADD COLUMN IF NOT EXISTS country_code TEXT,
 ADD COLUMN IF NOT EXISTS region_code TEXT,
 ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'platform_admin',
 ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'unclaimed',
 ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
 ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'not_activated',
 ADD COLUMN IF NOT EXISTS directory_visible BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS control.provider_operating_countries (
 organization_id UUID NOT NULL REFERENCES control.organizations(id) ON DELETE CASCADE,
 country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
 PRIMARY KEY (organization_id, country_code)
);
CREATE INDEX IF NOT EXISTS control_provider_operating_countries_country_idx
 ON control.provider_operating_countries(country_code);

INSERT INTO control.provider_operating_countries(organization_id,country_code)
 SELECT id,upper(country_code) FROM control.organizations
 WHERE type='BUS_OPERATOR' AND country_code ~* '^[A-Z]{2}$'
 ON CONFLICT DO NOTHING;
COMMIT;
