const CONFETTI_COLORS = ["#ff4d6d", "#ffc94d", "#7a6bff", "#4dd6ff", "#4dff88"];

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const left = Math.round((i / 24) * 100 + (i % 3) * 2);
    const delay = (i % 8) * 0.25;
    const duration = 3 + (i % 5) * 0.4;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    return (
      <span
        key={i}
        className="confetti-piece"
        style={{
          left: `${left}%`,
          background: color,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
        }}
      />
    );
  });
  return <div className="confetti" aria-hidden="true">{pieces}</div>;
}

export default function Winner({ lobby, isHost, onLeave }) {
  const champion = lobby.bracket?.champion;
  if (!champion) return null;

  return (
    <div className="panel champion-banner">
      <Confetti />
      <h3>Champion de l'univers</h3>
      <img className="champion-image" src={champion.image} alt={champion.name} />
      <h1>{champion.name}</h1>
      <p>Choisi à l'origine par {champion.ownerName}</p>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onLeave}>
        {isHost ? "Nouvelle partie" : "Quitter"}
      </button>
    </div>
  );
}
