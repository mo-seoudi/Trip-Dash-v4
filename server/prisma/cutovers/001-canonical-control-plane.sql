-- TripDash canonical control-plane cutover
-- Migrates the small legacy control plane to the canonical architecture while
-- preserving operational trip tables and rewiring their tenant/org foreign keys.
-- Take a Supabase backup/snapshot before running. Run 000 preflight first.

begin;
create extension if not exists pgcrypto;

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

-- Drop only foreign keys that point to the legacy tenants/organizations. PostgreSQL
-- otherwise follows renamed tables and would leave operational records attached to archives.
alter table public."Trip" drop constraint if exists fk_trip_school_org;
alter table public."Trip" drop constraint if exists fk_trip_tenant;
alter table public.trip_registry drop constraint if exists trip_registry_bus_company_org_id_fkey;
alter table public.trip_registry drop constraint if exists trip_registry_school_org_id_fkey;
alter table public.trip_registry drop constraint if exists trip_registry_tenant_id_fkey;
alter table public.data_connections drop constraint if exists data_connections_org_id_fkey;
alter table public.data_connections drop constraint if exists data_connections_tenant_id_fkey;
alter table public.organizations drop constraint if exists organizations_parent_org_id_fkey;
alter table public.organizations drop constraint if exists organizations_tenant_id_fkey;
alter table public.partnerships drop constraint if exists partnerships_bus_company_org_id_fkey;
alter table public.partnerships drop constraint if exists partnerships_school_org_id_fkey;
alter table public.partnerships drop constraint if exists partnerships_tenant_id_fkey;
alter table public.global_users drop constraint if exists users_tenant_id_fkey;
alter table public.user_role_scopes drop constraint if exists user_role_scopes_org_fk;
alter table public.user_role_scopes drop constraint if exists user_role_scopes_school_fk;
alter table public.user_roles drop constraint if exists user_roles_org_id_fkey;

-- Preserve legacy control structures and data exactly.
alter table public.organizations rename to organizations_legacy_cutover;
alter table public.tenants rename to tenants_legacy_cutover;
alter table public.partnerships rename to partnerships_legacy_cutover;
alter table public.data_connections rename to data_connections_legacy_cutover;
alter table public.global_users rename to global_users_legacy_cutover;
alter table public.user_roles rename to user_roles_legacy_cutover;
alter table public.user_role_scopes rename to user_role_scopes_legacy_cutover;

-- Table rename does not rename PostgreSQL indexes/PK indexes. Rename every legacy index
-- that can collide with names generated for the new canonical tenants/organizations.
alter index if exists public.organizations_pkey rename to organizations_legacy_cutover_pkey;
alter index if exists public.organizations_slug_key rename to organizations_legacy_cutover_slug_key;
alter index if exists public.organizations_type_idx rename to organizations_legacy_cutover_type_idx;
alter index if exists public.organizations_parent_idx rename to organizations_legacy_cutover_parent_idx;
alter index if exists public.organizations_parent_org_id_idx rename to organizations_legacy_cutover_parent_org_id_idx;
alter index if exists public.organizations_tenant_id_code_key rename to organizations_legacy_cutover_tenant_id_code_key;
alter index if exists public.organizations_tenant_id_idx rename to organizations_legacy_cutover_tenant_id_idx;
alter index if exists public.organizations_tenant_idx rename to organizations_legacy_cutover_tenant_idx;
alter index if exists public.tenants_pkey rename to tenants_legacy_cutover_pkey;
alter index if exists public.tenants_slug_key rename to tenants_legacy_cutover_slug_key;

