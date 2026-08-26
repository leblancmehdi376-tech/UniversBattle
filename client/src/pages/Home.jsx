import { useState } from "react";
import { createLobby, joinLobby } from "../api.js";
import Avatar from "../components/Avatar.jsx";

export default function Home({ auth, onError, onJoined }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState("create"); // 'create' | 'join'

  const effectiveName = auth ? auth.username : name;

  async function handleCreate() {
    if (!effectiveName.trim()) return onError("Entre un pseudo d'abord.");
    try {
      const res = await createLobby({ name: effectiveName, authToken: auth?.token });
      onJoined(res.lobby, res.playerId, effectiveName.trim());
    } catch (err) {
      onError(err.message);
    }
  }

  async function handleJoin() {
    if (!effectiveName.trim()) return onError("Entre un pseudo d'abord.");
    if (!joinCode.trim()) return onError("Entre le code du lobby.");
    try {
      const res = await joinLobby(joinCode, { name: effectiveName, authToken: auth?.token });
      onJoined(res.lobby, res.playerId, effectiveName.trim());
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="panel">
      <h1>Que le meilleur gagne.</h1>
      <p>
        Crée un lobby ou rejoins celui d'un ami avec un code, choisissez une
        catégorie, et affrontez vos favoris jusqu'au champion final.
      </p>

      <div className="home-preview" aria-hidden="true">
        <span className="preview-chip">⚔️ Anime</span>
        <span className="preview-chip">🎮 Jeux vidéo</span>
        <span className="preview-chip">🎨 Dessin animé</span>
      </div>

      {auth ? (
        <div className="account-profile-row" style={{ marginBottom: 20 }}>
          <Avatar name={auth.username} avatarUrl={auth.avatarUrl} size={44} />
          <p style={{ margin: 0 }}>
            Connecté en tant que <strong>{auth.username}</strong>
          </p>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="name">Ton pseudo</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Kael"
            maxLength={20}
          />
        </div>
      )}

      <div className="row" style={{ marginBottom: 20 }}>
        <button
          className={mode === "create" ? "btn btn-primary" : "btn btn-ghost"}
          onClick={() => setMode("create")}
        >
          Créer un lobby
        </button>
        <button
          className={mode === "join" ? "btn btn-primary" : "btn btn-ghost"}
          onClick={() => setMode("join")}
        >
          Rejoindre un lobby
        </button>
      </div>

      {mode === "create" ? (
        <button className="btn btn-primary" onClick={handleCreate}>
          Créer la partie
        </button>
      ) : (
        <>
          <div className="field">
            <label htmlFor="code">Code du lobby</label>
            <input
              id="code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ex: 7XQ2P"
              maxLength={5}
            />
          </div>
          <button className="btn btn-primary" onClick={handleJoin}>
            Rejoindre
          </button>
        </>
      )}
    </div>
  );
}
