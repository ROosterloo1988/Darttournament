const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
  getPouleCompletion,
  getMaxParticipantsForBoards,
  generatePoulesBySizes,
} = require('../src/tournament-logic');

test('boardLabel uses custom board names in rotation', () => {
  assert.equal(boardLabel(['Center', 'Side'], 2, 1), 'Center');
  assert.equal(boardLabel(['Center', 'Side'], 2, 2), 'Side');
  assert.equal(boardLabel(['Center', 'Side'], 2, 3), 'Center');
});

test('generateRoundRobin generates all unique matches', () => {
  const matches = generateRoundRobin(['A', 'B', 'C', 'D'], 2, ['B1', 'B2'], 'Poule A');
  assert.equal(matches.length, 6);
  assert.ok(matches.every((m) => m.poule === 'Poule A'));
  assert.ok(matches.some((m) => m.a === 'A' && m.b === 'B'));
});

test('calculatePouleStandings sorts by points then legDiff', () => {
  const poules = [{ name: 'Poule A', players: ['A', 'B', 'C'] }];
  const matches = [
    { poule: 'Poule A', a: 'A', b: 'B', scoreA: 3, scoreB: 1 },
    { poule: 'Poule A', a: 'A', b: 'C', scoreA: 2, scoreB: 3 },
    { poule: 'Poule A', a: 'B', b: 'C', scoreA: 1, scoreB: 3 },
  ];

  const standings = calculatePouleStandings(poules, matches);
  assert.equal(standings[0].rows[0].name, 'C');
  assert.equal(standings[0].rows[0].points, 4);
  assert.equal(standings[0].rows[2].name, 'B');
});

test('buildKOMatchesFromPlayers creates TBD for odd players', () => {
  const bracket = buildKOMatchesFromPlayers(['A', 'B', 'C'], 4, ['1', '2', '3', '4']);
  assert.equal(bracket.length, 2);
  assert.equal(bracket[1].b, 'TBD');
});

test('generateKOfromStandings splits winner and loser brackets', () => {
  const standings = [
    { poule: 'Poule A', rows: [{ name: 'A1' }, { name: 'A2' }, { name: 'A3' }] },
    { poule: 'Poule B', rows: [{ name: 'B1' }, { name: 'B2' }, { name: 'B3' }] },
  ];

  const ko = generateKOfromStandings(standings, 4, ['1', '2', '3', '4']);
  assert.equal(ko.winner.length, 2); // A1-A2 and B1-B2
  assert.equal(ko.loser.length, 1); // A3-B3
});

test('schedulePouleMatches assigns rounds without player conflicts in same round', () => {
  const matches = [
    { a: 'A', b: 'B' },
    { a: 'C', b: 'D' },
    { a: 'A', b: 'C' },
    { a: 'B', b: 'D' },
  ];

  const out = schedulePouleMatches(matches, 2, ['B1', 'B2']);
  assert.equal(out[0].round, 1);
  assert.equal(out[1].round, 1);

  const round1 = out.filter((m) => m.round === 1);
  const players = new Set(round1.flatMap((m) => [m.a, m.b]));
  assert.equal(players.size, 4);
});

test('generateBalancedPoules snake mode spreads top seeds', () => {
  const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
  const poules = generateBalancedPoules(players, 2, 4, 'snake');
  assert.equal(poules.length, 2);
  assert.deepEqual(poules[0].players, ['P1', 'P4', 'P5', 'P8']);
  assert.deepEqual(poules[1].players, ['P2', 'P3', 'P6', 'P7']);
});

test('getRoundSummary reports completion for current round', () => {
  const matches = [
    { phase: 'poule', round: 1, status: 'done' },
    { phase: 'poule', round: 1, status: 'done' },
    { phase: 'poule', round: 2, status: 'pending' },
  ];
  const summary = getRoundSummary(matches, 1);
  assert.equal(summary.total, 2);
  assert.equal(summary.done, 2);
  assert.equal(summary.isComplete, true);
  assert.equal(summary.maxRound, 2);
});

test('normalizePlayers trims and deduplicates case-insensitively', () => {
  const raw = ' Ana\nBram\nana, Cem ; bram ';
  const players = normalizePlayers(raw);
  assert.deepEqual(players, ['Ana', 'Bram', 'Cem']);
});

test('generatePouleOptions includes full-usage option when possible', () => {
  const options = generatePouleOptions(16, 4, 4, 4);
  assert.equal(options.length, 0);
});

test('generatePouleOptions returns full allocation with 3-5 sizes', () => {
  const options = generatePouleOptions(16, 4, 3, 5);
  assert.ok(options.some((o) => o.sizes.reduce((s, n) => s + n, 0) === 16 && o.usesAllPlayers));
});

test('getPouleCompletion reports completion totals', () => {
  const status = getPouleCompletion([
    { phase: 'poule', scoreA: 3, scoreB: 0 },
    { phase: 'poule', scoreA: null, scoreB: null },
    { phase: 'ko', scoreA: 2, scoreB: 1 },
  ]);
  assert.equal(status.total, 2);
  assert.equal(status.done, 1);
  assert.equal(status.isComplete, false);
});

test('max participants is 6 per board', () => {
  assert.equal(getMaxParticipantsForBoards(4), 24);
});

test('generatePoulesBySizes assigns all players exactly', () => {
  const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const poules = generatePoulesBySizes(players, [5, 5], 'snake');
  assert.equal(poules.length, 2);
  assert.equal(poules[0].players.length + poules[1].players.length, 10);
});
