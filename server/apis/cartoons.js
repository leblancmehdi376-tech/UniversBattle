import { fetchWithRetry } from "./httpRetry.js";

// TVmaze API - gratuite, sans clé
// Docs: https://www.tvmaze.com/api
// Le genre "Animation" est rarement renseigné côté TVmaze (Simpsons, Rick &
// Morty... sont tagués "Comedy"/"Family" sans "Animation" dans genres[]) -
// c'est le champ séparé `type: "Animation"` qui est fiable et couvre aussi
// bien les dessins animés occidentaux que les animes. On exclut ensuite tout
// ce qui est tagué "Anime" ou en langue japonaise (certains animes ne portent
// pas le genre "Anime" dans les données TVmaze, ex: certains spin-offs
// Pokémon) - approximatif mais bien meilleur que le filtre précédent, cf.
// limitation déjà documentée dans le README.

export async function searchCartoons(query) {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`TVmaze API error: ${res.status}`);
  const data = await res.json();

  return (data || [])
    .map((entry) => entry.show)
    .filter(
      (s) =>
        s.type === "Animation" &&
        !s.genres?.includes("Anime") &&
        s.language !== "Japanese"
    )
    .slice(0, 12)
    .map((s) => ({
      id: `cartoon-${s.id}`,
      name: s.name,
      image: s.image?.medium || null,
      meta: s.premiered ? `Depuis ${s.premiered.slice(0, 4)}` : "",
    }));
}
