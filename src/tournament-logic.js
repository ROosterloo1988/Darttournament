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
    const unscheduled = matches.map((m) => ({ ...m }));
    const out = [];
    const lastRoundPlayed = {};
    let roundNumber = 1;

    while (unscheduled.length) {
      const round = { players: new Set(), matches: [] };
      while (round.matches.length < boards) {
        let bestIdx = -1;
        let bestPenalty = Number.POSITIVE_INFINITY;

        unscheduled.forEach((match, idx) => {
          const playersBusy = round.players.has(match.a) || round.players.has(match.b);
          if (playersBusy) return;
          const penalty =
            (lastRoundPlayed[match.a] === roundNumber - 1 ? 1 : 0) +
            (lastRoundPlayed[match.b] === roundNumber - 1 ? 1 : 0);
          if (penalty < bestPenalty) {
            bestPenalty = penalty;
            bestIdx = idx;
          }
        });

        if (bestIdx === -1) break;
        const [match] = unscheduled.splice(bestIdx, 1);
        round.players.add(match.a);
        round.players.add(match.b);
        round.matches.push(match);
        lastRoundPlayed[match.a] = roundNumber;
        lastRoundPlayed[match.b] = roundNumber;
      }

      round.matches.forEach((match, idx) => {
        match.round = roundNumber;
        match.board = idx + 1;
        match.boardLabel = boardLabel(boardNames, boards, idx + 1);
        out.push(match);
      });

      roundNumber += 1;
    }

    return out;
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

  function boardUnitsForPouleSize(size) {
    if (size === 3) return 0.5; // 2 poules of 3 on 1 board
    if (size === 4 || size === 5 || size === 6) return 1; // 1 poule of 4/5/6 on 1 board
    return Number.POSITIVE_INFINITY;
  }

  function getMaxParticipantsForBoards(boards) {
    return Math.max(boards, 0) * 6;
  }

  function generatePouleOptions(playerCount, boards, minSize = 3, maxSize = 6) {
    if (!playerCount || !boards || minSize !== 3 || maxSize !== 6) return [];
    if (playerCount > getMaxParticipantsForBoards(boards)) return [];

    const options = [];
    const max3 = Math.floor(playerCount / 3);
    const max4 = Math.floor(playerCount / 4);
    const max5 = Math.floor(playerCount / 5);
    const max6 = Math.floor(playerCount / 6);

    for (let c3 = 0; c3 <= max3; c3 += 1) {
      for (let c4 = 0; c4 <= max4; c4 += 1) {
        for (let c5 = 0; c5 <= max5; c5 += 1) {
          for (let c6 = 0; c6 <= max6; c6 += 1) {
            const usedPlayers = c3 * 3 + c4 * 4 + c5 * 5 + c6 * 6;
            if (usedPlayers !== playerCount) continue;
            const boardUnits =
              c3 * boardUnitsForPouleSize(3) +
              c4 * boardUnitsForPouleSize(4) +
              c5 * boardUnitsForPouleSize(5) +
              c6 * boardUnitsForPouleSize(6);
            if (boardUnits > boards) continue;

            const sizes = [
              ...Array.from({ length: c6 }, () => 6),
              ...Array.from({ length: c5 }, () => 5),
              ...Array.from({ length: c4 }, () => 4),
              ...Array.from({ length: c3 }, () => 3),
            ];
            const totalMatches = sizes.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
            options.push({
              sizes,
              pouleCount: sizes.length,
              usedPlayers,
              leftoverPlayers: 0,
              totalMatches,
              estimatedRounds: Math.ceil(totalMatches / boards),
              boardUnits,
              usesAllPlayers: true,
            });
          }
        }
      }
    }

    return options.sort((a, b) => {
      if (a.estimatedRounds !== b.estimatedRounds) return a.estimatedRounds - b.estimatedRounds;
      const aSmall3 = a.sizes.filter((s) => s === 3).length;
      const bSmall3 = b.sizes.filter((s) => s === 3).length;
      if (aSmall3 !== bSmall3) return aSmall3 - bSmall3;
      if (a.pouleCount !== b.pouleCount) return a.pouleCount - b.pouleCount;
      return b.sizes.join(',').localeCompare(a.sizes.join(','));
    });
  }

  function generatePoulesBySizes(players, sizes, method = 'snake') {
    const source = method === 'random' ? shuffleArray(players) : [...players];
    const poules = sizes.map((size, i) => ({
      name: `Poule ${String.fromCharCode(65 + i)}`,
      players: [],
      targetSize: size,
    }));

    if (method === 'random') {
      let cursor = 0;
      poules.forEach((p) => {
        p.players = source.slice(cursor, cursor + p.targetSize);
        cursor += p.targetSize;
      });
      return poules.map(({ targetSize, ...rest }) => rest);
    }

    const slots = poules.flatMap((p, i) => Array.from({ length: p.targetSize }, () => i));
    let left = 0;
    let right = poules.length - 1;
    let direction = 1;
    for (let i = 0; i < slots.length; i += 1) {
      slots[i] = direction === 1 ? left : right;
      if (direction === 1) {
        if (left >= right) direction = -1;
        else left += 1;
      } else if (right <= left) direction = 1;
      else right -= 1;
    }

    source.forEach((player, idx) => {
      const pouleIndex = slots[idx];
      if (pouleIndex == null) return;
      poules[pouleIndex].players.push(player);
    });

    return poules.map(({ targetSize, ...rest }) => rest);
  }

  function generatePoulesForAllPlayers(players, boards, method = 'snake') {
    const options = generatePouleOptions(players.length, boards, 3, 6);
    if (!options.length) {
      throw new Error('No valid poule layout for all players with current board count (sizes must be 3-6).');
    }
    return {
      option: options[0],
      poules: generatePoulesBySizes(players, options[0].sizes, method),
    };
  }

  function getPouleCompletion(matches) {
    const pouleMatches = (matches || []).filter((m) => m.phase === 'poule');
    const total = pouleMatches.length;
    const done = pouleMatches.filter((m) => m.scoreA != null && m.scoreB != null).length;
    return {
      total,
      done,
      isComplete: total > 0 && done === total,
    };
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
    generatePouleOptions,
    generatePoulesBySizes,
    generatePoulesForAllPlayers,
    getMaxParticipantsForBoards,
    getPouleCompletion,
  };
});
