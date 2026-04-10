(function initApp(global) {
  const Logic = global.TournamentLogic;
  const Store = global.DartStore;
  const state = Store.load();

  const el = (id) => document.getElementById(id);

  function saveState() {
    Store.save(state);
  }

  function getTournamentById(id) {
    return state.tournaments.find((t) => t.id === id);
  }

  function isSuperAdmin() {
    return state.superAdmins.includes(state.currentUser);
  }

  function isTournamentAdmin(tournamentId) {
    return (state.tournamentAdmins[tournamentId] || []).includes(state.currentUser);
  }

  function canManageTournament(tournamentId) {
    return isSuperAdmin() || isTournamentAdmin(tournamentId);
  }

  function initTabs() {
    document.querySelectorAll('.tab').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        button.classList.add('active');
        el(button.dataset.tab).classList.add('active');
      });
    });

    document.querySelectorAll('.quick').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelector(`.tab[data-tab='${button.dataset.tabTarget}']`).click();
      });
    });
  }

  function tournamentOptions(selectId) {
    const select = el(selectId);
    select.innerHTML = state.tournaments
      .map((t) => `<option value="${t.id}">${t.name} (${t.season})</option>`)
      .join('');
  }

  function renderDashboard() {
    el('season-list').innerHTML = state.tournaments
      .map((t) => `<li>${t.season}: ${t.name} (${t.date}) - ${t.users.length} users</li>`)
      .join('');

    el('active-tournament').textContent =
      state.tournaments[0] ? `${state.tournaments[0].name} on ${state.tournaments[0].date}` : 'No tournament';
  }

  function renderPlayersAndAdmins() {
    const tid = el('admin-tournament').value;
    const t = getTournamentById(tid);
    const admins = state.tournamentAdmins[tid] || [];

    el('player-list').innerHTML = t ? t.users.map((u) => `<li>${u}</li>`).join('') : '';
    el('admin-list').innerHTML = admins.length
      ? admins.map((a) => `<li>${a}</li>`).join('')
      : "<li class='muted'>No admins yet for this tournament</li>";
  }

  function roleMessage() {
    const role = isSuperAdmin()
      ? 'Super Admin'
      : Object.values(state.tournamentAdmins).some((admins) => admins.includes(state.currentUser))
        ? 'Tournament Admin'
        : 'Public';

    el('role-status').textContent = `${state.currentUser} role: ${role}`;
  }

  function renderScoreHistory() {
    const t = getTournamentById(el('score-tournament').value);
    if (!t || !t.scoreHistory?.length) {
      el('score-history').innerHTML = "<p class='muted'>No recent score updates yet.</p>";
      return;
    }

    el('score-history').innerHTML =
      '<h4>Recent score updates</h4>' +
      t.scoreHistory
        .slice(0, 10)
        .map(
          (s) =>
            `<p>${new Date(s.at).toLocaleTimeString()} - ${s.phase}: ${s.a} ${s.scoreA}-${s.scoreB} ${s.b} by ${s.by}</p>`
        )
        .join('');
  }

  function renderScoreMatches() {
    const tid = el('score-tournament').value;
    const phase = el('score-phase').value;
    const t = getTournamentById(tid);
    const list = [];

    if (!t) return;
    if (phase === 'poule') list.push(...t.matches.filter((m) => m.phase === 'poule'));
    if (phase === 'ko-winner') list.push(...t.ko.winner.map((m) => ({ ...m, phase: 'ko-winner' })));
    if (phase === 'ko-loser') list.push(...t.ko.loser.map((m) => ({ ...m, phase: 'ko-loser' })));

    el('score-match').innerHTML = list
      .map((m, i) => `<option value="${i}">${m.a} vs ${m.b} (${m.boardLabel || `Board ${m.board}`}, writer ${m.writer})</option>`)
      .join('');

    renderScoreHistory();
  }

  function calculateStandings(t) {
    return Logic.calculatePouleStandings(t.poules, t.matches);
  }

  function renderStandings(t) {
    const standings = calculateStandings(t);
    const html = standings
      .map((group) => {
        const rows = group.rows
          .map(
            (r, i) =>
              `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.legDiff}</td><td>${r.points}</td></tr>`
          )
          .join('');

        return `<h4>${group.poule}</h4><table><thead><tr><th>#</th><th>Name</th><th>P</th><th>W</th><th>L</th><th>Diff</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
      })
      .join('');

    el('standings-output').innerHTML = html || "<p class='muted'>No poules generated yet.</p>";
    return standings;
  }

  function renderKoOutput(tournament) {
    const draw = (title, arr) =>
      `<h4>${title}</h4>` +
      (arr.length
        ? arr
            .map((m, i) => `<p>M${i + 1}: ${m.a} vs ${m.b} | ${m.boardLabel || `Board ${m.board}`} | Writer: ${m.writer}</p>`)
            .join('')
        : "<p class='muted'>No matches generated yet.</p>");

    el('ko-output').innerHTML = draw('Winner bracket', tournament.ko.winner) + draw('Loser bracket', tournament.ko.loser);
  }

  function renderPace() {
    const t = getTournamentById(el('admin-tournament').value);
    if (!t || !t.poules.length) {
      el('pace-output').innerHTML = "<p class='muted'>Generate poules first.</p>";
      return;
    }

    const blocks = t.poules.map((p) => {
      const matches = t.matches.filter((m) => m.poule === p.name);
      const done = matches.filter((m) => m.scoreA != null && m.scoreB != null).length;
      const pct = matches.length ? Math.round((done / matches.length) * 100) : 0;
      const cls = pct < 35 ? 'bad' : pct < 70 ? 'warn' : 'ok';
      const label = cls === 'bad' ? 'RED - slow' : cls === 'warn' ? 'ORANGE' : 'GREEN';
      return `<p class='pace ${cls}'>${p.name}: ${done}/${matches.length} matches (${pct}%) - ${label}</p>`;
    });

    el('pace-output').innerHTML = blocks.join('');
  }

  function updateKOWriters(t) {
    const apply = (arr) => {
      for (let i = 1; i < arr.length; i += 1) {
        const prev = arr[i - 1];
        if (prev.scoreA == null || prev.scoreB == null) continue;
        arr[i].writer = prev.scoreA < prev.scoreB ? prev.a : prev.b;
      }
    };

    apply(t.ko.winner);
    apply(t.ko.loser);
  }

  function exportBackup() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darttournament-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.tournaments || !Array.isArray(parsed.tournaments)) {
          alert('Invalid backup format');
          return;
        }

        state.superAdmins = parsed.superAdmins || [];
        state.tournamentAdmins = parsed.tournamentAdmins || {};
        state.tournaments = (parsed.tournaments || []).map(Store.ensureTournamentDefaults);
        state.currentUser = parsed.currentUser || 'alice';

        saveState();
        bootstrap();
        alert('Backup imported successfully');
      } catch {
        alert('Could not import backup JSON');
      }
    };

    reader.readAsText(file);
  }

  function bindEvents() {
    el('refresh-role').addEventListener('click', () => {
      state.currentUser = el('current-user').value.trim().toLowerCase();
      roleMessage();
      saveState();
    });

    el('create-tournament-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isSuperAdmin()) {
        alert('Only super admins can create tournaments.');
        return;
      }

      const name = el('t-name').value.trim();
      const season = el('t-season').value.trim();
      const date = el('t-date').value;
      const boards = Number(el('t-boards').value);
      const boardNamesRaw = el('t-board-names').value.split(',').map((x) => x.trim()).filter(Boolean);
      const id = `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

      state.tournaments.unshift(Store.ensureTournamentDefaults({
        id,
        name,
        season,
        date,
        boards,
        boardNames: boardNamesRaw,
      }));
      state.tournamentAdmins[id] = [state.currentUser];

      renderDashboard();
      ['admin-tournament', 'score-tournament'].forEach(tournamentOptions);
      renderPlayersAndAdmins();
      renderScoreMatches();
      saveState();
      e.target.reset();
    });

    el('admin-tournament').addEventListener('change', () => {
      renderPlayersAndAdmins();
      renderPace();
      renderScoreMatches();
      const selected = getTournamentById(el('admin-tournament').value);
      if (selected) {
        renderKoOutput(selected);
        renderStandings(selected);
      }
    });

    el('add-admin').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!isSuperAdmin()) {
        alert('Only super admins can assign tournament admins.');
        return;
      }

      const admin = el('new-admin').value.trim().toLowerCase();
      if (!admin) return;
      state.tournamentAdmins[tid] = state.tournamentAdmins[tid] || [];
      if (!state.tournamentAdmins[tid].includes(admin)) {
        state.tournamentAdmins[tid].push(admin);
        saveState();
      }
      el('new-admin').value = '';
      renderPlayersAndAdmins();
    });

    el('add-player').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      const t = getTournamentById(tid);
      const player = el('new-player').value.trim();
      if (!t || !player) return;

      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can add users.');
        return;
      }

      if (!t.users.includes(player)) t.users.push(player);
      el('new-player').value = '';
      renderPlayersAndAdmins();
      renderDashboard();
      saveState();
    });

    el('reset-users').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      const t = getTournamentById(tid);
      if (!t) return;

      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can reset users.');
        return;
      }

      const confirmed = window.confirm('Reset all tournament users, poules, matches and knockout for this tournament?');
      if (!confirmed) return;

      t.users = [];
      t.poules = [];
      t.matches = [];
      t.ko = { winner: [], loser: [] };
      t.scoreHistory = [];

      renderPlayersAndAdmins();
      renderScoreMatches();
      renderKoOutput(t);
      renderPace();
      renderStandings(t);
      saveState();
    });

    el('generate-poules').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can generate poules.');
        return;
      }

      const t = getTournamentById(tid);
      if (!t) return;

      const pouleCount = Number(el('poule-count').value);
      const pouleSize = Number(el('poule-size').value);
      const playersNeeded = pouleCount * pouleSize;
      const players = t.users.slice(0, playersNeeded);

      if (players.length < playersNeeded) {
        el('poule-output').innerHTML = '<p>Not enough users to fill all poules.</p>';
        return;
      }

      t.poules = Array.from({ length: pouleCount }, (_, i) => ({
        name: `Poule ${String.fromCharCode(65 + i)}`,
        players: players.slice(i * pouleSize, (i + 1) * pouleSize),
      }));

      t.matches = t.poules.flatMap((p) => Logic.generateRoundRobin(p.players, t.boards, t.boardNames, p.name));

      el('poule-output').innerHTML = t.poules
        .map((p) => `<h4>${p.name}</h4><p>${p.players.join(', ')}</p>`)
        .join('') + `<p><strong>Generated matches:</strong> ${t.matches.length}</p>`;

      renderScoreMatches();
      renderPace();
      renderStandings(t);
      saveState();
    });

    el('calculate-standings').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t) return;
      renderStandings(t);
    });

    el('generate-ko').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can generate knockout.');
        return;
      }

      const t = getTournamentById(tid);
      if (!t || t.poules.length === 0) return;

      const ranked = t.poules.flatMap((p) => p.players);
      const mid = Math.ceil(ranked.length / 2);
      t.ko.winner = Logic.buildKOMatchesFromPlayers(ranked.slice(0, mid), t.boards, t.boardNames, 0);
      t.ko.loser = Logic.buildKOMatchesFromPlayers(ranked.slice(mid), t.boards, t.boardNames, 2);

      renderKoOutput(t);
      renderScoreMatches();
      saveState();
    });

    el('generate-ko-ranked').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can generate knockout.');
        return;
      }

      const t = getTournamentById(tid);
      if (!t || t.poules.length === 0) return;

      const standings = calculateStandings(t);
      const ko = Logic.generateKOfromStandings(standings, t.boards, t.boardNames);
      t.ko.winner = ko.winner;
      t.ko.loser = ko.loser;
      renderKoOutput(t);
      renderScoreMatches();
      saveState();
    });

    el('add-ko-player').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can edit knockout brackets.');
        return;
      }

      const t = getTournamentById(tid);
      const player = el('ko-fill-player').value.trim();
      const target = el('ko-fill-target').value;
      if (!t || !player) return;

      const bracket = t.ko[target];
      if (!bracket.length) {
        bracket.push({
          a: player,
          b: 'TBD',
          board: 1,
          boardLabel: Logic.boardLabel(t.boardNames, t.boards, 1),
          writer: 'Volunteer',
          scoreA: null,
          scoreB: null,
        });
      } else if (bracket[bracket.length - 1].b === 'TBD') {
        bracket[bracket.length - 1].b = player;
      } else {
        bracket.push({
          a: player,
          b: 'TBD',
          board: 1,
          boardLabel: Logic.boardLabel(t.boardNames, t.boards, 1),
          writer: 'Volunteer',
          scoreA: null,
          scoreB: null,
        });
      }

      el('ko-fill-player').value = '';
      renderKoOutput(t);
      renderScoreMatches();
      saveState();
    });

    el('simulate-progress').addEventListener('click', renderPace);

    el('score-tournament').addEventListener('change', renderScoreMatches);
    el('score-phase').addEventListener('change', renderScoreMatches);

    el('score-form-element').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = getTournamentById(el('score-tournament').value);
      if (!t) return;

      const phase = el('score-phase').value;
      const idx = Number(el('score-match').value);
      const scoreA = Number(el('score-a').value);
      const scoreB = Number(el('score-b').value);
      const by = el('score-submitter').value.trim();

      let match;
      if (phase === 'poule') match = t.matches.filter((m) => m.phase === 'poule')[idx];
      if (phase === 'ko-winner') match = t.ko.winner[idx];
      if (phase === 'ko-loser') match = t.ko.loser[idx];
      if (!match) return;

      if (match.scoreA != null || match.scoreB != null) {
        const confirmed = window.confirm('This match already has a score. Overwrite it?');
        if (!confirmed) return;
      }

      match.scoreA = scoreA;
      match.scoreB = scoreB;
      match.updatedBy = by;
      match.updatedAt = new Date().toISOString();

      t.scoreHistory.unshift({ phase, a: match.a, b: match.b, scoreA, scoreB, by, at: match.updatedAt });

      updateKOWriters(t);
      renderPace();
      renderKoOutput(t);
      renderScoreMatches();
      renderStandings(t);

      el('score-msg').textContent = `Saved ${match.a} ${scoreA}-${scoreB} ${match.b} by ${by} at ${new Date(match.updatedAt).toLocaleTimeString()}`;
      saveState();
      e.target.reset();
    });

    el('export-data').addEventListener('click', exportBackup);
    el('import-data').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) importBackup(file);
      event.target.value = '';
    });
  }

  function bootstrap() {
    initTabs();
    renderDashboard();
    ['admin-tournament', 'score-tournament'].forEach(tournamentOptions);
    renderPlayersAndAdmins();
    roleMessage();
    renderScoreMatches();
    bindEvents();
    renderPace();

    const selected = getTournamentById(el('admin-tournament').value);
    if (selected) {
      renderKoOutput(selected);
      renderStandings(selected);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
  }

  bootstrap();
})(window);
