import { customAlphabet } from "nanoid";

// Code lobby lisible: 5 lettres majuscules, sans caractères ambigus
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

// Stockage en mémoire. Pour passer à Redis plus tard, il suffit de
// remplacer cette Map par des appels à un client Redis avec la même interface.
const lobbies = new Map();

// playerId (stable, stocké côté client en localStorage) est distinct du
// socket.id (qui change à chaque connexion/refresh). Toute la logique de jeu
// (hostId, picks, votes, ownerId) référence playerId, jamais socket.id.
const playerIdAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const genPlayerId = customAlphabet(playerIdAlphabet, 16);

export function createLobby(hostSocketId, hostName, avatarUrl = null) {
  let code;
  do {
    code = nanoid();
  } while (lobbies.has(code));

  const hostPlayerId = genPlayerId();

  const lobby = {
    code,
    hostId: hostPlayerId,
    players: [
      {
        id: hostPlayerId,
        socketId: hostSocketId,
        name: hostName,
        avatarUrl,
        picks: [],
        ready: false,
        connected: true,
      },
    ],
    category: null, // 'anime' | 'jeuxvideo' | 'dessinanime'
    picksPerPlayer: 3,
    phase: "waiting", // waiting -> picking -> tournament -> finished
    bracket: null,
    createdAt: Date.now(),
  };

  lobbies.set(code, lobby);
  return { lobby, playerId: hostPlayerId };
}

export function getLobby(code) {
  return lobbies.get(code);
}

export function deleteLobby(code) {
  lobbies.delete(code);
}

export function joinLobby(code, socketId, playerName, avatarUrl = null) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: "Lobby introuvable." };
  if (lobby.phase !== "waiting") return { error: "La partie a déjà commencé." };
  if (lobby.players.length >= 10) return { error: "Le lobby est plein (10 max)." };
  if (lobby.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: "Ce pseudo est déjà pris dans ce lobby." };
  }

  const playerId = genPlayerId();
  lobby.players.push({
    id: playerId,
    socketId,
    name: playerName,
    avatarUrl,
    picks: [],
    ready: false,
    connected: true,
  });

  return { lobby, playerId };
}

/** Reconnexion: réassocie un playerId existant à un nouveau socket.id */
export function reconnectPlayer(code, playerId, socketId) {
  const lobby = lobbies.get(code);
  if (!lobby) return { error: "Ce lobby n'existe plus." };
  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return { error: "Session introuvable dans ce lobby." };
  player.socketId = socketId;
  player.connected = true;
  return { lobby, playerId };
}

/** Marque un joueur déconnecté sans le retirer (il peut revenir via reconnect) */
export function markDisconnected(socketId) {
  for (const lobby of lobbies.values()) {
    const player = lobby.players.find((p) => p.socketId === socketId);
    if (player) {
      player.connected = false;
      return lobby;
    }
  }
  return null;
}

export function removePlayer(code, playerId) {
  const lobby = lobbies.get(code);
  if (!lobby) return null;
  lobby.players = lobby.players.filter((p) => p.id !== playerId);
  if (lobby.players.length === 0) {
    deleteLobby(code);
    return null;
  }
  if (lobby.hostId === playerId) {
    lobby.hostId = lobby.players[0].id; // transfert d'hôte
  }
  return lobby;
}

export function listPublicLobby(lobby) {
  // Vue "publique" envoyée aux clients (pas besoin de cacher grand chose ici,
  // mais on garde ce point d'entrée pour filtrer plus tard si besoin)
  return lobby;
}
