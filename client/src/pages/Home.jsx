import { useState } from "react";
import { socket } from "../socket.js";
import Avatar from "../components/Avatar.jsx";

export default function Home({ auth, onError, onJoined }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState("create"); // 'create' | 'join'

  const effectiveName = auth ? auth.username : name;

  function createLobby() {
    if (!effectiveName.trim()) return onError("Entre un pseudo d'abord.");
    socket.emit("lobby:create", { name: effectiveName, authToken: auth?.token }, (res) => {
      if (res?.error) onError(res.error);
      else onJoined(res.lobby, res.playerId, effectiveName.trim());
    });
  }

  function joinLobby() {
    if (!effectiveName.trim()) return onError("Entre un pseudo d'abord.");
    if (!joinCode.trim()) return onError("Entre le code du lobby.");
    socket.emit(
      "lobby:join",
      { code: joinCode, name: effectiveName, authToken: auth?.token },
      (res) => {
        if (res?.error) onError(res.error);
        else onJoined(res.lobby, res.playerId, effectiveName.trim());
      }
    );
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
        <button className="btn btn-primary" onClick={createLobby}>
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
          <button className="btn btn-primary" onClick={joinLobby}>
            Rejoindre
          </button>
        </>
      )}
    </div>
  );
}
