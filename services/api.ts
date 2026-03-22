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

export const betsAPI = {
  getAll: async () => {
    const res = await fetch(`${API_URL}/bets`, { headers: authHeaders() });
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

  clearAll: async () => {
    const res = await fetch(`${API_URL}/bets`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await handleResponse(res);
  }
};

export const settingsAPI = {
  get: async () => {
    const res = await fetch(`${API_URL}/settings`, { headers: authHeaders() });
    await handleResponse(res);
    return res.json();
  },

  update: async (settings) => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(settings)
    });
    await handleResponse(res);
    return res.json();
  }
};

