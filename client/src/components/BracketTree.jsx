import Avatar from "./Avatar.jsx";

function ContenderRow({ item, isWinner, isDecided }) {
  if (!item) {
    return <div className="bt-slot bt-bye">Bye</div>;
  }
  const classes = ["bt-slot"];
  if (isDecided) classes.push(isWinner ? "bt-winner" : "bt-loser");
  return (
    <div className={classes.join(" ")}>
      <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={16} />
      <span className="bt-name">{item.name}</span>
    </div>
  );
}

/**
 * Arbre de tournoi compact: une colonne par round, connecteurs simples en CSS
 * (pas un rendu SVG pixel-perfect). `rounds` = history + round courant, dans
 * l'ordre chronologique.
 */
export default function BracketTree({ rounds, currentMatchId }) {
  return (
    <div className="bracket-tree">
      {rounds.map(({ round, matches }) => (
        <div className="bracket-round" key={round}>
          <div className="bracket-round-label">Round {round}</div>
          {matches.map((m) => {
            const decided = Boolean(m.winner);
            const isCurrent = m.id === currentMatchId;
            return (
              <div
                className={`bracket-match${isCurrent ? " bracket-match-current" : ""}`}
                key={m.id}
              >
                <ContenderRow
                  item={m.a}
                  isDecided={decided}
                  isWinner={decided && m.winner.id === m.a?.id}
                />
                <ContenderRow
                  item={m.b}
                  isDecided={decided}
                  isWinner={decided && m.winner.id === m.b?.id}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
