export const API = "/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function detailMessage(err, fallback) {
  const d = err && err.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return d.map((x) => (x && x.msg) || String(x)).join("; ");
  }
  return fallback;
}

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(detailMessage(err, res.statusText), res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}
