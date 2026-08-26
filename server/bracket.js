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
  const totalMatches = size / 2;
  const byesNeeded = size - items.length;

  // Un bye par match maximum (jamais deux null en face à face): les
  // `byesNeeded` premiers matchs reçoivent un bye, les autres deux vrais items.
  const matches = [];
  let idx = 0;
  for (let i = 0; i < totalMatches; i++) {
    const a = items[idx++];
    const b = i < byesNeeded ? null : items[idx++];
    matches.push({
      id: `r1-m${i}`,
      a,
      b,
      votes: {}, // playerId -> 'a' | 'b'
      winner: null,
      tieBreak: false,
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
    history: [],
    finished: false,
    champion: null,
    standings: null,
    // id du duel dont le gagnant vient d'être révélé et attend que l'hôte
    // passe au suivant (plus de timer auto: c'est un choix humain).
    pendingReveal: null,
  };
}

/** Construit le round suivant à partir des vainqueurs du round courant */
export function buildNextRound(bracket) {
  const winners = bracket.matches.map((m) => m.winner);
  const history = [...bracket.history, { round: bracket.round, matches: bracket.matches }];

  if (winners.length === 1) {
    return {
      round: bracket.round,
      totalRounds: bracket.totalRounds,
      matches: bracket.matches,
      history,
      finished: true,
      champion: winners[0],
      standings: computeStandings(history),
      pendingReveal: null,
    };
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
      tieBreak: false,
    };
    if (a && !b) match.winner = a;
    matches.push(match);
  }

  return {
    round: bracket.round + 1,
    totalRounds: bracket.totalRounds,
    matches,
    history,
    finished: false,
    champion: null,
    standings: null,
    pendingReveal: null,
  };
}

/** Tranche un match une fois tous les votes reçus (majorité, égalité = pile ou face) */
export function resolveMatch(match) {
  const tally = { a: 0, b: 0 };
  for (const choice of Object.values(match.votes)) {
    tally[choice] = (tally[choice] || 0) + 1;
  }
  match.tieBreak = tally.a === tally.b;
  match.winner = match.tieBreak
    ? (Math.random() < 0.5 ? match.a : match.b)
    : (tally.a > tally.b ? match.a : match.b);
  return match;
}

export function allMatchesResolved(bracket) {
  return bracket.matches.every((m) => m.winner !== null);
}

const TIER_NAMES = {
  1: "Demi-finaliste",
  2: "Quart de finaliste",
  3: "Huitième de finaliste",
  4: "Seizième de finaliste",
  5: "Trente-deuxième de finaliste",
  6: "Soixante-quatrième de finaliste",
};

function tierLabel(round, totalRounds) {
  return TIER_NAMES[totalRounds - round] || `Éliminé(e) au tour ${round}`;
}

/**
 * Classement complet à partir de l'historique complet des rounds (y compris
 * le round final). Rang 1 = champion, rang 2 = finaliste, puis un palier par
 * round d'élimination (les perdants d'un même round sont ex æquo). Comparaison
 * par id (pas par référence): les objets traversent le JSON du store/HTTP et
 * ne restent pas forcément le même objet en mémoire.
 */
export function computeStandings(history) {
  if (history.length === 0) return [];
  const totalRounds = history[history.length - 1].round;
  const finalMatch = history[history.length - 1].matches[0];

  const standings = [{ rank: 1, tier: "Champion", item: finalMatch.winner }];
  const runnerUp = finalMatch.winner.id === finalMatch.a?.id ? finalMatch.b : finalMatch.a;
  if (runnerUp) {
    standings.push({ rank: 2, tier: "Finaliste", item: runnerUp });
  }

  // Rounds précédents, du plus tardif (demi-finale) au plus ancien.
  for (let i = history.length - 2; i >= 0; i--) {
    const { round, matches } = history[i];
    const losers = matches
      .map((m) => (m.winner.id === m.a?.id ? m.b : m.a))
      .filter(Boolean); // exclut les byes (pas de vrai perdant)
    if (losers.length === 0) continue;
    const rank = standings.length + 1;
    const tier = tierLabel(round, totalRounds);
    for (const item of losers) {
      standings.push({ rank, tier, item });
    }
  }

  return standings;
}
