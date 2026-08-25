import { useRef, useState } from "react";
import Avatar from "../components/Avatar.jsx";
import {
  registerAccount,
  loginAccount,
  uploadAvatar,
  saveAuth,
  clearAuth,
} from "../auth.js";

export default function Account({ auth, onAuthChange, onBack }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Remplis le pseudo et le mot de passe.");
      return;
    }
    setBusy(true);
    try {
      const action = mode === "login" ? loginAccount : registerAccount;
      const res = await action(username.trim(), password);
      const newAuth = { token: res.token, ...res.account };
      saveAuth(newAuth);
      onAuthChange(newAuth);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAuth();
    onAuthChange(null);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Image trop lourde (3 Mo max).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await uploadAvatar(auth.token, file);
      const newAuth = { ...auth, ...res.account };
      saveAuth(newAuth);
      onAuthChange(newAuth);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="panel">
      <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 20 }}>
        ← Retour
      </button>

      {error && <div className="error-banner">{error}</div>}

      {auth ? (
        <>
          <h2>Ton profil</h2>
          <div className="account-profile-row">
            <Avatar name={auth.username} avatarUrl={auth.avatarUrl} size={80} />
            <div>
              <h3 style={{ marginBottom: 4 }}>{auth.username}</h3>
              <p style={{ margin: 0 }}>
                Cette photo apparaîtra à côté de ton pseudo dans les lobbies.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div className="row" style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? "Envoi…" : "Choisir une photo depuis mon PC"}
            </button>
            <button className="btn btn-ghost" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
          <p>
            Facultatif : un compte te permet juste de garder une photo de
            profil d'une partie à l'autre. Tu peux jouer sans.
          </p>

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="acc-username">Pseudo</label>
              <input
                id="acc-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label htmlFor="acc-password">Mot de passe</label>
              <input
                id="acc-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "…" : mode === "login" ? "Se connecter" : "Créer le compte"}
            </button>
          </form>

          <p style={{ marginTop: 16 }}>
            {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <button
              className="btn-link"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
