import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database pool before importing the router
vi.mock('../database.js', () => ({
  default: { query: vi.fn() },
}));

import pool from '../database.js';
import router from '../routes/messages.js';

// Helper: simulate an Express request/response pair
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

// Pull route handlers directly from router.stack
const getHandler = (method, path) => {
  const layer = router.stack.find(
    l => l.route?.path === path && l.route?.methods[method]
  );
  if (!layer) throw new Error(`No ${method.toUpperCase()} ${path} handler found`);
  // Return the last handler (skips any middleware)
  return layer.route.stack[layer.route.stack.length - 1].handle;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/messages', () => {
  it('returns 400 when botId missing', async () => {
    const handler = getHandler('get', '/');
    const req = makeReq({ query: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 403 when bot not owned by user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check returns empty
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns messages for owned bot', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })    // ownership
      .mockResolvedValueOnce({ rows: [
        {
          id: 'msg-1', bot_id: 'bot-1', content: 'Hello!',
          image_url: '', image_data: '', image_filename: '',
          embed_title: '', embed_color: 16731469,
          role_mentions: [], scheduled_time: '1700000000000',
          is_sent: false, created_at: new Date().toISOString(),
        },
      ]});
    const handler = getHandler('get', '/');
    const req = makeReq({ query: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'msg-1', content: 'Hello!' })])
    );
  });
});

describe('POST /api/messages', () => {
  it('returns 400 when botId missing', async () => {
    const handler = getHandler('post', '/');
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when scheduledTime missing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] });
    const handler = getHandler('post', '/');
    const req = makeReq({ body: { botId: 'bot-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates and returns a new message', async () => {
    const now = Date.now();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'bot-1' }] })   // ownership
      .mockResolvedValueOnce({ rows: [{
        id: 'new-msg', bot_id: 'bot-1', content: 'Test',
        image_url: '', image_data: '', image_filename: '',
        embed_title: '', embed_color: 16731469,
        role_mentions: [{ id: '123', name: 'Plays' }],
        scheduled_time: String(now), is_sent: false, created_at: new Date().toISOString(),
      }]});
    const handler = getHandler('post', '/');
    const req = makeReq({
      body: { botId: 'bot-1', content: 'Test', scheduledTime: now, roleMentions: [{ id: '123', name: 'Plays' }] },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const msg = res.json.mock.calls[0][0];
    expect(msg).toMatchObject({ id: 'new-msg', content: 'Test', isSent: false });
    expect(msg.roleMentions).toEqual([{ id: '123', name: 'Plays' }]);
  });
});

describe('DELETE /api/messages/:id', () => {
  it('returns 404 when message not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const handler = getHandler('delete', '/:id');
    const req = makeReq({ params: { id: 'bad-id' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes and returns success', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] });
    const handler = getHandler('delete', '/:id');
    const req = makeReq({ params: { id: 'msg-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});

describe('PATCH /api/messages/:id', () => {
  it('returns 404 when message not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const handler = getHandler('patch', '/:id');
    const req = makeReq({ params: { id: 'bad-id' }, body: { content: 'updated' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates message fields', async () => {
    const now = Date.now();
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'msg-1' }] })   // ownership check
      .mockResolvedValueOnce({ rows: [{
        id: 'msg-1', bot_id: 'bot-1', content: 'Updated',
        image_url: '', image_data: '', image_filename: '',
        embed_title: '', embed_color: 16731469,
        role_mentions: [], scheduled_time: String(now),
        is_sent: false, created_at: new Date().toISOString(),
      }]});
    const handler = getHandler('patch', '/:id');
    const req = makeReq({ params: { id: 'msg-1' }, body: { content: 'Updated' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ content: 'Updated' }));
  });
});
