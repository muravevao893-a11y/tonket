const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export const api = {
  health: () => request('/health'),
  listTokens: () => request('/api/tokens'),
  getToken: (id) => request(`/api/tokens/${id}`),
  createToken: (body) => request('/api/tokens', { method: 'POST', body: JSON.stringify(body) }),
  quote: (id, side, amount) => request(`/api/tokens/${id}/quote?side=${side}&amount=${encodeURIComponent(amount)}`),
  prepareTrade: (id, body) => request(`/api/tokens/${id}/trades/prepare`, { method: 'POST', body: JSON.stringify(body) }),
  confirmTrade: (id, body) => request(`/api/tokens/${id}/trades/confirm`, { method: 'POST', body: JSON.stringify(body) })
};