-- Canonical enums have distinct names from the lowercase legacy enums.
do $$ begin create type public."OrganizationType" as enum ('SCHOOL_GROUP','SCHOOL','BUS_OPERATOR','SERVICE_PARTNER'); exception when duplicate_object then null; end $$;
do $$ begin create type public."MembershipStatus" as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED'); exception when duplicate_object then null; end $$;
do $$ begin create type public."RelationshipType" as enum ('BELONGS_TO_GROUP','TRANSPORT_PROVIDER','TRIP_MANAGER','WORKS_WITH_TRANSPORT_PROVIDER'); exception when duplicate_object then null; end $$;
do $$ begin create type public."AccessScopeType" as enum ('PLATFORM','TENANT','ORGANIZATION'); exception when duplicate_object then null; end $$;
do $$ begin create type public."IdentityProvider" as enum ('LOCAL','MICROSOFT_ENTRA','GOOGLE','OIDC','SAML'); exception when duplicate_object then null; end $$;
do $$ begin create type public."DataSourceMode" as enum ('HOSTED','CUSTOMER_POSTGRES'); exception when duplicate_object then null; end $$;
do $$ begin create type public."SecretProviderType" as enum ('HOST_ENVIRONMENT','EXTERNAL_VAULT'); exception when duplicate_object then null; end $$;
do $$ begin create type public."SubscriptionMode" as enum ('FREE','PAID','TRIAL','SPONSORED'); exception when duplicate_object then null; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), type public."OrganizationType" not null,
  display_name text not null, full_name text, legal_name text, abbreviation text,
  slug text not null unique, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index organizations_type_idx on public.organizations(type);

create table public.tenants (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  status text not null default 'active', subscription_mode public."SubscriptionMode" not null default 'FREE',
  plan_key text, billing_organization_id uuid references public.organizations(id) on delete set null,
  billing_contact_email text, subscription_start date, subscription_end date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tenants_billing_organization_id_idx on public.tenants(billing_organization_id);

create table public.tenant_organizations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coverage_type text not null default 'covered', created_at timestamptz not null default now(),
  primary key(tenant_id,organization_id)
);
create index tenant_organizations_organization_id_idx on public.tenant_organizations(organization_id);

create table public.app_users (
  id uuid primary key default gen_random_uuid(), email text not null unique, display_name text not null,
  status text not null default 'active', legacy_user_id integer unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.authentication_identities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id) on delete cascade,
  provider public."IdentityProvider" not null, provider_subject text not null, password_hash text,
  email_at_provider text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider,provider_subject)
);
create index authentication_identities_user_id_idx on public.authentication_identities(user_id);
create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id) on delete cascade,
  refresh_token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz,
  created_at timestamptz not null default now(), last_used_at timestamptz, user_agent text, ip_address text
);
create index auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index auth_sessions_expires_at_idx on public.auth_sessions(expires_at);

create table public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  from_organization_id uuid not null references public.organizations(id) on delete cascade,
  to_organization_id uuid not null references public.organizations(id) on delete cascade,
  type public."RelationshipType" not null, is_primary boolean not null default false,
  status text not null default 'active', valid_from timestamptz, valid_until timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(from_organization_id,to_organization_id,type)
);
create index organization_relationships_from_idx on public.organization_relationships(from_organization_id,type,status);
create index organization_relationships_to_idx on public.organization_relationships(to_organization_id,type,status);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status public."MembershipStatus" not null default 'PENDING', is_primary boolean not null default false,
  job_title text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,organization_id)
);
create index organization_memberships_org_status_idx on public.organization_memberships(organization_id,status);

create table public.roles (
  id uuid primary key default gen_random_uuid(), key text not null unique, name text not null,
  description text, is_system boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(), key text not null unique, description text,
  created_at timestamptz not null default now()
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key(role_id,permission_id)
);
create index role_permissions_permission_id_idx on public.role_permissions(permission_id);
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict, scope_type public."AccessScopeType" not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,role_id,scope_type,tenant_id,organization_id)
);
create index role_assignments_user_active_idx on public.role_assignments(user_id,is_active);
create index role_assignments_tenant_idx on public.role_assignments(tenant_id);
create index role_assignments_organization_idx on public.role_assignments(organization_id);

