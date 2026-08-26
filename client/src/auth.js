import { SERVER_URL } from "./api.js";

const AUTH_KEY = "universebattle_auth";

export function saveAuth(auth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    // localStorage indisponible - tant pis, pas de compte persistant
  }
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur.");
  return data;
}

export function registerAccount(username, password) {
  return api("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function loginAccount(username, password) {
  return api("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export function fetchMe(token) {
  return api("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function uploadAvatar(token, file) {
  const form = new FormData();
  form.append("avatar", file);
  return api("/api/auth/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

/** Construit l'URL complète d'un avatar (relative en local, absolue via Vercel Blob en prod) */
export function avatarFullUrl(avatarUrl) {
  if (!avatarUrl) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${SERVER_URL}${avatarUrl}`;
}
