import fetch from "node-fetch";

// MyMemory: API de traduction publique et gratuite (pas de clé requise pour
// un usage raisonnable). Sert de repli quand une recherche en français ne
// donne rien sur Jikan/RAWG/TVmaze (bases anglophones/japonaises) - on
// traduit la requête et on retente. Approximatif par nature (un titre traduit
// mot à mot ne correspond pas toujours au vrai titre original), mais couvre
// bien les cas courants ("l'attaque des titans" -> "Attack on Titan").
export async function translateToEnglish(query) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      query
    )}&langpair=fr|en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (!translated || translated.trim().toLowerCase() === query.trim().toLowerCase()) {
      return null;
    }
    return translated;
  } catch {
    return null; // pas de traduction dispo: on reste sur le résultat original (vide)
  }
}