create table public.secret_providers (
  id uuid primary key default gen_random_uuid(), key text not null unique, display_name text not null,
  type public."SecretProviderType" not null, adapter_key text, config jsonb, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index secret_providers_type_active_idx on public.secret_providers(type,is_active);
create table public.operational_data_sources (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, mode public."DataSourceMode" not null default 'HOSTED', engine text not null default 'postgresql',
  provider_label text, region text, is_active boolean not null default true, schema_version text, last_verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index operational_data_sources_org_active_idx on public.operational_data_sources(organization_id,is_active);
create table public.data_source_credentials (
  id uuid primary key default gen_random_uuid(), data_source_id uuid not null unique references public.operational_data_sources(id) on delete cascade,
  secret_provider_id uuid not null references public.secret_providers(id) on delete restrict, secret_reference text not null,
  secret_key text, version text, is_active boolean not null default true, last_resolved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index data_source_credentials_provider_active_idx on public.data_source_credentials(secret_provider_id,is_active);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references public.app_users(id) on delete set null, action text not null,
  resource_type text, resource_id text, metadata jsonb, created_at timestamptz not null default now()
);
create index audit_events_tenant_created_idx on public.audit_events(tenant_id,created_at);
create index audit_events_org_created_idx on public.audit_events(organization_id,created_at);
create index audit_events_actor_created_idx on public.audit_events(actor_user_id,created_at);
create index audit_events_resource_idx on public.audit_events(resource_type,resource_id);

-- Preserve IDs so operational references can be reattached without rewriting records.
insert into public.tenants(id,name,slug,status,plan_key,billing_contact_email,created_at,updated_at)
select id,name,slug,status,plan,billing_email,created_at,updated_at from public.tenants_legacy_cutover;

insert into public.organizations(id,type,display_name,full_name,abbreviation,slug,status,created_at,updated_at)
select o.id,
  case lower(o.type::text)
    when 'edu_group' then 'SCHOOL_GROUP'::public."OrganizationType"
    when 'school_group' then 'SCHOOL_GROUP'::public."OrganizationType"
    when 'school' then 'SCHOOL'::public."OrganizationType"
    when 'bus_company' then 'BUS_OPERATOR'::public."OrganizationType"
    when 'bus_operator' then 'BUS_OPERATOR'::public."OrganizationType"
    when 'service_partner' then 'SERVICE_PARTNER'::public."OrganizationType"
    else null
  end,
  o.name,o.name,nullif(o.code,''),o.slug,'active',o.created_at,o.updated_at
from public.organizations_legacy_cutover o;

insert into public.tenant_organizations(tenant_id,organization_id,coverage_type,created_at)
select tenant_id,id,'covered',created_at from public.organizations_legacy_cutover;
insert into public.organization_relationships(from_organization_id,to_organization_id,type,status,created_at,updated_at)
select id,parent_org_id,'BELONGS_TO_GROUP','active',created_at,updated_at
from public.organizations_legacy_cutover where parent_org_id is not null;

insert into public.roles(key,name,description,is_system) values
('super_admin','Super Admin','Platform-wide SaaS administration',true),
('tenant_admin','Tenant Admin','Administration across an assigned tenant',true),
('school_admin','School Admin','Administration within an assigned school or organization',true),
('school_staff','School Staff','School staff operational access',true),
('bus_company','Bus Company','Transport supplier operational access',true),
('finance','Finance','Finance and audit access',true)
on conflict(key) do nothing;

-- Reattach operational references to the new canonical tables. Existing UUIDs were
-- preserved, so these constraints validate that every referenced record survived.
alter table public."Trip" add constraint fk_trip_school_org foreign key (school_org_id) references public.organizations(id);
alter table public."Trip" add constraint fk_trip_tenant foreign key (tenant_id) references public.tenants(id);
alter table public.trip_registry add constraint trip_registry_bus_company_org_id_fkey foreign key (bus_company_org_id) references public.organizations(id);
alter table public.trip_registry add constraint trip_registry_school_org_id_fkey foreign key (school_org_id) references public.organizations(id);
alter table public.trip_registry add constraint trip_registry_tenant_id_fkey foreign key (tenant_id) references public.tenants(id);

commit;

select 'tenants' as entity,count(*) as row_count from public.tenants
union all select 'organizations',count(*) from public.organizations
union all select 'tenant_organizations',count(*) from public.tenant_organizations
union all select 'organization_relationships',count(*) from public.organization_relationships
union all select 'roles',count(*) from public.roles
union all select 'app_users',count(*) from public.app_users;
