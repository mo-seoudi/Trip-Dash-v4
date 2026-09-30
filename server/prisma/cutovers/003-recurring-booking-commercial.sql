-- V5 recurring bookings: parent-level commercial workflow and occurrence override metadata.
-- Safe additive migration; existing Trip workflow remains intact.

ALTER TABLE trip_series
  ADD COLUMN IF NOT EXISTS commercial_status TEXT NOT NULL DEFAULT 'awaiting_quotation',
  ADD COLUMN IF NOT EXISTS approved_quotation_id TEXT;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS series_defaults_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurrence_override BOOLEAN NOT NULL DEFAULT FALSE;

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
CREATE INDEX IF NOT EXISTS trip_series_commercial_status_idx ON trip_series(commercial_status);
