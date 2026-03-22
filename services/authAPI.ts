const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

// Token storage — localStorage persists across sessions (rememberMe), sessionStorage clears on close
export const getToken = (): string | null =>
  localStorage.getItem('bs_token') || sessionStorage.getItem('bs_token');

export const setToken = (token: string, rememberMe: boolean): void => {
  if (rememberMe) {
    localStorage.setItem('bs_token', token);
    sessionStorage.removeItem('bs_token');
  } else {
    sessionStorage.setItem('bs_token', token);
    localStorage.removeItem('bs_token');
  }
};

export const clearToken = (): void => {
  localStorage.removeItem('bs_token');
  sessionStorage.removeItem('bs_token');
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
});

export const authAPI = {
  register: async (email: string, password: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  login: async (email: string, password: string, rememberMe: boolean): Promise<{ token: string; user: { id: string; email: string } }> => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  me: async (): Promise<{ id: string; email: string }> => {
    const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Auth check failed');
    return data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reset failed');
    return data;
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const res = await fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    return data;
  }
};
