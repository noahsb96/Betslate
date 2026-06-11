import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveMentionContent, getAvailableRoles } from '../utils/roleUtils.js';

// ─── resolveMentionContent (server-side, same logic as frontend) ──────────────

const base = {
  mentionString: '',
  defaultRoles: [],
  leagueRoleMappings: [],
};

describe('server/utils/roleUtils — resolveMentionContent', () => {
  it('returns empty content when nothing configured', () => {
    const { content, roleIds } = resolveMentionContent('TT Elite Series', base);
    expect(content).toBe('');
    expect(roleIds).toEqual([]);
  });

  it('converts bare numeric mentionString to mention format', () => {
    const { content, roleIds } = resolveMentionContent('Any', { ...base, mentionString: '123456' });
    expect(content).toBe('<@&123456>');
    expect(roleIds).toEqual(['123456']);
  });

  it('defaultRoles takes priority over mentionString', () => {
    const settings = {
      ...base,
      mentionString: '111',
      defaultRoles: [{ id: '222', name: 'Plays' }],
    };
    const { content, roleIds } = resolveMentionContent('TT Elite Series', settings);
    expect(content).toBe('<@&222>');
    expect(roleIds).toEqual(['222']);
  });

  it('league mapping overrides defaultRoles for that league only', () => {
    const settings = {
      ...base,
      defaultRoles: [{ id: '100', name: 'Default' }],
      leagueRoleMappings: [
        { league: 'Setka Cup', roleId: '200', roleName: 'Setka', roles: [] },
      ],
    };
    expect(resolveMentionContent('TT Elite Series', settings).roleIds).toEqual(['100']);
    expect(resolveMentionContent('Setka Cup', settings).roleIds).toEqual(['200']);
  });

  it('league mapping supports multi-role via roles array', () => {
    const settings = {
      ...base,
      leagueRoleMappings: [
        {
          league: 'TT Cup',
          roleId: '300',
          roleName: 'Old',
          roles: [{ id: '300', name: 'A' }, { id: '301', name: 'B' }],
        },
      ],
    };
    const { content, roleIds } = resolveMentionContent('TT Cup', settings);
    expect(roleIds).toEqual(['300', '301']);
    expect(content).toBe('<@&300> <@&301>');
  });

  it('filters out empty-id roles silently', () => {
    const settings = {
      ...base,
      defaultRoles: [{ id: '', name: 'Empty' }, { id: '555', name: 'Valid' }],
    };
    const { roleIds } = resolveMentionContent('Any', settings);
    expect(roleIds).toEqual(['555']);
  });
});

// ─── getAvailableRoles (server-side) ─────────────────────────────────────────

describe('server/utils/roleUtils — getAvailableRoles', () => {
  it('returns empty when nothing configured', () => {
    expect(getAvailableRoles(base)).toEqual([]);
  });

  it('returns legacy mentionString role when no defaultRoles', () => {
    const roles = getAvailableRoles({ ...base, mentionString: '999' });
    expect(roles).toHaveLength(1);
    expect(roles[0].id).toBe('999');
    expect(roles[0].source).toBe('Default');
  });

  it('returns all defaultRoles with Default source', () => {
    const settings = {
      ...base,
      defaultRoles: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
    };
    const roles = getAvailableRoles(settings);
    expect(roles.map(r => r.id)).toEqual(['1', '2']);
    expect(roles.every(r => r.source === 'Default')).toBe(true);
  });

  it('includes league override roles labeled by league name', () => {
    const settings = {
      ...base,
      defaultRoles: [{ id: '1', name: 'Default' }],
      leagueRoleMappings: [{ league: 'TT Cup', roleId: '500', roleName: 'Cup Role', roles: [] }],
    };
    const roles = getAvailableRoles(settings);
    expect(roles.find(r => r.id === '500')?.source).toBe('TT Cup');
  });

  it('deduplicates roles present in multiple places', () => {
    const settings = {
      ...base,
      defaultRoles: [{ id: '42', name: 'Shared' }],
      leagueRoleMappings: [{ league: 'TT Cup', roleId: '42', roleName: 'Shared', roles: [] }],
    };
    expect(getAvailableRoles(settings)).toHaveLength(1);
  });
});
