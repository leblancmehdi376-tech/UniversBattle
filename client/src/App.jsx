import { useEffect, useRef, useState } from "react";
import { fetchLobby, leaveLobby } from "./api.js";
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

const POLL_INTERVAL_MS = 1500;
const MAX_CONSECUTIVE_ERRORS = 3;
const THEME_KEY = "universebattle_theme";

export default function App() {
  const [activeSession, setActiveSession] = useState(() => loadSession());
  const [myId, setMyId] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(() => (loadSession() ? "checking" : "idle"));
  const [auth, setAuth] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "default";
    } catch {
      return "default";
    }
  });

  // Applique le thème sur <html> (les variables CSS du thème sont définies
  // via [data-theme="gold"] sur :root) et le retient pour la prochaine visite.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage indisponible - tant pis, le thème ne sera pas retenu
    }
  }, [theme]);

  // Les bannières d'erreur se referment toutes seules après quelques secondes.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

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

  // Boucle de polling: sert à la fois la reprise au montage (refresh de page)
  // et la synchronisation continue de l'état du lobby (remplace lobby:update).
  // Le tout premier appel raté est fatal (session invalide -> retour à
  // l'accueil), les suivants tolèrent jusqu'à MAX_CONSECUTIVE_ERRORS échecs
  // avant de considérer la session perdue (absorbe les erreurs réseau ponctuelles).
  useEffect(() => {
    if (!activeSession) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let timer = null;
    let isFirst = true;
    let errors = 0;

    async function tick() {
      try {
        const res = await fetchLobby(activeSession.code, activeSession.playerId);
        if (cancelled) return;
        errors = 0;
        isFirst = false;
        setMyId(activeSession.playerId);
        setLobby(res.lobby);
        setStatus("idle");
      } catch {
        if (cancelled) return;
        errors += 1;
        if (isFirst || errors >= MAX_CONSECUTIVE_ERRORS) {
          clearSession();
          setActiveSession(null);
          setMyId(null);
          setLobby(null);
          setStatus("idle");
          return;
        }
      }
      if (!cancelled) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSession]);

  function handleJoined(joinedLobby, playerId, name) {
    saveSession({ code: joinedLobby.code, playerId, name });
    setActiveSession({ code: joinedLobby.code, playerId, name });
    setMyId(playerId);
    setLobby(joinedLobby);
  }

  async function handleLeave() {
    if (activeSession) {
      try {
        await leaveLobby(activeSession.code, activeSession.playerId);
      } catch {
        // départ volontaire: on quitte localement même si la requête échoue
      }
    }
    clearSession();
    setActiveSession(null);
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
        return (
          <WaitingRoom
            lobby={lobby}
            myId={myId}
            isHost={isHost}
            onError={setError}
            applyLobby={setLobby}
          />
        );
      case "picking":
        return (
          <Picking
            lobby={lobby}
            myId={myId}
            onError={setError}
            applyLobby={setLobby}
          />
        );
      case "tournament":
        return (
          <Tournament
            lobby={lobby}
            myId={myId}
            isHost={isHost}
            applyLobby={setLobby}
            onError={setError}
          />
        );
      case "finished":
        return (
          <Winner
            lobby={lobby}
            myId={myId}
            isHost={isHost}
            onLeave={handleLeave}
            applyLobby={setLobby}
            onError={setError}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <Background />
      <Header
        auth={auth}
        onOpenAccount={() => setShowAccount((v) => !v)}
        showLeave={Boolean(lobby) && lobby.phase !== "finished"}
        onLeave={handleLeave}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "gold" ? "default" : "gold"))}
      />
      {error && <div className="error-banner">{error}</div>}
      <Stage stageKey={showAccount ? "account" : lobby ? lobby.phase : "home"}>
        {renderStage()}
      </Stage>
    </div>
  );
}
