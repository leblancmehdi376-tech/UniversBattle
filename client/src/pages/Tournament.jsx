import { useState } from "react";
import { vote as apiVote, advanceRound } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import BracketTree from "../components/BracketTree.jsx";

function Contender({ item, side, isWinner, isLoser, iVotedThis, hasVoted, isDecided, voters, onVote }) {
  if (!item) {
    return <div className="contender-bye">Passe automatiquement</div>;
  }

  const classes = ["contender"];
  if (iVotedThis) classes.push("voted-mine");
  if (isWinner) classes.push("is-winner");
  if (isLoser) classes.push("is-loser");

  return (
    <button
      className={classes.join(" ")}
      onClick={() => onVote(side)}
      disabled={hasVoted || isDecided}
    >
      <img className="contender-fg" src={item.image} alt={item.name} />
      <div className="contender-label">
        <div className="contender-name">{item.name}</div>
        <div className="contender-owner">
          <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={16} />
          <span>choisi par {item.ownerName}</span>
        </div>
        {!isDecided && voters.length > 0 && (
          <div className="contender-voters">
            {voters.map((v) => (
              <Avatar key={v.id} name={v.name} avatarUrl={v.avatarUrl} size={36} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export default function Tournament({ lobby, myId, isHost, applyLobby, onError }) {
  const { bracket, code } = lobby;
  const realMatches = bracket.matches.filter((m) => m.a && m.b);
  const currentMatch = realMatches.find((m) => !m.winner) ?? null;
  // Le gagnant du duel précédent reste affiché tant que l'hôte n'a pas
  // confirmé (plus de minuteur auto) - dérivé du bracket, donc synchronisé
  // pour tout le monde sans logique de timing côté client.
  const pendingMatch = bracket.pendingReveal
    ? realMatches.find((m) => m.id === bracket.pendingReveal) ?? null
    : null;
  const shownMatch = pendingMatch || currentMatch;
  const revealing = Boolean(pendingMatch);
  const doneCount = realMatches.filter((m) => m.winner).length;

  const [showTree, setShowTree] = useState(false);
  const [voting, setVoting] = useState(false); // anti double-clic pendant la requête
  const [advancing, setAdvancing] = useState(false);

  async function castVote(side) {
    if (voting || !shownMatch) return;
    setVoting(true);
    try {
      const res = await apiVote(code, myId, shownMatch.id, side);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setVoting(false);
    }
  }

  async function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    try {
      const res = await advanceRound(code, myId);
      applyLobby(res.lobby);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setAdvancing(false);
    }
  }

  const rounds = [...bracket.history, { round: bracket.round, matches: bracket.matches }];

  return (
    <div className={`tournament-layout${showTree ? " tree-open" : ""}`}>
      <div className="tournament-main panel">
        <div className="round-title">
          <h2>Round {bracket.round} / {bracket.totalRounds}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-tree-toggle"
            onClick={() => setShowTree((v) => !v)}
          >
            {showTree ? "Masquer l'arbre" : "Voir l'arbre du tournoi"}
          </button>
        </div>
        <div className="progress-track" style={{ marginBottom: 20 }}>
          <div
            className="progress-fill gold"
            style={{ width: `${realMatches.length ? (doneCount / realMatches.length) * 100 : 0}%` }}
          />
        </div>
        <p style={{ marginTop: -10, marginBottom: 20 }}>
          Duel {Math.min(doneCount + 1, realMatches.length)}/{realMatches.length} — toute la table vote
          sur le même duel
        </p>

        {shownMatch ? (
          <div key={shownMatch.id} className={`duel-card${revealing ? " duel-reveal" : ""}`}>
            <div className="duel-vs">VS</div>
            <div className="duel-contenders">
              {["a", "b"].map((side) => {
                const item = shownMatch[side];
                const isDecided = Boolean(shownMatch.winner);
                const isWinner = isDecided && item && shownMatch.winner.id === item.id;
                const isLoser = isDecided && item && shownMatch.winner.id !== item.id;
                const myVote = shownMatch.votes[myId];
                const voters = lobby.players.filter((p) => shownMatch.votes[p.id] === side);
                return (
                  <Contender
                    key={side}
                    item={item}
                    side={side}
                    isWinner={isWinner}
                    isLoser={isLoser}
                    iVotedThis={myVote === side}
                    hasVoted={Boolean(myVote) || revealing || voting}
                    isDecided={isDecided}
                    voters={voters}
                    onVote={castVote}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="waiting-panel">
            <p>En attente du prochain duel…</p>
          </div>
        )}

        {revealing && shownMatch?.winner && (
          <div className="winner-popup" key={`popup-${shownMatch.id}`}>
            <div className="winner-popup-card">
              {shownMatch.tieBreak && (
                <div className="tie-flip">
                  <div className="tie-coin">
                    <span className="tie-coin-face">🪙</span>
                  </div>
                  <p className="tie-flip-label">Égalité — pile ou face !</p>
                </div>
              )}
              <div className="winner-popup-body">
                <div className="winner-popup-media">
                  <img className="winner-popup-fg" src={shownMatch.winner.image} alt={shownMatch.winner.name} />
                </div>
                <div className="winner-popup-info">
                  <div className="winner-popup-trophy" aria-hidden="true">🏆</div>
                  <h3 className="winner-popup-name">{shownMatch.winner.name}</h3>
                  <p className="winner-popup-sub">remporte ce duel !</p>
                  {isHost ? (
                    <button
                      type="button"
                      className="btn btn-primary winner-popup-advance"
                      disabled={advancing}
                      onClick={handleAdvance}
                    >
                      Duel suivant
                    </button>
                  ) : (
                    <p className="winner-popup-wait">En attente que l'hôte continue…</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showTree && (
        <div className="tournament-sidebar">
          <h3>Arbre du tournoi</h3>
          <BracketTree rounds={rounds} currentMatchId={shownMatch?.id ?? null} />
        </div>
      )}
    </div>
  );
}
