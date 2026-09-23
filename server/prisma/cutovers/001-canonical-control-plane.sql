-- TripDash canonical control-plane cutover
-- Purpose: migrate the small legacy control plane to the canonical architecture
-- without touching operational trip tables.
--
-- IMPORTANT:
-- 1. Take a Supabase backup/snapshot before running this script.
-- 2. Run the preflight section first and review its output.
-- 3. This script intentionally preserves legacy control tables as *_legacy_cutover.
-- 4. It does NOT create the first Platform Super Admin; bootstrap that only after verification.

begin;

-- Required PostgreSQL capability used by existing database defaults as well.
create extension if not exists pgcrypto;

-- Refuse to run twice or over an already-created canonical control plane.
do $$
begin
  if to_regclass('public.organizations_legacy_cutover') is not null
     or to_regclass('public.tenants_legacy_cutover') is not null then
    raise exception 'Cutover backup tables already exist; refusing to run again.';
  end if;
  if to_regclass('public.app_users') is not null
     or to_regclass('public.role_assignments') is not null
     or to_regclass('public.tenant_organizations') is not null then
    raise exception 'Canonical control-plane tables already exist; inspect database before cutover.';
  end if;
end $$;

-- Preserve the legacy structures and data exactly as they currently exist.
alter table public.organizations rename to organizations_legacy_cutover;
alter table public.tenants rename to tenants_legacy_cutover;
alter table public.partnerships rename to partnerships_legacy_cutover;
alter table public.data_connections rename to data_connections_legacy_cutover;
alter table public.global_users rename to global_users_legacy_cutover;
alter table public.user_roles rename to user_roles_legacy_cutover;
alter table public.user_role_scopes rename to user_role_scopes_legacy_cutover;

-- Canonical enums. Guarded so an existing compatible enum does not break the cutover.
do $$ begin create type public."OrganizationType" as enum ('SCHOOL_GROUP','SCHOOL','BUS_OPERATOR','SERVICE_PARTNER'); exception when duplicate_object then null; end $$;
do $$ begin create type public."MembershipStatus" as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public."RelationshipType" as enum ('BELONGS_TO_GROUP','TRANSPORT_PROVIDER','TRIP_MANAGER','WORKS_WITH_TRANSPORT_PROVIDER'); exception when duplicate_object then null; end $$;
do $$ begin create type public."AccessScopeType" as enum ('PLATFORM','TENANT','ORGANIZATION'); exception when duplicate_object then null; end $$;
do $$ begin create type public."IdentityProvider" as enum ('LOCAL','MICROSOFT_ENTRA','GOOGLE','OIDC','SAML'); exception when duplicate_object then null; end $$;
do $$ begin create type public."DataSourceMode" as enum ('HOSTED','CUSTOMER_POSTGRES'); exception when duplicate_object then null; end $$;
do $$ begin create type public."SecretProviderType" as enum ('HOST_ENVIRONMENT','EXTERNAL_VAULT'); exception when duplicate_object then null; end $$;
do $$ begin create type public."SubscriptionMode" as enum ('FREE','PAID','TRIAL','SPONSORED'); exception when duplicate_object then null; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public."OrganizationType" not null,
  display_name text not null,
  full_name text,
  legal_name text,
  abbreviation text,
  slug text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index organizations_type_idx on public.organizations(type);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active',
  subscription_mode public."SubscriptionMode" not null default 'FREE',
  plan_key text,
  billing_organization_id uuid references public.organizations(id) on delete set null,
  billing_contact_email text,
  subscription_start date,
  subscription_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_billing_organization_id_idx on public.tenants(billing_organization_id);

create table public.tenant_organizations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coverage_type text not null default 'covered',
  created_at timestamptz not null default now(),
  primary key(tenant_id,organization_id)
);
create index tenant_organizations_organization_id_idx on public.tenant_organizations(organization_id);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  status text not null default 'active',
  legacy_user_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.authentication_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider public."IdentityProvider" not null,
  provider_subject text not null,
  password_hash text,
  email_at_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,provider_subject)
);
create index authentication_identities_user_id_idx on public.authentication_identities(user_id);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  user_agent text,
  ip_address text
);
create index auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index auth_sessions_expires_at_idx on public.auth_sessions(expires_at);

create table public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  from_organization_id uuid not null references public.organizations(id) on delete cascade,
  to_organization_id uuid not null references public.organizations(id) on delete cascade,
  type public."RelationshipType" not null,
  is_primary boolean not null default false,
  status text not null default 'active',
  valid_from timestamptz,
  valid_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(from_organization_id,to_organization_id,type)
);
create index organization_relationships_from_idx on public.organization_relationships(from_organization_id,type,status);
create index organization_relationships_to_idx on public.organization_relationships(to_organization_id,type,status);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status public."MembershipStatus" not null default 'PENDING',
  is_primary boolean not null default false,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,organization_id)
);
create index organization_memberships_org_status_idx on public.organization_memberships(organization_id,status);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key(role_id,permission_id)
);
create index role_permissions_permission_id_idx on public.role_permissions(permission_id);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  scope_type public."AccessScopeType" not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,role_id,scope_type,tenant_id,organization_id)
);
create index role_assignments_user_active_idx on public.role_assignments(user_id,is_active);
create index role_assignments_tenant_idx on public.role_assignments(tenant_id);
create index role_assignments_organization_idx on public.role_assignments(organization_id);

