const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const betsAPI = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/bets`);
    if (!response.ok) throw new Error('Failed to fetch bets');
    return response.json();
  },

  create: async (bet) => {
    const response = await fetch(`${API_URL}/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bet)
    });
    if (!response.ok) throw new Error('Failed to create bet');
    return response.json();
  },

  update: async (id, updates) => {
    const response = await fetch(`${API_URL}/bets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update bet');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/bets/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete bet');
  },

  clearAll: async () => {
    const response = await fetch(`${API_URL}/bets`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear bets');
  }
};

export const settingsAPI = {
  get: async () => {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  update: async (settings) => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  }
};
