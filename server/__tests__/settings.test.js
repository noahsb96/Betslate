import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../database.js', () => ({
  default: { query: vi.fn() },
}));

import pool from '../database.js';
import router from '../routes/settings.js';

const makeReq = (overrides = {}) => ({
  user: { id: 'user-1' },
  query: {},
  params: {},
  body: {},
  ...overrides,
});
const makeRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const getHandler = (method, path) => {
  const layer = router.stack.find(
    l => l.route?.path === path && l.route?.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} handler found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

const dbSettingsRow = {
  bot_id: 'bot-1',
  mentionString: '',
  discordWebhookUrl: 'https://discord.com/webhook',
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
  mention_roles: [],
  default_roles: [],
  league_role_mappings: [],
};

beforeEach(() => vi.resetAllMocks());

describe('GET /api/settings', () => {
  it('returns 400 when botId missing', async () => {
    const handler = getHandler('get', '/');
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when bot not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns default settings when no row exists', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })   // ownership
      .mockResolvedValueOnce({ rows: [] });                   // no settings row
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    const settings = res.json.mock.calls[0][0];
    expect(settings).toMatchObject({
      discordWebhookUrl: '',
      defaultRoles: [],
      leagueRoleMappings: [],
    });
  });

  it('returns settings with defaultRoles and leagueRoleMappings populated', async () => {
    const row = {
      ...dbSettingsRow,
      default_roles: [{ id: '111', name: 'Plays' }],
      league_role_mappings: [
        { league: 'TT Cup', roleId: '999', roleName: 'Cup', roles: [] },
      ],
    };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
      .mockResolvedValueOnce({ rows: [row] });
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    const settings = res.json.mock.calls[0][0];
    expect(settings.defaultRoles).toEqual([{ id: '111', name: 'Plays' }]);
    expect(settings.leagueRoleMappings[0].league).toBe('TT Cup');
  });

  // Backward compatibility: existing installs with mentionString only still work
  it('backward compat — mentionString returned even when defaultRoles empty', async () => {
    const row = { ...dbSettingsRow, mentionString: '555', default_roles: [] };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })
      .mockResolvedValueOnce({ rows: [row] });
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    const settings = res.json.mock.calls[0][0];
    expect(settings.mentionString).toBe('555');
    expect(settings.defaultRoles).toEqual([]);
  });
});

describe('PUT /api/settings', () => {
  it('returns 400 when botId missing', async () => {
    const handler = getHandler('put', '/');
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('saves and returns settings including defaultRoles', async () => {
    const savedRow = {
      ...dbSettingsRow,
      default_roles: [{ id: '222', name: 'VIP' }],
      league_role_mappings: [],
    };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })   // ownership
      .mockResolvedValueOnce({ rows: [savedRow] });           // upsert result
    const handler = getHandler('put', '/');
    const req = makeReq({
      body: {
        botId: 'bot-1',
        defaultRoles: [{ id: '222', name: 'VIP' }],
        leagueRoleMappings: [],
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
      },
    });
    const res = makeRes();
    await handler(req, res);
    const settings = res.json.mock.calls[0][0];
    expect(settings.defaultRoles).toEqual([{ id: '222', name: 'VIP' }]);
    // Verify the query was called with JSON.stringify of defaultRoles as $23
    const callArgs = pool.query.mock.calls[1][1];
    expect(callArgs[22]).toBe(JSON.stringify([{ id: '222', name: 'VIP' }])); // $23 = index 22
  });
});
