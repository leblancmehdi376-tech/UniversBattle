import fetch from "node-fetch";

// Les petites API gratuites qu'on utilise (Jikan notamment) sont parfois
// instables (timeouts ponctuels côté MyAnimeList) - une unique re-tentative
// après un court délai absorbe ces accidents transitoires sans faire
// attendre l'utilisateur indéfiniment ni masquer une vraie panne prolongée.
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export async function fetchWithRetry(url, options = {}) {
  const { retries = 1, delayMs = 500, ...fetchOptions } = options;
  let lastRes;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      lastRes = await fetch(url, fetchOptions);
      if (lastRes.ok || !RETRYABLE_STATUSES.has(lastRes.status)) return lastRes;
    } catch (err) {
      if (attempt === retries) throw err;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return lastRes;
}
