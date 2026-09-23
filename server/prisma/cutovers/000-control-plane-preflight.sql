-- TripDash canonical control-plane cutover preflight
-- READ ONLY: this file makes no database changes.
-- Run in the Supabase SQL Editor before 001-canonical-control-plane.sql.

-- 1) Confirm expected legacy source tables and that canonical targets do not yet exist.
select
  x.table_name,
  case when to_regclass('public.' || x.table_name) is null then 'MISSING' else 'PRESENT' end as status
from (values
  ('tenants'),
  ('organizations'),
  ('partnerships'),
  ('data_connections'),
  ('global_users'),
  ('user_roles'),
  ('user_role_scopes'),
  ('app_users'),
  ('role_assignments'),
  ('tenant_organizations')
) as x(table_name)
order by x.table_name;

-- 2) Inventory the small legacy control plane.
select 'tenants' as entity,count(*) as row_count from public.tenants
union all select 'organizations',count(*) from public.organizations
union all select 'partnerships',count(*) from public.partnerships
union all select 'data_connections',count(*) from public.data_connections
union all select 'global_users',count(*) from public.global_users
union all select 'user_roles',count(*) from public.user_roles
union all select 'user_role_scopes',count(*) from public.user_role_scopes;

-- 3) Every legacy organization type must have an explicit canonical mapping.
select o.type::text as legacy_type,count(*) as row_count,
  case o.type::text
    when 'EDU_GROUP' then 'SCHOOL_GROUP'
    when 'SCHOOL_GROUP' then 'SCHOOL_GROUP'
    when 'SCHOOL' then 'SCHOOL'
    when 'BUS_COMPANY' then 'BUS_OPERATOR'
    when 'BUS_OPERATOR' then 'BUS_OPERATOR'
    when 'SERVICE_PARTNER' then 'SERVICE_PARTNER'
    else 'UNMAPPED'
  end as canonical_type
from public.organizations o
group by o.type::text
order by o.type::text;

-- 4) Referential integrity required for tenant coverage and parent/group migration.
select
  count(*) filter (where t.id is null) as organizations_with_missing_tenant,
  count(*) filter (where o.parent_org_id is not null and p.id is null) as organizations_with_missing_parent
from public.organizations o
left join public.tenants t on t.id=o.tenant_id
left join public.organizations p on p.id=o.parent_org_id;

-- 5) Values that must remain unique in the canonical schema.
select 'tenant_slug_duplicates' as check_name,count(*) as problem_groups
from (select slug from public.tenants group by slug having count(*)>1) q
union all
select 'organization_slug_duplicates',count(*)
from (select slug from public.organizations group by slug having count(*)>1) q;

-- 6) Legacy rows retained as backup after cutover. This is informational only.
select
  'READY only when: canonical targets are MISSING; all legacy organization types are mapped; '
  || 'both referential-integrity counts are 0; both duplicate counts are 0.' as preflight_rule;
