const KEY = "universebattle_session";

export function saveSession({ code, playerId, name }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, playerId, name }));
  } catch {
    // localStorage indisponible (mode privé strict, etc.) - tant pis,
    // la reconnexion auto ne marchera juste pas.
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
