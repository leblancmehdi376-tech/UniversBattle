import { setCategory as apiSetCategory, setTournamentSize, startGame } from "../api.js";
import Avatar from "../components/Avatar.jsx";

const CATEGORIES = [
  { id: "anime", label: "Anime", emoji: "⚔️" },
  { id: "jeuxvideo", label: "Jeux vidéo", emoji: "🎮" },
  { id: "dessinanime", label: "Dessin animé", emoji: "🎨" },
];

const TOURNAMENT_SIZES = [16, 32, 64, 128];

export default function WaitingRoom({ lobby, myId, isHost, applyLobby, onError }) {
  async function setCategory(category) {
    try {
      const res = await apiSetCategory(lobby.code, myId, category);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    }
  }

  async function setSize(size) {
    try {
      const res = await setTournamentSize(lobby.code, myId, size);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    }
  }

  async function start() {
    try {
      const res = await startGame(lobby.code, myId);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    }
  }

  const canStart = isHost && lobby.category && lobby.players.length >= 2;

  return (
    <div className="panel">
      <h3>Code du lobby — partage-le</h3>
      <div className="lobby-code">{lobby.code}</div>

      <h2 style={{ marginTop: 28 }}>Catégorie</h2>
      {isHost ? (
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`category-card ${lobby.category === c.id ? "selected" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              <span className="emoji">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <p>
          {lobby.category
            ? CATEGORIES.find((c) => c.id === lobby.category)?.label
            : "En attente que l'hôte choisisse une catégorie…"}
        </p>
      )}

      <h2 style={{ marginTop: 28 }}>Taille du tournoi</h2>
      {isHost ? (
        <div className="row">
          {TOURNAMENT_SIZES.map((n) => (
            <button
              key={n}
              className={`btn ${lobby.tournamentSize === n ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <p>Tournoi à {lobby.tournamentSize} participants</p>
      )}
      <p style={{ marginTop: 10, fontSize: 13 }}>
        ~{Math.ceil(lobby.tournamentSize / Math.max(lobby.players.length, 1))} favori(s) par joueur
        pour compléter l'arbre.
      </p>

      <h2 style={{ marginTop: 28 }}>
        Joueurs ({lobby.players.length}/10)
      </h2>
      <ul className="player-list">
        {lobby.players.map((p) => (
          <li key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={p.name} avatarUrl={p.avatarUrl} />
              {p.name}
              {!p.connected && (
                <span className="host-tag" style={{ borderColor: "var(--text-muted)", color: "var(--text-muted)" }}>
                  hors ligne
                </span>
              )}
            </span>
            {p.id === lobby.hostId && <span className="host-tag">Hôte</span>}
          </li>
        ))}
      </ul>

      {isHost && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 24 }}
          disabled={!canStart}
          onClick={start}
        >
          Lancer la partie
        </button>
      )}
      {!isHost && (
        <p style={{ marginTop: 20 }}>En attente que l'hôte lance la partie…</p>
      )}
      {isHost && lobby.players.length < 2 && (
        <p style={{ marginTop: 10 }}>Il faut au moins 2 joueurs pour commencer.</p>
      )}
    </div>
  );
}
