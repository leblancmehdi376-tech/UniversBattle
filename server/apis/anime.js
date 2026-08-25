import fetch from "node-fetch";

// Jikan API (MyAnimeList) - gratuite, sans clé
// Docs: https://docs.api.jikan.moe/

export async function searchAnime(query) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=12&order_by=popularity&sort=asc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);
  const data = await res.json();

  return (data.data || []).map((a) => ({
    id: `anime-${a.mal_id}`,
    name: a.title,
    image: a.images?.jpg?.image_url || null,
    meta: a.type ? `${a.type} • ${a.episodes || "?"} épisodes` : "",
  }));
}
