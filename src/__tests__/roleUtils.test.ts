import { describe, it, expect } from 'vitest';
import { resolveMentionContent, getAvailableRoles } from '../../src/utils/roleUtils';
import type { AppSettings } from '../../types';

const base: AppSettings = {
  mentionString: '',
  discordWebhookUrl: '',
  recapWebhookUrl: '',
  botName: 'Test Bot',
  botAvatarUrl: '',
  scheduleOffsetMinutes: 15,
  slateTimezone: 'America/New_York',
  defaultOdds: '-120',
  aiInstructions: '',
  recapTitle: 'Daily Recap',
  recapIncludeDate: true,
  recapIncludeRecord: true,
  recapIncludeNetUnits: true,
  recapIncludeROI: true,
  recapIncludeLeagueStats: false,
  defaultBetAlertTitle: '📢 Bet Alert',
  betEmbedColor: 16731469,
  recapEmbedColor: 16731469,
  defaultRoles: [],
  leagueRoleMappings: [],
};

// ─── resolveMentionContent ────────────────────────────────────────────────────

describe('resolveMentionContent', () => {
  it('returns empty content when no roles configured', () => {
    const result = resolveMentionContent('TT Elite Series', base);
    expect(result.content).toBe('');
    expect(result.roleIds).toEqual([]);
  });

  it('parses a legacy mentionString numeric role ID', () => {
    const settings = { ...base, mentionString: '123456789' };
    const result = resolveMentionContent('TT Elite Series', settings);
    expect(result.content).toBe('<@&123456789>');
    expect(result.roleIds).toEqual(['123456789']);
  });

  it('parses a legacy mentionString already in mention format', () => {
    const settings = { ...base, mentionString: '<@&987654321>' };
    const result = resolveMentionContent('TT Cup', settings);
    expect(result.content).toBe('<@&987654321>');
    expect(result.roleIds).toEqual(['987654321']);
  });

  it('uses defaultRoles over mentionString when set', () => {
    const settings: AppSettings = {
      ...base,
      mentionString: '111',
      defaultRoles: [
        { id: '222', name: 'Chefs Plays' },
        { id: '333', name: 'VIP' },
      ],
    };
    const result = resolveMentionContent('TT Elite Series', settings);
    expect(result.content).toBe('<@&222> <@&333>');
    expect(result.roleIds).toEqual(['222', '333']);
  });

  it('applies a single league override instead of defaultRoles', () => {
    const settings: AppSettings = {
      ...base,
      defaultRoles: [{ id: '111', name: 'Default' }],
      leagueRoleMappings: [
        { league: 'TT Cup', roleId: '999', roleName: 'TT Cup Role', roles: [] },
      ],
    };
    const defaultLeague = resolveMentionContent('TT Elite Series', settings);
    expect(defaultLeague.roleIds).toEqual(['111']);

    const overrideLeague = resolveMentionContent('TT Cup', settings);
    expect(overrideLeague.roleIds).toEqual(['999']);
    expect(overrideLeague.content).toBe('<@&999>');
  });

  it('applies multi-role league override via roles array', () => {
    const settings: AppSettings = {
      ...base,
      defaultRoles: [{ id: '111', name: 'Default' }],
      leagueRoleMappings: [
        {
          league: 'Setka Cup',
          roleId: '500',
          roleName: 'Old',
          roles: [
            { id: '500', name: 'Role A' },
            { id: '501', name: 'Role B' },
          ],
        },
      ],
    };
    const result = resolveMentionContent('Setka Cup', settings);
    expect(result.roleIds).toEqual(['500', '501']);
    expect(result.content).toBe('<@&500> <@&501>');
  });

  it('falls back to mentionString when league has no mapping', () => {
    const settings: AppSettings = {
      ...base,
      mentionString: '777',
      leagueRoleMappings: [
        { league: 'TT Cup', roleId: '999', roleName: 'TT Cup Role', roles: [] },
      ],
    };
    const result = resolveMentionContent('TT Elite Series', settings);
    expect(result.content).toBe('<@&777>');
    expect(result.roleIds).toEqual(['777']);
  });
});

// ─── getAvailableRoles ────────────────────────────────────────────────────────

describe('getAvailableRoles', () => {
  it('returns empty array when nothing configured', () => {
    expect(getAvailableRoles(base)).toEqual([]);
  });

  it('returns single default role from legacy mentionString', () => {
    const roles = getAvailableRoles({ ...base, mentionString: '123' });
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ id: '123', source: 'Default' });
  });

  it('returns all defaultRoles', () => {
    const settings = {
      ...base,
      defaultRoles: [
        { id: '111', name: 'Plays' },
        { id: '222', name: 'VIP' },
      ],
    };
    const roles = getAvailableRoles(settings);
    expect(roles.map(r => r.id)).toEqual(['111', '222']);
    expect(roles.every(r => r.source === 'Default')).toBe(true);
  });

  it('includes league override roles with correct source label', () => {
    const settings: AppSettings = {
      ...base,
      defaultRoles: [{ id: '111', name: 'Default' }],
      leagueRoleMappings: [
        { league: 'TT Cup', roleId: '999', roleName: 'TT Cup Role', roles: [] },
      ],
    };
    const roles = getAvailableRoles(settings);
    expect(roles).toHaveLength(2);
    expect(roles[1]).toMatchObject({ id: '999', source: 'TT Cup' });
  });

  it('deduplicates roles that appear in both default and league', () => {
    const settings: AppSettings = {
      ...base,
      defaultRoles: [{ id: '111', name: 'Shared' }],
      leagueRoleMappings: [
        { league: 'TT Cup', roleId: '111', roleName: 'Shared', roles: [] },
      ],
    };
    const roles = getAvailableRoles(settings);
    expect(roles).toHaveLength(1);
  });

  it('does NOT return mentionString role when defaultRoles is set', () => {
    const settings: AppSettings = {
      ...base,
      mentionString: '999',
      defaultRoles: [{ id: '111', name: 'New' }],
    };
    const roles = getAvailableRoles(settings);
    expect(roles.map(r => r.id)).not.toContain('999');
    expect(roles.map(r => r.id)).toContain('111');
  });
});
