import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import {
  createLobby,
  getLobby,
  joinLobby,
  reconnectPlayer,
  markDisconnected,
  removePlayer,
} from "./lobbyManager.js";
import {
  buildBracket,
  buildNextRound,
  resolveMatch,
  allMatchesResolved,
} from "./bracket.js";
import { searchAnime } from "./apis/anime.js";
import { searchGames } from "./apis/games.js";
import { searchCartoons } from "./apis/cartoons.js";
import { register, login, logout, getAccountByToken, setAvatar } from "./accounts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_URL } });

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Comptes (optionnels) : inscription, connexion, photo de profil ---

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 Mo max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Seules les images sont acceptées."));
      return;
    }
    cb(null, true);
  },
});

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const account = getAccountByToken(token);
  if (!account) return res.status(401).json({ error: "Non connecté." });
  req.authToken = token;
  req.account = account;
  next();
}

app.post("/api/auth/register", (req, res) => {
  const { username, password } = req.body || {};
  const result = register(username, password);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const result = login(username, password);
  if (result.error) return res.status(401).json(result);
  res.json(result);
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  logout(req.authToken);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ account: req.account });
});

app.post("/api/auth/avatar", requireAuth, (req, res) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Aucune image reçue." });

    const avatarUrl = `/uploads/${req.file.filename}`;
    const result = setAvatar(req.authToken, avatarUrl);
    if (result.error) return res.status(400).json(result);

    // Nettoyage de l'ancien avatar sur disque (best-effort)
    if (result.previousAvatarUrl) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(result.previousAvatarUrl));
      fs.unlink(oldPath, () => {});
    }

    res.json({ account: result.account });
  });
});

function searchByCategory(category, query) {
  switch (category) {
    case "anime":
      return searchAnime(query);
    case "jeuxvideo":
      return searchGames(query);
    case "dessinanime":
      return searchCartoons(query);
    default:
      throw new Error("Catégorie inconnue");
  }
}

function findPlayerBySocket(lobby, socketId) {
  return lobby.players.find((p) => p.socketId === socketId);
}

// On ne renvoie jamais socketId au client (info interne serveur uniquement)
function sanitizeLobby(lobby) {
  return {
    ...lobby,
    players: lobby.players.map(({ socketId, ...rest }) => rest),
  };
}

function broadcastLobby(lobby) {
  io.to(lobby.code).emit("lobby:update", sanitizeLobby(lobby));
}

function everyoneSubmittedPicks(lobby) {
  return lobby.players.every(
    (p) => p.picks.length === lobby.picksPerPlayer
  );
}

function startTournament(lobby) {
  const allItems = lobby.players.flatMap((p) =>
    p.picks.map((item) => ({
      ...item,
      ownerId: p.id,
      ownerName: p.name,
      ownerAvatarUrl: p.avatarUrl || null,
    }))
  );
  lobby.bracket = buildBracket(allItems);
  lobby.phase = "tournament";

  // Auto-avance les byes déjà résolus au round 1
  advanceIfRoundComplete(lobby);
}

function advanceIfRoundComplete(lobby) {
  if (!lobby.bracket || lobby.bracket.finished) return;
  if (allMatchesResolved(lobby.bracket)) {
    lobby.bracket = buildNextRound(lobby.bracket);
    if (lobby.bracket.finished) {
      lobby.phase = "finished";
    } else {
      // Nouveau round: résoudre en cascade d'éventuels autres byes
      advanceIfRoundComplete(lobby);
    }
  }
}

