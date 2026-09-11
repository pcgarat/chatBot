export const API = "/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail || res.statusText, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}
