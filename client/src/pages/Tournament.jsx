import { socket } from "../socket.js";
import Avatar from "../components/Avatar.jsx";

function Contender({ item, match, side, myId, totalPlayers }) {
  if (!item) {
    return <div className="contender-bye">Passe automatiquement</div>;
  }

  const myVote = match.votes[myId];
  const hasVoted = Boolean(myVote);
  const isDecided = Boolean(match.winner);
  const isWinner = isDecided && match.winner.id === item.id;
  const isLoser = isDecided && match.winner.id !== item.id;
  const iVotedThis = myVote === side;

  const classes = ["contender"];
  if (iVotedThis) classes.push("voted-mine");
  if (isWinner) classes.push("is-winner");
  if (isLoser) classes.push("is-loser");

  function vote() {
    if (hasVoted || isDecided) return;
    socket.emit("tournament:vote", {
      code: match._code,
      matchId: match.id,
      choice: side,
    });
  }

  const votesForThisMatch = Object.keys(match.votes).length;

  return (
    <button
      className={classes.join(" ")}
      onClick={vote}
      disabled={hasVoted || isDecided}
    >
      <img src={item.image} alt={item.name} />
      <div className="contender-label">
        <div className="contender-name">{item.name}</div>
        <div className="contender-owner">
          <Avatar name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size={16} />
          <span>choisi par {item.ownerName}</span>
        </div>
        {!isDecided && (
          <div className="contender-owner">
            {iVotedThis ? "✓ Ton vote — " : ""}
            {votesForThisMatch}/{totalPlayers} votes
          </div>
        )}
      </div>
    </button>
  );
}

export default function Tournament({ lobby, myId }) {
  const { bracket, code } = lobby;
  const totalPlayers = lobby.players.length;

  // Trie: duels en attente de vote d'abord, terminés ensuite
  const matches = [...bracket.matches].sort((a, b) => {
    if (a.winner && !b.winner) return 1;
    if (!a.winner && b.winner) return -1;
    return 0;
  });

  return (
    <div className="panel">
      <div className="round-title">
        <h2>Round {bracket.round} — {bracket.matches.length} duel(s)</h2>
      </div>
      {bracket.totalRounds > 0 && (
        <div className="progress-track" style={{ marginBottom: 24 }}>
          <div
            className="progress-fill gold"
            style={{ width: `${(bracket.round / bracket.totalRounds) * 100}%` }}
          />
        </div>
      )}

      {matches.map((match) => {
        const enriched = { ...match, _code: code };
        return (
          <div className="duel-card" key={match.id}>
            <div className="duel-vs">VS</div>
            <div className="duel-contenders">
              <Contender
                item={match.a}
                match={enriched}
                side="a"
                myId={myId}
                totalPlayers={totalPlayers}
              />
              <Contender
                item={match.b}
                match={enriched}
                side="b"
                myId={myId}
                totalPlayers={totalPlayers}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
