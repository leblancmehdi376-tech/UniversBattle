export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur.");
  return data;
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function createLobby({ name, authToken }) {
  return request("/api/lobby", jsonOptions("POST", { name, authToken }));
}

export function joinLobby(code, { name, authToken }) {
  return request(
    `/api/lobby/${encodeURIComponent(code.trim())}/join`,
    jsonOptions("POST", { name, authToken })
  );
}

// Sert à la fois la reprise au montage et chaque tick de polling.
export function fetchLobby(code, playerId) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}?playerId=${encodeURIComponent(playerId)}`
  );
}

export function setCategory(code, playerId, category) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/category`,
    jsonOptions("PATCH", { playerId, category })
  );
}

export function setTournamentSize(code, playerId, size) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/tournament-size`,
    jsonOptions("PATCH", { playerId, size })
  );
}

export function startGame(code, playerId) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/start`,
    jsonOptions("POST", { playerId })
  );
}

export function searchItems(code, query) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/search?query=${encodeURIComponent(query)}`
  );
}

export function submitPicks(code, playerId, items) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/picks`,
    jsonOptions("POST", { playerId, items })
  );
}

export function vote(code, playerId, matchId, choice) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/vote`,
    jsonOptions("POST", { playerId, matchId, choice })
  );
}

// Hôte uniquement: confirme avoir vu le gagnant et fait passer tout le monde
// au duel suivant (plus d'auto-avance par minuteur).
export function advanceRound(code, playerId) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/advance`,
    jsonOptions("POST", { playerId })
  );
}

export function leaveLobby(code, playerId) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/leave`,
    jsonOptions("POST", { playerId })
  );
}

export function replayLobby(code, playerId) {
  return request(
    `/api/lobby/${encodeURIComponent(code)}/replay`,
    jsonOptions("POST", { playerId })
  );
}