io.on("connection", (socket) => {
  socket.on("lobby:create", ({ name, authToken }, cb) => {
    const account = getAccountByToken(authToken);
    const finalName = account ? account.username : (name?.trim() || "Host");
    const avatarUrl = account?.avatarUrl || null;
    const { lobby, playerId } = createLobby(socket.id, finalName, avatarUrl);
    socket.join(lobby.code);
    cb?.({ lobby: sanitizeLobby(lobby), playerId });
    broadcastLobby(lobby);
  });

  socket.on("lobby:join", ({ code, name, authToken }, cb) => {
    const account = getAccountByToken(authToken);
    const finalName = account ? account.username : (name?.trim() || "Joueur");
    const avatarUrl = account?.avatarUrl || null;
    const result = joinLobby(code.trim().toUpperCase(), socket.id, finalName, avatarUrl);
    if (result.error) {
      cb?.({ error: result.error });
      return;
    }
    socket.join(result.lobby.code);
    cb?.({ lobby: sanitizeLobby(result.lobby), playerId: result.playerId });
    broadcastLobby(result.lobby);
  });

  // Reconnexion après un refresh: le client renvoie le playerId stocké en
  // localStorage, on le réassocie au nouveau socket.id.
  socket.on("lobby:reconnect", ({ code, playerId }, cb) => {
    const result = reconnectPlayer(code, playerId, socket.id);
    if (result.error) {
      cb?.({ error: result.error });
      return;
    }
    socket.join(code);
    cb?.({ lobby: sanitizeLobby(result.lobby), playerId });
    broadcastLobby(result.lobby);
  });

  socket.on("lobby:setCategory", ({ code, category }) => {
    const lobby = getLobby(code);
    const player = lobby && findPlayerBySocket(lobby, socket.id);
    if (!lobby || !player || lobby.hostId !== player.id) return;
    lobby.category = category;
    broadcastLobby(lobby);
  });

  socket.on("lobby:setPicksCount", ({ code, count }) => {
    const lobby = getLobby(code);
    const player = lobby && findPlayerBySocket(lobby, socket.id);
    if (!lobby || !player || lobby.hostId !== player.id) return;
    lobby.picksPerPlayer = Math.max(1, Math.min(10, Number(count) || 3));
    broadcastLobby(lobby);
  });

  socket.on("lobby:start", ({ code }) => {
    const lobby = getLobby(code);
    const player = lobby && findPlayerBySocket(lobby, socket.id);
    if (!lobby || !player || lobby.hostId !== player.id) return;
    if (!lobby.category) return;
    if (lobby.players.length < 2) return;
    lobby.phase = "picking";
    broadcastLobby(lobby);
  });

  socket.on("search:items", async ({ code, query }, cb) => {
    const lobby = getLobby(code);
    if (!lobby || !lobby.category) {
      cb?.({ error: "Lobby ou catégorie invalide." });
      return;
    }
    try {
      const results = await searchByCategory(lobby.category, query);
      cb?.({ results });
    } catch (err) {
      cb?.({ error: err.message });
    }
  });

  socket.on("player:submitPicks", ({ code, items }) => {
    const lobby = getLobby(code);
    if (!lobby || lobby.phase !== "picking") return;
    const player = findPlayerBySocket(lobby, socket.id);
    if (!player) return;

    player.picks = items.slice(0, lobby.picksPerPlayer);
    player.ready = player.picks.length === lobby.picksPerPlayer;

    if (everyoneSubmittedPicks(lobby)) {
      startTournament(lobby);
    }
    broadcastLobby(lobby);
  });

  socket.on("tournament:vote", ({ code, matchId, choice }) => {
    const lobby = getLobby(code);
    if (!lobby || lobby.phase !== "tournament" || !lobby.bracket) return;
    const player = findPlayerBySocket(lobby, socket.id);
    if (!player) return;

    const match = lobby.bracket.matches.find((m) => m.id === matchId);
    if (!match || match.winner) return;
    if (choice !== "a" && choice !== "b") return;
    if (!match.a || !match.b) return; // pas de vote sur un bye

    match.votes[player.id] = choice;

    // Round terminé quand tous les joueurs ont voté sur ce match
    const totalPlayers = lobby.players.length;
    if (Object.keys(match.votes).length >= totalPlayers) {
      resolveMatch(match);
      advanceIfRoundComplete(lobby);
    }
    broadcastLobby(lobby);
  });

  // Départ volontaire (bouton "Rejouer" / "Quitter"), distinct d'un simple
  // refresh: ici on retire vraiment le joueur du lobby.
  socket.on("lobby:leave", ({ code, playerId }) => {
    const updated = removePlayer(code, playerId);
    if (updated) broadcastLobby(updated);
  });

  socket.on("disconnect", () => {
    const lobby = markDisconnected(socket.id);
    if (lobby) broadcastLobby(lobby);
  });
});

server.listen(PORT, () => {
  console.log(`UniverseBattle server listening on http://localhost:${PORT}`);
});
