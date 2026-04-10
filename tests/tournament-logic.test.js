const test = require('node:test');
const assert = require('node:assert/strict');

const {
  boardLabel,
  generateRoundRobin,
  calculatePouleStandings,
  buildKOMatchesFromPlayers,
  generateKOfromStandings,
  schedulePouleMatches,
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
