import { customAlphabet } from "nanoid";
import * as store from "./store.js";

// Code lobby lisible: 5 lettres majuscules, sans caractères ambigus
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

// playerId (stable, stocké côté client en localStorage) est distinct de toute
// connexion transport (il n'y a plus de socket.id sous polling HTTP). Toute la
// logique de jeu (hostId, picks, votes, ownerId) référence playerId.
const playerIdAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const genPlayerId = customAlphabet(playerIdAlphabet, 16);

// Un joueur est considéré "connecté" s'il a été vu (poll ou action) il y a
// moins de CONNECTED_TIMEOUT_MS. Remplace l'ancien événement "disconnect".
const CONNECTED_TIMEOUT_MS = 5000;

export const VALID_TOURNAMENT_SIZES = [16, 32, 64, 128];

/**
 * Répartit `tournamentSize` picks entre `numPlayers` joueurs pour tomber pile
 * sur le total (les premiers joueurs prennent le reste de la division, +1
 * chacun) - ainsi le tournoi tombe toujours sur une puissance de 2 exacte,
 * sans bye, tant que personne ne quitte en cours de picking.
 */
export function computePickQuotas(numPlayers, tournamentSize) {
  const base = Math.floor(tournamentSize / numPlayers);
  const remainder = tournamentSize % numPlayers;
  return Array.from({ length: numPlayers }, (_, i) => base + (i < remainder ? 1 : 0));
}

function lobbyKey(code) {
  return `lobby:${code}`;
}

export async function createLobby(hostName, avatarUrl = null) {
  let code;
  do {
    code = nanoid();
  } while (await store.get(lobbyKey(code)));

  const hostPlayerId = genPlayerId();

  const lobby = {
    code,
    hostId: hostPlayerId,
    players: [
      {
        id: hostPlayerId,
        name: hostName,
        avatarUrl,
        picks: [],
        ready: false,
        pickQuota: null,
        lastSeenAt: Date.now(),
      },
    ],
    category: null, // 'anime' | 'jeuxvideo' | 'dessinanime'
    tournamentSize: 16, // 16 | 32 | 64 | 128 - taille totale du tournoi
    phase: "waiting", // waiting -> picking -> tournament -> finished
    bracket: null,
    createdAt: Date.now(),
  };

  await store.set(lobbyKey(code), lobby);
  return { lobby, playerId: hostPlayerId };
}

export async function getLobby(code) {
  return store.get(lobbyKey(code));
}

export async function saveLobby(lobby) {
  await store.set(lobbyKey(lobby.code), lobby);
}

export async function deleteLobby(code) {
  await store.del(lobbyKey(code));
}

export async function joinLobby(code, playerName, avatarUrl = null) {
  const lobby = await store.get(lobbyKey(code));
  if (!lobby) return { error: "Lobby introuvable." };
  if (lobby.phase !== "waiting") return { error: "La partie a déjà commencé." };
  if (lobby.players.length >= 10) return { error: "Le lobby est plein (10 max)." };
  if (lobby.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: "Ce pseudo est déjà pris dans ce lobby." };
  }

  const playerId = genPlayerId();
  lobby.players.push({
    id: playerId,
    name: playerName,
    avatarUrl,
    picks: [],
    ready: false,
    pickQuota: null,
    lastSeenAt: Date.now(),
  });

  await store.set(lobbyKey(code), lobby);
  return { lobby, playerId };
}

/** Vérifie qu'un playerId existe bien dans ce lobby et rafraîchit son heartbeat. */
export async function getLobbyForPlayer(code, playerId) {
  const lobby = await store.get(lobbyKey(code));
  if (!lobby) return { error: "Ce lobby n'existe plus." };
  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return { error: "Session introuvable dans ce lobby." };
  player.lastSeenAt = Date.now();
  await store.set(lobbyKey(code), lobby);
  return { lobby, playerId };
}

/** Met à jour le heartbeat d'un joueur sans persister (l'appelant persiste après ses propres mutations). */
export function touchPlayer(lobby, playerId) {
  const player = lobby.players.find((p) => p.id === playerId);
  if (player) player.lastSeenAt = Date.now();
  return player;
}

export async function removePlayer(code, playerId) {
  const lobby = await store.get(lobbyKey(code));
  if (!lobby) return null;
  lobby.players = lobby.players.filter((p) => p.id !== playerId);
  if (lobby.players.length === 0) {
    await deleteLobby(code);
    return null;
  }
  if (lobby.hostId === playerId) {
    lobby.hostId = lobby.players[0].id; // transfert d'hôte
  }
  await store.set(lobbyKey(code), lobby);
  return lobby;
}

// Vue envoyée aux clients: on ne renvoie jamais lastSeenAt (info interne),
// et "connected" est calculé à la volée à partir du heartbeat.
export function sanitizeLobby(lobby) {
  return {
    ...lobby,
    players: lobby.players.map(({ lastSeenAt, ...rest }) => ({
      ...rest,
      connected: Date.now() - lastSeenAt < CONNECTED_TIMEOUT_MS,
    })),
  };
}
