/**
 * Shared role resolution utilities.
 * Used by the scheduler and can be imported in server-side tests.
 */

/**
 * Get all unique roles configured in a settings object.
 * Returns [{id, name, source}] where source is 'Default' or a league name.
 */
export const getAvailableRoles = (settings) => {
  const roles = [];
  const seen = new Set();

  const add = (id, name, source) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    roles.push({ id: String(id), name: name || id, source });
  };

  // Multi-role default (new system)
  for (const r of settings.defaultRoles || []) {
    add(r.id, r.name, 'Default');
  }

  // Legacy mentionString fallback when no defaultRoles set
  if ((settings.defaultRoles || []).length === 0 && settings.mentionString) {
    const s = String(settings.mentionString).trim();
    const id = /^\d+$/.test(s) ? s : (s.match(/<@&(\d+)>/) || [])[1];
    if (id) add(id, 'Default Role', 'Default');
  }

  // League-specific overrides
  for (const m of settings.leagueRoleMappings || []) {
    const mappingRoles = (m.roles || []).length > 0
      ? m.roles
      : (m.roleId ? [{ id: m.roleId, name: m.roleName || m.league }] : []);
    for (const r of mappingRoles) {
      add(r.id, r.name || m.roleName, m.league);
    }
  }

  return roles;
};

/**
 * Resolve which Discord roles to ping for a given league + settings.
 * Priority: league mapping > defaultRoles > legacy mentionString
 */
export const resolveMentionContent = (league, settings) => {
  const defaultRoles = settings.defaultRoles || [];
  const mappings = settings.leagueRoleMappings || [];
  const leagueMapping = mappings.find(m => m.league === league);

  let selectedRoles;
  if (leagueMapping) {
    const mappingRoles = (leagueMapping.roles || []).length > 0
      ? leagueMapping.roles
      : (leagueMapping.roleId ? [{ id: leagueMapping.roleId, name: leagueMapping.roleName }] : []);
    selectedRoles = mappingRoles;
  } else if (defaultRoles.length > 0) {
    selectedRoles = defaultRoles;
  } else {
    // Fallback: parse legacy mentionString
    let content = settings.mentionString || '';
    if (content && /^\d+$/.test(content.trim())) {
      content = `<@&${content.trim()}>`;
    }
    const roleIds = [];
    for (const m of content.matchAll(/<@&(\d+)>/g)) roleIds.push(m[1]);
    return { content, roleIds };
  }

  const valid = (selectedRoles || []).filter(r => r.id);
  return {
    content: valid.map(r => `<@&${r.id}>`).join(' '),
    roleIds: valid.map(r => String(r.id))
  };
};
