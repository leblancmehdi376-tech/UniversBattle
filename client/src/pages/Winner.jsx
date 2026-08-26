import { replayLobby } from "../api.js";
import Avatar from "../components/Avatar.jsx";

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

function PodiumEntry({ item, label, compact }) {
  if (!item) return null;
  return (
    <div className={`podium-entry${compact ? " compact" : ""}`}>
      <img className="podium-image" src={item.image} alt={item.name} />
      <div className="podium-rank">{label}</div>
      <div className="podium-name">{item.name}</div>
      <div className="podium-owner">
        <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={18} />
        {item.ownerName}
      </div>
    </div>
  );
}

export default function Winner({ lobby, myId, isHost, onLeave, applyLobby, onError }) {
  const standings = lobby.bracket?.standings || [];
  if (standings.length === 0) return null;

  const champion = standings.find((s) => s.rank === 1)?.item;
  const runnerUp = standings.find((s) => s.rank === 2)?.item;
  const thirds = standings.filter((s) => s.rank === 3).map((s) => s.item);

  const tiers = [];
  for (const entry of standings.filter((s) => s.rank > 3)) {
    let group = tiers.find((t) => t.tier === entry.tier);
    if (!group) {
      group = { tier: entry.tier, items: [] };
      tiers.push(group);
    }
    group.items.push(entry.item);
  }

  async function handleReplay() {
    try {
      const res = await replayLobby(lobby.code, myId);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    }
  }

  return (
    <div className="panel champion-banner">
      <Confetti />
      <h3>Classement final</h3>

      <div className="podium">
        <div className="podium-slot podium-silver">
          <PodiumEntry item={runnerUp} label="2e" />
        </div>
        <div className="podium-slot podium-gold">
          <PodiumEntry item={champion} label="Champion" />
        </div>
        <div className="podium-slot podium-bronze">
          {thirds.map((item, i) => (
            <PodiumEntry key={item.id ?? i} item={item} label="3e" compact />
          ))}
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="standings-list">
          {tiers.map((group) => (
            <div key={group.tier} className="standings-tier">
              <h4>{group.tier}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={20} />
                    <span>{item.name}</span>
                    <span className="standings-owner">— {item.ownerName}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: "center", marginTop: 28 }}>
        {isHost && (
          <button className="btn btn-primary" onClick={handleReplay}>
            Rejouer
          </button>
        )}
        <button className="btn btn-ghost" onClick={onLeave}>
          Quitter
        </button>
      </div>
      {!isHost && (
        <p style={{ marginTop: 12 }}>En attente que l'hôte relance une partie…</p>
      )}
    </div>
  );
}
