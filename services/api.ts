import { getToken, clearToken } from './authAPI';

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
});

const handleResponse = async (res: Response) => {
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return res;
};

export const botsAPI = {
  getAll: async () => {
    const res = await fetch(`${API_URL}/bots`, { headers: authHeaders() });
    await handleResponse(res);
    return res.json();
  },

  create: async (name: string) => {
    const res = await fetch(`${API_URL}/bots`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name })
    });
    await handleResponse(res);
    return res.json();
  },

  rename: async (id: string, name: string) => {
    const res = await fetch(`${API_URL}/bots/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name })
    });
    await handleResponse(res);
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/bots/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  }
};

export const betsAPI = {
  getAll: async (botId?: string) => {
    const url = botId ? `${API_URL}/bets?botId=${encodeURIComponent(botId)}` : `${API_URL}/bets`;
    const res = await fetch(url, { headers: authHeaders() });
    await handleResponse(res);
    return res.json();
  },

  create: async (bet) => {
    const res = await fetch(`${API_URL}/bets`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(bet)
    });
    await handleResponse(res);
    return res.json();
  },

  update: async (id, updates) => {
    const res = await fetch(`${API_URL}/bets/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates)
    });
    await handleResponse(res);
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_URL}/bets/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  },

  clearAll: async (slateDate?: string, botId?: string) => {
    const params = new URLSearchParams();
    if (slateDate) params.set('slateDate', slateDate);
    if (botId) params.set('botId', botId);
    const qs = params.toString();
    const url = qs ? `${API_URL}/bets?${qs}` : `${API_URL}/bets`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  }
};

export const settingsAPI = {
  get: async (botId: string) => {
    const res = await fetch(`${API_URL}/settings?botId=${encodeURIComponent(botId)}`, {
      headers: authHeaders()
    });
    await handleResponse(res);
    return res.json();
  },

  update: async (botId: string, settings) => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ ...settings, botId })
    });
    await handleResponse(res);
    return res.json();
  }
};

export const recapsAPI = {
  getCalendar: async (year: number, month: number, botId: string) => {
    const res = await fetch(
      `${API_URL}/recaps/calendar?year=${year}&month=${month}&botId=${encodeURIComponent(botId)}`,
      { headers: authHeaders() }
    );
    await handleResponse(res);
    return res.json();
  },

  saveDaily: async (recap: {
    date: string;
    wins: number;
    losses: number;
    pushes: number;
    net_units: number;
    roi: number;
    league_breakdown: Array<{ league: string; units: number }>;
    botId: string;
  }) => {
    const res = await fetch(`${API_URL}/recaps/daily`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(recap)
    });
    await handleResponse(res);
    return res.json();
  },

  getDaily: async (date: string, botId: string) => {
    const res = await fetch(
      `${API_URL}/recaps/daily/${date}?botId=${encodeURIComponent(botId)}`,
      { headers: authHeaders() }
    );
    await handleResponse(res);
    return res.json();
  },

  getMonthly: async (year: number, month: number, botId: string) => {
    const res = await fetch(
      `${API_URL}/recaps/monthly/${year}/${month}?botId=${encodeURIComponent(botId)}`,
      { headers: authHeaders() }
    );
    await handleResponse(res);
    return res.json();
  },

  getYearly: async (year: number, botId: string) => {
    const res = await fetch(
      `${API_URL}/recaps/yearly/${year}?botId=${encodeURIComponent(botId)}`,
      { headers: authHeaders() }
    );
    await handleResponse(res);
    return res.json();
  }
};

export const betLinksAPI = {
  getLinks: async (betId: string) => {
    const res = await fetch(`${API_URL}/bet-links?betId=${encodeURIComponent(betId)}`, { headers: authHeaders() });
    await handleResponse(res);
    return res.json();
  },

  getSuggestions: async (betId: string) => {
    const res = await fetch(`${API_URL}/bet-links/suggestions?betId=${encodeURIComponent(betId)}`, { headers: authHeaders() });
    await handleResponse(res);
    return res.json();
  },

  createLink: async (betId: string, linkedBetId: string) => {
    const res = await fetch(`${API_URL}/bet-links`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ betId, linkedBetId })
    });
    await handleResponse(res);
    return res.json();
  },

  deleteLink: async (id: string) => {
    const res = await fetch(`${API_URL}/bet-links/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  }
};

export const messagesAPI = {
  getAll: async (botId: string, includeSent = false) => {
    const res = await fetch(
      `${API_URL}/messages?botId=${encodeURIComponent(botId)}&includeSent=${includeSent}`,
      { headers: authHeaders() }
    );
    await handleResponse(res);
    return res.json();
  },

  create: async (msg: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(msg)
    });
    await handleResponse(res);
    return res.json();
  },

  update: async (id: string, msg: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/messages/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(msg)
    });
    await handleResponse(res);
    return res.json();
  },

  delete: async (id: string) => {
    const res = await fetch(`${API_URL}/messages/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  }
};

