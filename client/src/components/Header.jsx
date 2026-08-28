import Avatar from "./Avatar.jsx";

export default function Header({ auth, onOpenAccount, showLeave, onLeave, theme, onToggleTheme }) {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-mark">UniverseBattle</span>
        <span className="brand-tag">Le tournoi de tes goûts</span>
      </div>

      <div className="row" style={{ marginBottom: 0 }}>
        <button
          className="btn btn-ghost theme-toggle"
          onClick={onToggleTheme}
          title={theme === "gold" ? "Thème violet & or" : "Thème noir & or"}
        >
          {theme === "gold" ? "✨ Violet & or" : "🖤 Noir & or"}
        </button>
        {showLeave && (
          <button className="btn btn-ghost" onClick={onLeave}>
            Quitter
          </button>
        )}
        <button className="account-chip" onClick={onOpenAccount}>
          {auth ? (
            <>
              <Avatar name={auth.username} avatarUrl={auth.avatarUrl} size={30} />
              <span>{auth.username}</span>
            </>
          ) : (
            <span>Connexion</span>
          )}
        </button>
      </div>
    </header>
  );
}
