-- Apply to the database configured by CONTROL_DATABASE_URL.
-- Invitation records are independent of tenant subscriptions and school relationships.
CREATE TABLE IF NOT EXISTS public.provider_account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_key TEXT NOT NULL REFERENCES public.roles(key),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cancelled','accepted','expired')),
  delivery_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (delivery_status IN ('not_configured','queued','sent','failed')),
  created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT provider_invitation_email_normalized CHECK (email = lower(btrim(email)))
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_invitation_one_pending_per_email
ON public.provider_account_invitations (organization_id,email) WHERE status='pending';
CREATE INDEX IF NOT EXISTS provider_invitation_org_status_idx
ON public.provider_account_invitations (organization_id,status,created_at DESC);
