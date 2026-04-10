(function initStore(global) {
  const STORAGE_KEY = 'darttournament_state_v4';

  const initialState = {
    superAdmins: ['alice', 'bob'],
    tournamentAdmins: { spring_open: ['charlie', 'alice'] },
    tournaments: [
      {
        id: 'spring_open',
        name: 'Spring Open',
        season: '2026 Spring',
        date: '2026-05-18',
        boards: 4,
        boardNames: ['Board 1', 'Board 2', 'Board 3', 'Board 4'],
        users: ['Ana', 'Bram', 'Cem', 'Daan', 'Eli', 'Fay', 'Gus', 'Hugo'],
        poules: [],
        matches: [],
        ko: { winner: [], loser: [] },
        scoreHistory: [],
      },
    ],
    currentUser: 'alice',
  };

  function ensureTournamentDefaults(t) {
    return {
      ...t,
      boards: t.boards || 4,
      boardNames:
        t.boardNames && t.boardNames.length
          ? t.boardNames
          : Array.from({ length: t.boards || 4 }, (_, i) => `Board ${i + 1}`),
      users: t.users || [],
      poules: t.poules || [],
      matches: t.matches || [],
      ko: t.ko || { winner: [], loser: [] },
      scoreHistory: t.scoreHistory || [],
    };
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return structuredClone(initialState);
    }

    try {
      const parsed = JSON.parse(raw);
      parsed.superAdmins = parsed.superAdmins || [];
      parsed.tournamentAdmins = parsed.tournamentAdmins || {};
      parsed.currentUser = parsed.currentUser || 'alice';
      parsed.tournaments = (parsed.tournaments || []).map(ensureTournamentDefaults);
      return parsed;
    } catch {
      return structuredClone(initialState);
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  global.DartStore = {
    STORAGE_KEY,
    initialState,
    load,
    save,
    ensureTournamentDefaults,
  };
})(window);
