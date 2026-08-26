import { useEffect, useRef, useState } from "react";
import { searchItems, submitPicks } from "../api.js";

export default function Picking({ lobby, myId, onError, applyLobby }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [picks, setPicks] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const me = lobby.players.find((p) => p.id === myId);
  const needed = me?.pickQuota ?? 0;
  const submitted = me?.ready;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchItems(lobby.code, query);
        setResults(res.results || []);
      } catch (err) {
        onError(err.message);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, lobby.code, onError]);

  function togglePick(item) {
    if (submitted) return;
    setPicks((prev) => {
      const already = prev.some((p) => p.id === item.id);
      if (already) return prev.filter((p) => p.id !== item.id);
      if (prev.length >= needed) return prev; // plein
      return [...prev, item];
    });
  }

  function removePickAt(index) {
    if (submitted) return;
    setPicks((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (picks.length !== needed) {
      onError(`Choisis exactement ${needed} favori(s) avant de valider.`);
      return;
    }
    try {
      const res = await submitPicks(lobby.code, myId, picks);
      applyLobby(res.lobby);
    } catch (err) {
      onError(err.message);
    }
  }

  const readyCount = lobby.players.filter((p) => p.ready).length;

  return (
    <div className="panel">
      <h2>Choisis tes {needed} favori(s)</h2>
      <p>
        {readyCount}/{lobby.players.length} joueurs ont validé leurs choix.
      </p>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${(readyCount / lobby.players.length) * 100}%` }}
        />
      </div>

      <div className="picks-tray">
        {Array.from({ length: needed }).map((_, i) =>
          picks[i] ? (
            <button
              key={i}
              type="button"
              className="pick-slot pick-slot-filled"
              onClick={() => removePickAt(i)}
              title="Retirer ce favori"
            >
              <img src={picks[i].image} alt={picks[i].name} />
              <span className="pick-slot-remove">✕</span>
            </button>
          ) : (
            <div className="pick-slot" key={i} />
          )
        )}
      </div>

      {submitted ? (
        <p style={{ marginTop: 20 }}>
          ✅ Choix validés. En attente des autres joueurs…
        </p>
      ) : (
        <>
          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="search">Rechercher</label>
            <input
              id="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ex: One Piece, Zelda, Bugs Bunny…"
              autoFocus
            />
          </div>

          {searching && <p>Recherche…</p>}

          <div className="search-results">
            {results.map((item) => {
              const isPicked = picks.some((p) => p.id === item.id);
              return (
                <button
                  key={item.id}
                  className={`item-card ${isPicked ? "picked" : ""}`}
                  onClick={() => togglePick(item)}
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <div style={{ height: 140, background: "var(--bg)" }} />
                  )}
                  <div className="item-body">
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">{item.meta}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 24 }}
            disabled={picks.length !== needed}
            onClick={submit}
          >
            Valider mes choix ({picks.length}/{needed})
          </button>
        </>
      )}
    </div>
  );
}
