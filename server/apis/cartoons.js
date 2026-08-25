import fetch from "node-fetch";

// TVmaze API - gratuite, sans clé
// Docs: https://www.tvmaze.com/api
// On filtre grossièrement sur le genre "Animation" côté recherche libre.

export async function searchCartoons(query) {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TVmaze API error: ${res.status}`);
  const data = await res.json();

  return (data || [])
    .map((entry) => entry.show)
    .filter((s) => s.genres?.includes("Animation") || s.genres?.includes("Anime"))
    .slice(0, 12)
    .map((s) => ({
      id: `cartoon-${s.id}`,
      name: s.name,
      image: s.image?.medium || null,
      meta: s.premiered ? `Depuis ${s.premiered.slice(0, 4)}` : "",
    }));
}
