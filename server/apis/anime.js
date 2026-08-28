import { fetchWithRetry } from "./httpRetry.js";

// Jikan API (MyAnimeList) - gratuite, sans clé, source principale (données
// riches). Docs: https://docs.api.jikan.moe/
async function searchJikan(query) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12&order_by=popularity&sort=asc`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);
  const data = await res.json();

  return (data.data || []).map((a) => ({
    id: `anime-${a.mal_id}`,
    name: a.title,
    image: a.images?.jpg?.image_url || null,
    meta: a.type ? `${a.type} • ${a.episodes || "?"} épisodes` : "",
  }));
}

// AniList - gratuite, sans clé, service totalement indépendant de
// MyAnimeList: sert de repli automatique quand Jikan/MAL est en panne (ce qui
// arrive assez régulièrement). Docs: https://docs.anilist.co/
async function searchAniList(query) {
  const gql = `query ($search: String) {
    Page(page: 1, perPage: 12) {
      media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
        id
        title { romaji english }
        coverImage { large }
        episodes
        format
      }
    }
  }`;
  const res = await fetchWithRetry("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: gql, variables: { search: query } }),
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const data = await res.json();
  const media = data?.data?.Page?.media || [];

  return media.map((m) => ({
    id: `anime-al-${m.id}`,
    name: m.title.english || m.title.romaji,
    image: m.coverImage?.large || null,
    meta: m.format ? `${m.format} • ${m.episodes || "?"} épisodes` : "",
  }));
}

export async function searchAnime(query) {
  try {
    return await searchJikan(query);
  } catch {
    try {
      return await searchAniList(query);
    } catch {
      throw new Error(
        "MyAnimeList et AniList sont tous les deux injoignables pour le moment - réessaie dans une minute."
      );
    }
  }
}
