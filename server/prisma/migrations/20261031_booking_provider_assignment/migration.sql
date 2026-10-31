-- Nullable to preserve historical bookings; new bookings require a provider in the service layer.
ALTER TABLE "bus_bookings" ADD COLUMN IF NOT EXISTS "transport_provider_organization_id" TEXT;
CREATE INDEX IF NOT EXISTS "bus_bookings_transport_provider_organization_id_idx" ON "bus_bookings"("transport_provider_organization_id");
