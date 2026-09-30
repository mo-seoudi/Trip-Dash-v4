-- V5 recurring bookings: parent booking, occurrence linkage, commercial workflow and override metadata.
-- Safe additive cutover. Existing standalone Trip workflow remains intact.

CREATE TABLE IF NOT EXISTS trip_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_app_user_id TEXT,
  owning_school_organization_id TEXT NOT NULL,
  requesting_organization_id TEXT NOT NULL,
  managing_organization_id TEXT,
  transport_provider_organization_id TEXT,
  payer_organization_id TEXT,
  origin TEXT,
  trip_type TEXT,
  destination TEXT,
  departure_time TEXT,
  return_time TEXT,
  students INTEGER,
  staff INTEGER,
  notes TEXT,
  booster_seats_requested BOOLEAN NOT NULL DEFAULT FALSE,
  booster_seat_count INTEGER NOT NULL DEFAULT 0,
  recurrence_type TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 1,
  days_of_week INTEGER[] NOT NULL DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  commercial_status TEXT NOT NULL DEFAULT 'awaiting_quotation',
  approved_quotation_id UUID
);

-- Keep this migration safe for databases where an earlier development version
-- of trip_series was already created without the commercial columns.
ALTER TABLE trip_series
  ADD COLUMN IF NOT EXISTS commercial_status TEXT NOT NULL DEFAULT 'awaiting_quotation',
  ADD COLUMN IF NOT EXISTS approved_quotation_id UUID;

CREATE INDEX IF NOT EXISTS trip_series_created_by_idx ON trip_series(created_by_app_user_id);
CREATE INDEX IF NOT EXISTS trip_series_owning_school_idx ON trip_series(owning_school_organization_id);
CREATE INDEX IF NOT EXISTS trip_series_requesting_org_idx ON trip_series(requesting_organization_id);
CREATE INDEX IF NOT EXISTS trip_series_payer_org_idx ON trip_series(payer_organization_id);
CREATE INDEX IF NOT EXISTS trip_series_status_period_idx ON trip_series(status,start_date,end_date);
CREATE INDEX IF NOT EXISTS trip_series_commercial_status_idx ON trip_series(commercial_status);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS trip_series_id UUID,
  ADD COLUMN IF NOT EXISTS series_occurrence_date DATE,
  ADD COLUMN IF NOT EXISTS series_defaults_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurrence_override BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trips_trip_series_id_fkey') THEN
    ALTER TABLE trips ADD CONSTRAINT trips_trip_series_id_fkey FOREIGN KEY (trip_series_id) REFERENCES trip_series(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS trips_trip_series_id_idx ON trips(trip_series_id);
CREATE UNIQUE INDEX IF NOT EXISTS trips_series_occurrence_unique ON trips(trip_series_id,series_occurrence_date) WHERE trip_series_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trip_series_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_series_id UUID NOT NULL REFERENCES trip_series(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'AED',
  rate_description TEXT,
  submitted_by_app_user_id TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ,
  UNIQUE (trip_series_id, version)
);
CREATE INDEX IF NOT EXISTS trip_series_quotations_series_status_idx ON trip_series_quotations(trip_series_id,status);

CREATE TABLE IF NOT EXISTS trip_series_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_series_id UUID NOT NULL REFERENCES trip_series(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES trip_series_quotations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by_app_user_id TEXT,
  approver_app_user_id TEXT,
  approver_email TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by_app_user_id TEXT,
  decision_note TEXT
);
CREATE INDEX IF NOT EXISTS trip_series_approval_requests_series_status_idx ON trip_series_approval_requests(trip_series_id,status);
CREATE INDEX IF NOT EXISTS trip_series_approval_requests_quotation_status_idx ON trip_series_approval_requests(quotation_id,status);
