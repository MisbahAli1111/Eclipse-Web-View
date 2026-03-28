import { getTenantSearchUrl } from './config';

function parseJsonSafe(text) {
  const trimmed = text == null ? '' : String(text).trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/** User-visible string from common API error shapes (422, validation, etc.). */
function messageFromApiBody(data) {
  if (!data || typeof data !== 'object') return null;

  const tryString = (v) =>
    typeof v === 'string' && v.trim() ? v.trim() : null;

  const direct = tryString(data.message) || tryString(data.error) || tryString(data.msg);
  if (direct) return direct;

  const nested = tryString(data?.data?.message);
  if (nested) return nested;

  const m = data.message;
  if (Array.isArray(m)) {
    const joined = m
      .map((x) => (typeof x === 'string' ? x : x != null ? String(x) : ''))
      .filter(Boolean)
      .join(' ');
    if (joined) return joined;
  }

  if (data.errors && typeof data.errors === 'object') {
    const parts = [];
    for (const v of Object.values(data.errors)) {
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
      else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string' && item.trim()) parts.push(item.trim());
        }
      }
    }
    if (parts.length) return parts.join(' ');
  }

  return null;
}

function isApiSuccess(data) {
  return data && (data.success === true || data.success === 1);
}

export const TenantService = {
  async getTenants(email, password) {
    const response = await fetch(getTenantSearchUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await response.text();
    const data = parseJsonSafe(text);

    if (isApiSuccess(data)) {
      return {
        success: true,
        tenants: data.data,
        count: data.count,
      };
    }

    const apiMessage = messageFromApiBody(data);
    if (apiMessage) {
      throw new Error(apiMessage);
    }

    if (!data) {
      const statusHint = response.statusText?.trim();
      throw new Error(
        statusHint ||
          (!response.ok ? `Request failed (${response.status})` : 'Invalid response from server'),
      );
    }

    throw new Error('Failed to fetch tenants');
  },
};
