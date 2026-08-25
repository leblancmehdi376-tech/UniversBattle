import fetch from "node-fetch";

// RAWG API - nécessite une clé gratuite: https://rawg.io/apidocs
// Docs: https://api.rawg.io/docs/

export async function searchGames(query) {
  const key = process.env.RAWG_API_KEY;
  if (!key || key === "colle_ta_cle_ici") {
    throw new Error(
      "RAWG_API_KEY manquante. Obtiens une clé gratuite sur https://rawg.io/apidocs et mets-la dans server/.env"
    );
  }

  const url = `https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(
    query
  )}&page_size=12`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RAWG API error: ${res.status}`);
  const data = await res.json();

  return (data.results || []).map((g) => ({
    id: `game-${g.id}`,
    name: g.name,
    image: g.background_image || null,
    meta: g.released ? `Sorti en ${g.released.slice(0, 4)}` : "",
  }));
}
