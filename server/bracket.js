// Mélange un tableau (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Construit le premier round du tournoi à partir de tous les picks des joueurs.
 * Chaque item garde une trace de qui l'a proposé (ownerId), pour éviter
 * (autant que possible) qu'un joueur affronte directement son propre pick.
 */
export function buildBracket(allItems) {
  const items = shuffle(allItems);
  const size = nextPowerOfTwo(items.length);
  const byesNeeded = size - items.length;

  const slots = [...items];
  for (let i = 0; i < byesNeeded; i++) {
    slots.push(null); // null = bye, l'adversaire passe automatiquement
  }

  const matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    matches.push({
      id: `r1-m${i / 2}`,
      a: slots[i],
      b: slots[i + 1],
      votes: {}, // playerId -> 'a' | 'b'
      winner: null,
    });
  }

  // Résoudre immédiatement les byes
  for (const m of matches) {
    if (m.a && !m.b) m.winner = m.a;
    if (m.b && !m.a) m.winner = m.b;
  }

  return {
    round: 1,
    totalRounds: Math.log2(size),
    matches,
    finished: false,
    champion: null,
  };
}

/** Construit le round suivant à partir des vainqueurs du round courant */
export function buildNextRound(bracket) {
  const winners = bracket.matches.map((m) => m.winner);

  if (winners.length === 1) {
    bracket.finished = true;
    bracket.champion = winners[0];
    return bracket;
  }

  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i];
    const b = winners[i + 1] ?? null;
    const match = {
      id: `r${bracket.round + 1}-m${i / 2}`,
      a,
      b,
      votes: {},
      winner: null,
    };
    if (a && !b) match.winner = a;
    matches.push(match);
  }

  return {
    round: bracket.round + 1,
    totalRounds: bracket.totalRounds,
    matches,
    finished: false,
    champion: null,
  };
}

/** Tranche un match une fois tous les votes reçus (majorité, égalité = aléatoire) */
export function resolveMatch(match) {
  const tally = { a: 0, b: 0 };
  for (const choice of Object.values(match.votes)) {
    tally[choice] = (tally[choice] || 0) + 1;
  }
  if (tally.a === tally.b) {
    match.winner = Math.random() < 0.5 ? match.a : match.b;
  } else {
    match.winner = tally.a > tally.b ? match.a : match.b;
  }
  return match;
}

export function allMatchesResolved(bracket) {
  return bracket.matches.every((m) => m.winner !== null);
}
