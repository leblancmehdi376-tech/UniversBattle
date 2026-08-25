import { useEffect, useRef, useState } from "react";
import { socket } from "./socket.js";
import { saveSession, loadSession, clearSession } from "./session.js";
import { loadAuth, saveAuth, clearAuth, fetchMe } from "./auth.js";
import Home from "./pages/Home.jsx";
import WaitingRoom from "./pages/WaitingRoom.jsx";
import Picking from "./pages/Picking.jsx";
import Tournament from "./pages/Tournament.jsx";
import Winner from "./pages/Winner.jsx";
import Account from "./pages/Account.jsx";
import Stage from "./components/Stage.jsx";
import Background from "./components/Background.jsx";
import Header from "./components/Header.jsx";

export default function App() {
  const [myId, setMyId] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("checking");
  const [auth, setAuth] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const attemptedReconnect = useRef(false);

  useEffect(() => {
    function onLobbyUpdate(updated) {
      setLobby(updated);
    }
    socket.on("lobby:update", onLobbyUpdate);
    return () => socket.off("lobby:update", onLobbyUpdate);
  }, []);

  // Charge le compte (si un token valide existe) au démarrage
  useEffect(() => {
    const stored = loadAuth();
    if (!stored) return;
    fetchMe(stored.token)
      .then((res) => {
        const refreshed = { token: stored.token, ...res.account };
        saveAuth(refreshed);
        setAuth(refreshed);
      })
      .catch(() => {
        clearAuth();
      });
  }, []);

  // Tentative de reconnexion automatique au chargement (refresh de page)
  useEffect(() => {
    if (attemptedReconnect.current) return;
    attemptedReconnect.current = true;

    const session = loadSession();
    if (!session) {
      setStatus("idle");
      return;
    }

    function tryReconnect() {
      socket.emit(
        "lobby:reconnect",
        { code: session.code, playerId: session.playerId },
        (res) => {
          if (res?.error) {
            clearSession();
            setStatus("idle");
          } else {
            setMyId(session.playerId);
            setLobby(res.lobby);
            setStatus("idle");
          }
        }
      );
    }

    if (socket.connected) tryReconnect();
    else socket.once("connect", tryReconnect);
  }, []);

  function handleJoined(joinedLobby, playerId, name) {
    saveSession({ code: joinedLobby.code, playerId, name });
    setMyId(playerId);
    setLobby(joinedLobby);
  }

  function handleLeave() {
    const session = loadSession();
    if (session) {
      socket.emit("lobby:leave", { code: session.code, playerId: session.playerId });
    }
    clearSession();
    setMyId(null);
    setLobby(null);
  }

  const isHost = lobby && myId === lobby.hostId;

  function renderStage() {
    if (showAccount) {
      return (
        <Account
          auth={auth}
          onAuthChange={setAuth}
          onBack={() => setShowAccount(false)}
        />
      );
    }
    if (status === "checking") {
      return (
        <div className="panel loading-panel">
          <p>Reconnexion en cours…</p>
        </div>
      );
    }
    if (!lobby) {
      return <Home auth={auth} onError={setError} onJoined={handleJoined} />;
    }
    switch (lobby.phase) {
      case "waiting":
        return <WaitingRoom lobby={lobby} isHost={isHost} onError={setError} />;
      case "picking":
        return <Picking lobby={lobby} myId={myId} onError={setError} />;
      case "tournament":
        return <Tournament lobby={lobby} myId={myId} />;
      case "finished":
        return <Winner lobby={lobby} isHost={isHost} onLeave={handleLeave} />;
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <Background />
      <Header auth={auth} onOpenAccount={() => setShowAccount((v) => !v)} />
      {error && <div className="error-banner">{error}</div>}
      <Stage stageKey={showAccount ? "account" : lobby ? lobby.phase : "home"}>
        {renderStage()}
      </Stage>
    </div>
  );
}
