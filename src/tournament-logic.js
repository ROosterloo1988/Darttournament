function boardLabel(boardNames, boards, index) {
  const names = boardNames && boardNames.length
    ? boardNames
    : Array.from({ length: boards }, (_, i) => `Board ${i + 1}`);
  return names[(index - 1) % names.length] || `Board ${index}`;
}

function generateRoundRobin(players, boards, boardNames = [], pouleName = null) {
  const matches = [];
  let boardCounter = 1;

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const writer = players.find((p) => p !== players[i] && p !== players[j]) || "Volunteer";
      matches.push({
        phase: "poule",
        poule: pouleName,
        a: players[i],
        b: players[j],
        board: boardCounter,
        boardLabel: boardLabel(boardNames, boards, boardCounter),
        writer,
        scoreA: null,
        scoreB: null,
      });
      boardCounter = (boardCounter % boards) + 1;
    }
  }

  return matches;
}

function calculatePouleStandings(poules, matches) {
  return poules.map((poule) => {
    const table = poule.players.map((name) => ({ name, played: 0, wins: 0, losses: 0, legDiff: 0, points: 0 }));
    const index = Object.fromEntries(table.map((r) => [r.name, r]));

    matches
      .filter((m) => m.poule === poule.name && m.scoreA != null && m.scoreB != null)
      .forEach((m) => {
        const a = index[m.a];
        const b = index[m.b];
        if (!a || !b) return;

        a.played += 1;
        b.played += 1;
        a.legDiff += m.scoreA - m.scoreB;
        b.legDiff += m.scoreB - m.scoreA;

        if (m.scoreA > m.scoreB) {
          a.wins += 1;
          b.losses += 1;
          a.points += 2;
        } else if (m.scoreB > m.scoreA) {
          b.wins += 1;
          a.losses += 1;
          b.points += 2;
        } else {
          a.points += 1;
          b.points += 1;
        }
      });

    table.sort((x, y) => y.points - x.points || y.legDiff - x.legDiff || x.name.localeCompare(y.name));
    return { poule: poule.name, rows: table };
  });
}

function buildKOMatchesFromPlayers(players, boards, boardNames = [], startBoardOffset = 0) {
  const out = [];
  for (let i = 0; i < players.length; i += 2) {
    const boardIndex = ((startBoardOffset + i / 2) % boards) + 1;
    out.push({
      a: players[i] || "TBD",
      b: players[i + 1] || "TBD",
      board: boardIndex,
      boardLabel: boardLabel(boardNames, boards, boardIndex),
      writer: i < 2 ? "Volunteer" : "Loser previous match",
      scoreA: null,
      scoreB: null,
    });
  }
  return out;
}

function generateKOfromStandings(standings, boards, boardNames = []) {
  const winners = [];
  const losers = [];

  standings.forEach((group) => {
    if (group.rows[0]) winners.push(group.rows[0].name);
    if (group.rows[1]) winners.push(group.rows[1].name);
    group.rows.slice(2).forEach((r) => losers.push(r.name));
  });

  return {
    winner: buildKOMatchesFromPlayers(winners, boards, boardNames, 0),
    loser: buildKOMatchesFromPlayers(losers, boards, boardNames, 2),
  };
}

module.exports = {
  boardLabel,
  generateRoundRobin,
  calculatePouleStandings,
  buildKOMatchesFromPlayers,
  generateKOfromStandings,
};
