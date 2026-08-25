import Avatar from "./Avatar.jsx";

export default function Header({ auth, onOpenAccount }) {
  return (
    <header className="site-header">
      <div className="brand">
        <span className="brand-mark">UniverseBattle</span>
        <span className="brand-tag">Le tournoi de tes goûts</span>
      </div>

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
    </header>
  );
}