create table public.secret_providers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  type public."SecretProviderType" not null,
  adapter_key text,
  config jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index secret_providers_type_active_idx on public.secret_providers(type,is_active);

create table public.operational_data_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  mode public."DataSourceMode" not null default 'HOSTED',
  engine text not null default 'postgresql',
  provider_label text,
  region text,
  is_active boolean not null default true,
  schema_version text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index operational_data_sources_org_active_idx on public.operational_data_sources(organization_id,is_active);

create table public.data_source_credentials (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null unique references public.operational_data_sources(id) on delete cascade,
  secret_provider_id uuid not null references public.secret_providers(id) on delete restrict,
  secret_reference text not null,
  secret_key text,
  version text,
  is_active boolean not null default true,
  last_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index data_source_credentials_provider_active_idx on public.data_source_credentials(secret_provider_id,is_active);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_tenant_created_idx on public.audit_events(tenant_id,created_at);
create index audit_events_org_created_idx on public.audit_events(organization_id,created_at);
create index audit_events_actor_created_idx on public.audit_events(actor_user_id,created_at);
create index audit_events_resource_idx on public.audit_events(resource_type,resource_id);

-- Preserve tenant IDs and commercial basics. Legacy 'plan' becomes canonical plan_key.
insert into public.tenants(id,name,slug,status,plan_key,billing_contact_email,created_at,updated_at)
select id,name,slug,status,plan,billing_email,created_at,updated_at
from public.tenants_legacy_cutover;

-- Preserve organization IDs. Legacy organization names become canonical display names.
-- Existing type labels are mapped explicitly; unknown values abort rather than being guessed.
insert into public.organizations(id,type,display_name,full_name,abbreviation,slug,status,created_at,updated_at)
select
  o.id,
  case o.type::text
    when 'EDU_GROUP' then 'SCHOOL_GROUP'::public."OrganizationType"
    when 'SCHOOL_GROUP' then 'SCHOOL_GROUP'::public."OrganizationType"
    when 'SCHOOL' then 'SCHOOL'::public."OrganizationType"
    when 'BUS_COMPANY' then 'BUS_OPERATOR'::public."OrganizationType"
    when 'BUS_OPERATOR' then 'BUS_OPERATOR'::public."OrganizationType"
    when 'SERVICE_PARTNER' then 'SERVICE_PARTNER'::public."OrganizationType"
    else null
  end,
  o.name,
  o.name,
  nullif(o.code,''),
  o.slug,
  'active',
  o.created_at,
  o.updated_at
from public.organizations_legacy_cutover o;

-- Fail atomically if a legacy organization type could not be mapped.
do $$
begin
  if exists(select 1 from public.organizations where type is null) then
    raise exception 'One or more legacy organization types could not be mapped.';
  end if;
end $$;

-- Legacy organizations were tenant-owned; convert that ownership to canonical coverage.
insert into public.tenant_organizations(tenant_id,organization_id,coverage_type,created_at)
select o.tenant_id,o.id,'covered',o.created_at
from public.organizations_legacy_cutover o;

-- Parent organization links become explicit BELONGS_TO_GROUP relationships.
insert into public.organization_relationships(from_organization_id,to_organization_id,type,status,created_at,updated_at)
select o.id,o.parent_org_id,'BELONGS_TO_GROUP','active',o.created_at,o.updated_at
from public.organizations_legacy_cutover o
where o.parent_org_id is not null;

-- Seed the canonical role catalogue needed by current application code.
insert into public.roles(key,name,description,is_system) values
('super_admin','Super Admin','Platform-wide SaaS administration',true),
('tenant_admin','Tenant Admin','Administration across an assigned tenant',true),
('school_admin','School Admin','Administration within an assigned school or organization',true),
('school_staff','School Staff','School staff operational access',true),
('bus_company','Bus Company','Transport supplier operational access',true),
('finance','Finance','Finance and audit access',true)
on conflict(key) do nothing;

-- Intentionally do not migrate legacy users/roles: current counts are zero and the
-- canonical first Platform Super Admin will be bootstrapped after verification.

commit;

-- Post-cutover verification summary. These SELECTs are safe to rerun.
select 'tenants' as entity,count(*) as row_count from public.tenants
union all select 'organizations',count(*) from public.organizations
union all select 'tenant_organizations',count(*) from public.tenant_organizations
union all select 'organization_relationships',count(*) from public.organization_relationships
union all select 'roles',count(*) from public.roles
union all select 'app_users',count(*) from public.app_users;
