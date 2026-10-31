-- Apply to the canonical CONTROL_DATABASE_URL database after provider_directory_identity.
-- Preserve legacy provider_operating_regions for backward compatibility.
CREATE TABLE IF NOT EXISTS public.provider_operating_countries (
 organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 country_code TEXT NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
 PRIMARY KEY (organization_id,country_code)
);
CREATE INDEX IF NOT EXISTS provider_operating_countries_country_idx ON public.provider_operating_countries(country_code);
INSERT INTO public.provider_operating_countries(organization_id,country_code)
SELECT o.id,upper(o.country_code) FROM public.organizations o
WHERE o.type='BUS_OPERATOR' AND o.country_code ~* '^[A-Z]{2}$'
ON CONFLICT DO NOTHING;
INSERT INTO public.provider_operating_countries(organization_id,country_code)
SELECT r.organization_id,upper(r.country_code) FROM public.provider_operating_regions r
WHERE r.country_code ~* '^[A-Z]{2}$'
ON CONFLICT DO NOTHING;
