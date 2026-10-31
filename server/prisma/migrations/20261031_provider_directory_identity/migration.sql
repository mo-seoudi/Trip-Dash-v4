ALTER TABLE "organizations"
 ADD COLUMN IF NOT EXISTS "country_code" TEXT,
 ADD COLUMN IF NOT EXISTS "region_code" TEXT,
 ADD COLUMN IF NOT EXISTS "created_source" TEXT NOT NULL DEFAULT 'platform_admin',
 ADD COLUMN IF NOT EXISTS "claim_status" TEXT NOT NULL DEFAULT 'unclaimed',
 ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'unverified',
 ADD COLUMN IF NOT EXISTS "operational_status" TEXT NOT NULL DEFAULT 'not_activated',
 ADD COLUMN IF NOT EXISTS "directory_visible" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS "provider_operating_regions" (
 "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
 "country_code" TEXT NOT NULL,
 "region_code" TEXT NOT NULL,
 PRIMARY KEY ("organization_id", "country_code", "region_code")
);
CREATE INDEX IF NOT EXISTS "provider_operating_regions_country_code_region_code_idx" ON "provider_operating_regions" ("country_code","region_code");
