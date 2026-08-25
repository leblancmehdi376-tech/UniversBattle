import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

// Comptes persistés dans un simple fichier JSON (suffisant pour un petit
// projet perso). Pour passer à l'échelle, remplacer par une vraie base
// (Postgres, etc.) en gardant la même interface (register/login/...).
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, "{}");
}

function readAccounts() {
  ensureStore();
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
}

function writeAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(check, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Sessions en mémoire: token -> clé de compte. Un redémarrage du serveur
// invalide les sessions actives (l'utilisateur devra se reconnecter).
const sessions = new Map();

function publicAccount(account) {
  return { username: account.username, avatarUrl: account.avatarUrl || null };
}

export function register(username, password) {
  username = (username || "").trim();
  password = password || "";
  if (username.length < 3 || username.length > 20) {
    return { error: "Le pseudo doit faire entre 3 et 20 caractères." };
  }
  if (password.length < 4) {
    return { error: "Le mot de passe doit faire au moins 4 caractères." };
  }

  const accounts = readAccounts();
  const key = username.toLowerCase();
  if (accounts[key]) {
    return { error: "Ce pseudo est déjà pris." };
  }

  accounts[key] = {
    username,
    passwordHash: hashPassword(password),
    avatarUrl: null,
  };
  writeAccounts(accounts);

  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, key);
  return { token, account: publicAccount(accounts[key]) };
}

export function login(username, password) {
  const accounts = readAccounts();
  const key = (username || "").trim().toLowerCase();
  const account = accounts[key];
  if (!account || !verifyPassword(password || "", account.passwordHash)) {
    return { error: "Pseudo ou mot de passe incorrect." };
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, key);
  return { token, account: publicAccount(account) };
}

export function logout(token) {
  sessions.delete(token);
}

export function getAccountByToken(token) {
  if (!token) return null;
  const key = sessions.get(token);
  if (!key) return null;
  const accounts = readAccounts();
  const account = accounts[key];
  return account ? publicAccount(account) : null;
}

export function setAvatar(token, avatarUrl) {
  const key = sessions.get(token);
  if (!key) return { error: "Session invalide, reconnecte-toi." };
  const accounts = readAccounts();
  if (!accounts[key]) return { error: "Compte introuvable." };
  const previous = accounts[key].avatarUrl;
  accounts[key].avatarUrl = avatarUrl;
  writeAccounts(accounts);
  return { account: publicAccount(accounts[key]), previousAvatarUrl: previous };
}
