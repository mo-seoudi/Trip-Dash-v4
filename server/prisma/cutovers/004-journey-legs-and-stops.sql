-- V5 journey architecture: recurring booking defaults and dated occurrence routes.
-- Additive cutover. Existing origin/destination/departure/return fields remain for backwards compatibility.

CREATE TABLE IF NOT EXISTS trip_series_journey_legs (
  id TEXT PRIMARY KEY,
  trip_series_id TEXT NOT NULL REFERENCES trip_series(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  label TEXT,
  origin TEXT,
  destination TEXT,
  departure_time TEXT,
  arrival_time TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_series_id, sequence)
);
CREATE INDEX IF NOT EXISTS trip_series_journey_legs_series_idx ON trip_series_journey_legs(trip_series_id, sequence);

CREATE TABLE IF NOT EXISTS trip_series_journey_stops (
  id TEXT PRIMARY KEY,
  journey_leg_id TEXT NOT NULL REFERENCES trip_series_journey_legs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  location TEXT NOT NULL,
  planned_time TEXT,
  passenger_count INTEGER,
  stop_type TEXT NOT NULL DEFAULT 'stop',
  notes TEXT,
  UNIQUE (journey_leg_id, sequence)
);
CREATE INDEX IF NOT EXISTS trip_series_journey_stops_leg_idx ON trip_series_journey_stops(journey_leg_id, sequence);

CREATE TABLE IF NOT EXISTS trip_journey_legs (
  id TEXT PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  source_series_leg_id TEXT REFERENCES trip_series_journey_legs(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  label TEXT,
  origin TEXT,
  destination TEXT,
  departure_time TEXT,
  arrival_time TEXT,
  notes TEXT,
  override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, sequence)
);
CREATE INDEX IF NOT EXISTS trip_journey_legs_trip_idx ON trip_journey_legs(trip_id, sequence);
CREATE INDEX IF NOT EXISTS trip_journey_legs_source_idx ON trip_journey_legs(source_series_leg_id);

CREATE TABLE IF NOT EXISTS trip_journey_stops (
  id TEXT PRIMARY KEY,
  journey_leg_id TEXT NOT NULL REFERENCES trip_journey_legs(id) ON DELETE CASCADE,
  source_series_stop_id TEXT REFERENCES trip_series_journey_stops(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL,
  location TEXT NOT NULL,
  planned_time TEXT,
  passenger_count INTEGER,
  stop_type TEXT NOT NULL DEFAULT 'stop',
  notes TEXT,
  override BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (journey_leg_id, sequence)
);
CREATE INDEX IF NOT EXISTS trip_journey_stops_leg_idx ON trip_journey_stops(journey_leg_id, sequence);

-- A bus assignment may optionally belong to one leg. Null preserves the existing
-- trip-level assignment behaviour for legacy/single-leg records.
ALTER TABLE trip_bus_assignments
  ADD COLUMN IF NOT EXISTS journey_leg_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_bus_assignments_journey_leg_id_fkey') THEN
    ALTER TABLE trip_bus_assignments
      ADD CONSTRAINT trip_bus_assignments_journey_leg_id_fkey
      FOREIGN KEY (journey_leg_id) REFERENCES trip_journey_legs(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS trip_bus_assignments_journey_leg_idx ON trip_bus_assignments(journey_leg_id);
