const API_BASE = '/api';

function getToken() { return localStorage.getItem('token'); }

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(API_BASE + url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const apiGet = (url, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return apiFetch(url + (qs ? '?' + qs : ''));
};
const apiPost = (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) });
const apiPut = (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
const apiDelete = (url) => apiFetch(url, { method: 'DELETE' });
