(function initTournamentLogic(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TournamentLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
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
        const writer = players.find((p) => p !== players[i] && p !== players[j]) || 'Volunteer';
        matches.push({
          phase: 'poule',
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
        a: players[i] || 'TBD',
        b: players[i + 1] || 'TBD',
        board: boardIndex,
        boardLabel: boardLabel(boardNames, boards, boardIndex),
        writer: i < 2 ? 'Volunteer' : 'Loser previous match',
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

  function schedulePouleMatches(matches, boards, boardNames = []) {
    const rounds = [];
    const scheduled = matches.map((m) => ({ ...m }));

    scheduled.forEach((match) => {
      let placed = false;

      for (let r = 0; r < rounds.length; r += 1) {
        const round = rounds[r];
        const playersBusy = round.players.has(match.a) || round.players.has(match.b);
        const boardFull = round.matches.length >= boards;
        if (playersBusy || boardFull) continue;

        round.players.add(match.a);
        round.players.add(match.b);
        round.matches.push(match);
        match.round = r + 1;
        match.board = round.matches.length;
        match.boardLabel = boardLabel(boardNames, boards, match.board);
        placed = true;
        break;
      }

      if (!placed) {
        const newRound = { players: new Set([match.a, match.b]), matches: [match] };
        rounds.push(newRound);
        match.round = rounds.length;
        match.board = 1;
        match.boardLabel = boardLabel(boardNames, boards, 1);
      }
    });

    return scheduled;
  }

  function shuffleArray(items) {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateBalancedPoules(players, pouleCount, pouleSize, method = 'snake') {
    const required = pouleCount * pouleSize;
    const selected = players.slice(0, required);
    if (selected.length < required) {
      throw new Error('Not enough players to fill all poules');
    }

    const source = method === 'random' ? shuffleArray(selected) : [...selected];
    const poules = Array.from({ length: pouleCount }, (_, i) => ({
      name: `Poule ${String.fromCharCode(65 + i)}`,
      players: [],
    }));

    if (method === 'random') {
      source.forEach((player, idx) => {
        poules[idx % pouleCount].players.push(player);
      });
      return poules;
    }

    let index = 0;
    let direction = 1;
    source.forEach((player) => {
      poules[index].players.push(player);
      if (direction === 1 && index === pouleCount - 1) direction = -1;
      else if (direction === -1 && index === 0) direction = 1;
      else index += direction;
    });

    return poules;
  }

  function getRoundSummary(matches, currentRound = 1) {
    const pouleMatches = matches.filter((m) => m.phase === 'poule');
    const maxRound = Math.max(...pouleMatches.map((m) => m.round || 1), 1);
    const current = pouleMatches.filter((m) => (m.round || 1) === currentRound);
    const done = current.filter((m) => m.status === 'done' || (m.scoreA != null && m.scoreB != null)).length;
    return {
      currentRound,
      maxRound,
      total: current.length,
      done,
      isComplete: current.length > 0 && done === current.length,
    };
  }

  function normalizePlayers(input) {
    const items = Array.isArray(input)
      ? input
      : String(input || '')
          .split(/[\n,;]/g)
          .map((v) => v.trim());

    const seen = new Set();
    const out = [];
    items.forEach((name) => {
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(name);
    });
    return out;
  }

  return {
    boardLabel,
    generateRoundRobin,
    calculatePouleStandings,
    buildKOMatchesFromPlayers,
    generateKOfromStandings,
    schedulePouleMatches,
    generateBalancedPoules,
    getRoundSummary,
    normalizePlayers,
  };
});
