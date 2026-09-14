// Temporary compatibility helpers used while v4 role strings are migrated to
// the new scoped access model. The database may still contain `bus_company`,
// but application code should use the canonical `bus_operator` term.

const ROLE_ALIASES = new Map([
  ["bus_company", "bus_operator"],
  ["BUS_COMPANY", "bus_operator"],
]);

export function normalizeLegacyRole(role) {
  if (!role) return role;
  return ROLE_ALIASES.get(String(role)) || String(role);
}

export function normalizeLegacyUser(user) {
  if (!user) return user;
  return {
    ...user,
    role: normalizeLegacyRole(user.role),
  };
}

// Until the database migration is applied, writes that target the legacy User
// table can still persist the old value so existing main-branch code remains
// compatible with the same database.
export function toLegacyStoredRole(role) {
  const normalized = normalizeLegacyRole(role);
  return normalized === "bus_operator" ? "bus_company" : normalized;
}
