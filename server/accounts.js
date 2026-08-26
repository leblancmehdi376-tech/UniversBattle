import crypto from "crypto";
import * as store from "./store.js";

// Comptes et sessions passent par le même store clé/valeur que les lobbies
// (Map en mémoire en local, Vercel KV en prod). En local, ça signifie que les
// comptes ne survivent plus à un redémarrage du serveur (comme les lobbies
// aujourd'hui) - avant, ils étaient persistés dans data/accounts.json.

function accountKey(usernameLower) {
  return `account:${usernameLower}`;
}

function sessionKey(token) {
  return `session:${token}`;
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

function publicAccount(account) {
  return { username: account.username, avatarUrl: account.avatarUrl || null };
}

export async function register(username, password) {
  username = (username || "").trim();
  password = password || "";
  if (username.length < 3 || username.length > 20) {
    return { error: "Le pseudo doit faire entre 3 et 20 caractères." };
  }
  if (password.length < 4) {
    return { error: "Le mot de passe doit faire au moins 4 caractères." };
  }

  const key = username.toLowerCase();
  if (await store.get(accountKey(key))) {
    return { error: "Ce pseudo est déjà pris." };
  }

  const account = {
    username,
    passwordHash: hashPassword(password),
    avatarUrl: null,
  };
  await store.set(accountKey(key), account);

  const token = crypto.randomBytes(24).toString("hex");
  await store.set(sessionKey(token), key);
  return { token, account: publicAccount(account) };
}

export async function login(username, password) {
  const key = (username || "").trim().toLowerCase();
  const account = await store.get(accountKey(key));
  if (!account || !verifyPassword(password || "", account.passwordHash)) {
    return { error: "Pseudo ou mot de passe incorrect." };
  }
  const token = crypto.randomBytes(24).toString("hex");
  await store.set(sessionKey(token), key);
  return { token, account: publicAccount(account) };
}

export async function logout(token) {
  await store.del(sessionKey(token));
}

export async function getAccountByToken(token) {
  if (!token) return null;
  const key = await store.get(sessionKey(token));
  if (!key) return null;
  const account = await store.get(accountKey(key));
  return account ? publicAccount(account) : null;
}

export async function setAvatar(token, avatarUrl) {
  const key = await store.get(sessionKey(token));
  if (!key) return { error: "Session invalide, reconnecte-toi." };
  const account = await store.get(accountKey(key));
  if (!account) return { error: "Compte introuvable." };
  const previous = account.avatarUrl;
  account.avatarUrl = avatarUrl;
  await store.set(accountKey(key), account);
  return { account: publicAccount(account), previousAvatarUrl: previous };
}
