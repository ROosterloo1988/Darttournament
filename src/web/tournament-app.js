(function initApp(global) {
  const Logic = global.TournamentLogic;
  const Store = global.DartStore;
  const state = Store.load();
  const TOURNAMENT_STATUSES = ['draft', 'poules_running', 'poules_closed', 'ko_running', 'finished'];

  const el = (id) => document.getElementById(id);

  function saveState() {
    Store.save(state);
  }

  function getTournamentById(id) {
    return state.tournaments.find((t) => t.id === id);
  }

  function hasAdminSession() {
    return state.adminSession?.loggedIn && state.adminSession.user === state.currentUser;
  }

  function hasSuperAdminRole() {
    return state.superAdmins.includes(state.currentUser);
  }

  function isSuperAdmin() {
    return hasAdminSession() && hasSuperAdminRole();
  }

  function isTournamentAdmin(tournamentId) {
    return hasAdminSession() && (state.tournamentAdmins[tournamentId] || []).includes(state.currentUser);
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

  function renderLiveBoards() {
    const tid = el('live-tournament').value;
    const t = getTournamentById(tid);
    if (!t) return;

    const currentRound = t.currentRound || 1;
    const summary = Logic.getRoundSummary(t.matches, currentRound);
    const currentMatches = t.matches.filter((m) => m.phase === 'poule' && (m.round || 1) === currentRound);
    const nextMatches = t.matches.filter((m) => m.phase === 'poule' && (m.round || 1) === currentRound + 1);

    el('live-round-meta').innerHTML = `<p><strong>Current round:</strong> ${currentRound} / ${summary.maxRound} — Done: ${summary.done}/${summary.total}</p>`;
    el('live-board-list').innerHTML = currentMatches.length
      ? currentMatches
          .map(
            (m) =>
              `<div class='board-item'><strong>${m.boardLabel || `Board ${m.board || '-'}`}</strong><br>${m.a} vs ${m.b}<br>Writer: ${m.writer}<br>Status: ${m.status || 'pending'}</div>`
          )
          .join('')
      : "<p class='muted'>No matches in current round.</p>";

    el('live-next-round').innerHTML = nextMatches.length
      ? `<p><strong>Next round preview:</strong> ${nextMatches.length} match(es) ready.</p>`
      : "<p>No next round scheduled yet.</p>";

    const boardSchedule = Array.from({ length: t.boards }, (_, i) => i + 1)
      .map((board) => {
        const boardMatches = t.matches
          .filter((m) => m.phase === 'poule' && m.board === board)
          .sort((a, b) => (a.round || 1) - (b.round || 1));
        if (!boardMatches.length) return '';
        return `<h4>${Logic.boardLabel(t.boardNames, t.boards, board)}</h4><ul>${boardMatches
          .map((m) => `<li>R${m.round || 1}: ${m.a} vs ${m.b} — Writer: ${m.writer} — ${m.status || 'pending'}</li>`)
          .join('')}</ul>`;
      })
      .join('');
    el('live-board-schedule').innerHTML = boardSchedule || "<p class='muted'>No board schedule yet.</p>";
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

  function pushEvent(tournament, message) {
    tournament.eventLog = tournament.eventLog || [];
    tournament.eventLog.unshift({
      at: new Date().toISOString(),
      by: state.currentUser,
      message,
    });
    tournament.eventLog = tournament.eventLog.slice(0, 30);
  }

  function setTournamentStatus(tournament, nextStatus, reason) {
    if (!TOURNAMENT_STATUSES.includes(nextStatus)) return;
    tournament.status = nextStatus;
    pushEvent(tournament, `Status -> ${nextStatus}${reason ? ` (${reason})` : ''}`);
  }

  function renderAdminPortalLock() {
    const locked = !hasAdminSession();
    document.querySelectorAll('.admin-protected').forEach((card) => {
      card.classList.toggle('locked', locked);
    });
    el('admin-session-msg').textContent = locked
      ? 'Log eerst in om admin-acties uit te voeren. Knoppen blijven zichtbaar met meldingen.'
      : `Ingelogd als ${state.currentUser}.`;
  }

  function renderLifecycle(tournament) {
    if (!tournament) return;
    const status = tournament.status || 'draft';
    el('tournament-status-badge').textContent = status;
    el('lifecycle-msg').textContent = `Current phase: ${status}`;

    const items = (tournament.eventLog || [])
      .slice(0, 8)
      .map((evt) => `<li>${new Date(evt.at).toLocaleString()} - ${evt.by}: ${evt.message}</li>`)
      .join('');
    el('event-log').innerHTML = items ? `<h4>Recent events</h4><ul>${items}</ul>` : "<p class='muted'>No events logged yet.</p>";
  }

  function renderKOButtons(t) {
    const completion = Logic.getPouleCompletion(t?.matches || []);
    const status = t?.status || 'draft';
    const enabled = status === 'poules_closed' && completion.isComplete;
    el('generate-ko').disabled = !enabled;
    el('generate-ko-ranked').disabled = !enabled;
    el('ko-gate-msg').textContent = enabled
      ? 'KO ontgrendeld: poules gesloten en compleet.'
      : `KO vergrendeld. Status: ${status}. Poules klaar: ${completion.done}/${completion.total}.`;
  }

  function roleMessage() {
    const role = hasSuperAdminRole()
      ? 'Super Admin'
      : Object.values(state.tournamentAdmins).some((admins) => admins.includes(state.currentUser))
        ? 'Tournament Admin'
        : 'Public';

    const sessionState = hasAdminSession() ? 'logged in' : 'not logged in';
    el('role-status').textContent = `${state.currentUser} role: ${role} (${sessionState})`;
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

  function parseSpecialEntries(raw) {
    return String(raw || '')
      .split(/[\n,;]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function recomputeSpecialStandings(tournament) {
    const scoreboard = {};
    const allMatches = [
      ...tournament.matches,
      ...tournament.ko.winner.map((m) => ({ ...m, phase: 'ko-winner' })),
      ...tournament.ko.loser.map((m) => ({ ...m, phase: 'ko-loser' })),
    ];

    allMatches.forEach((match) => {
      const specials = match.specials || { s180: [], finish100: [], d15: [] };
      specials.s180.forEach((name) => {
        scoreboard[name] = scoreboard[name] || { s180: 0, finish100: 0, d15: 0 };
        scoreboard[name].s180 += 1;
      });
      specials.finish100.forEach((name) => {
        scoreboard[name] = scoreboard[name] || { s180: 0, finish100: 0, d15: 0 };
        scoreboard[name].finish100 += 1;
      });
      specials.d15.forEach((name) => {
        scoreboard[name] = scoreboard[name] || { s180: 0, finish100: 0, d15: 0 };
        scoreboard[name].d15 += 1;
      });
    });

    tournament.specialStandings = scoreboard;
    return scoreboard;
  }

  function renderSpecialStandings(tournament) {
    const standings = recomputeSpecialStandings(tournament);
    const rows = Object.entries(standings)
      .sort((a, b) => (b[1].s180 + b[1].finish100 + b[1].d15) - (a[1].s180 + a[1].finish100 + a[1].d15))
      .map(([name, stats]) => `<tr><td>${name}</td><td>${stats.s180}</td><td>${stats.finish100}</td><td>${stats.d15}</td></tr>`)
      .join('');
    el('special-standings').innerHTML = rows
      ? `<h4>Bijzondere scores stand</h4><table><thead><tr><th>Speler</th><th>180</th><th>100+ F</th><th>&le;15D</th></tr></thead><tbody>${rows}</tbody></table>`
      : "<p class='muted'>Nog geen bijzondere scores ingevoerd.</p>";
  }

  function renderScoreBoards() {
    const t = getTournamentById(el('score-tournament').value);
    const phase = el('score-phase').value;
    if (!t) return;
    let list = [];
    if (phase === 'poule') list = t.matches.filter((m) => m.phase === 'poule');
    if (phase === 'ko-winner') list = t.ko.winner;
    if (phase === 'ko-loser') list = t.ko.loser;
    const boards = [...new Set(list.map((m) => m.board).filter((b) => b != null))].sort((a, b) => a - b);
    el('score-board').innerHTML = `<option value="all">All boards</option>${boards
      .map((b) => `<option value="${b}">${Logic.boardLabel(t.boardNames, t.boards, b)}</option>`)
      .join('')}`;
  }

  function renderScoreMatches() {
    const tid = el('score-tournament').value;
    const phase = el('score-phase').value;
    const boardFilter = el('score-board')?.value || 'all';
    const t = getTournamentById(tid);
    const list = [];

    if (!t) return;
    if (phase === 'poule') list.push(...t.matches.filter((m) => m.phase === 'poule'));
    if (phase === 'ko-winner') list.push(...t.ko.winner.map((m) => ({ ...m, phase: 'ko-winner' })));
    if (phase === 'ko-loser') list.push(...t.ko.loser.map((m) => ({ ...m, phase: 'ko-loser' })));
    const filtered = boardFilter === 'all' ? list : list.filter((m) => String(m.board) === String(boardFilter));

    el('score-match').innerHTML = filtered
      .map((m, i) => `<option value="${i}">${m.a} vs ${m.b} (${m.boardLabel || `Board ${m.board}`}, writer ${m.writer})</option>`)
      .join('');

    renderScoreHistory();
    renderSpecialStandings(t);
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
            .map((m, i) => `<div class='ko-group'><strong>M${i + 1}</strong>: ${m.a} vs ${m.b}<br>${m.boardLabel || `Board ${m.board}`} | Writer: ${m.writer}</div>`)
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

  function renderPouleOptions(tournament) {
    if (!tournament) {
      el('poule-options-output').innerHTML = '';
      return;
    }

    const options = Logic.generatePouleOptions(tournament.users.length, tournament.boards, 3, 5).slice(0, 12);
    const maxPlayers = Logic.getMaxParticipantsForBoards(tournament.boards);
    if (!options.length) {
      el('poule-options-output').innerHTML =
        `<p class='muted'>Geen geldige poule-indeling gevonden voor ${tournament.users.length} spelers op ${tournament.boards} borden (max ${maxPlayers}).</p>`;
      return;
    }

    el('poule-options-output').innerHTML = `<h4>Automatische opties (spelers + borden)</h4>${options
      .map(
        (option) =>
          `<div class="option">
            <p><strong>${option.pouleCount} poules</strong> — verdeling: ${option.sizes.join(', ')}</p>
            <p class="hint">${option.totalMatches} matches, ±${option.estimatedRounds} rondes, board-load ${option.boardUnits}/${tournament.boards}.</p>
            <button type="button" class="apply-poule-option" data-sizes="${option.sizes.join(',')}">Use this option</button>
          </div>`
      )
      .join('')}`;
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

  function randomWinningScore() {
    const winner = 3;
    const loser = Math.floor(Math.random() * 3);
    return Math.random() > 0.5 ? [winner, loser] : [loser, winner];
  }

  function validateTournamentSetup(t) {
    const pouleCount = Number(el('poule-count').value) || 2;
    const pouleSize = Number(el('poule-size').value) || 4;
    const uniquePlayers = new Set(t.users.map((u) => u.toLowerCase()));
    const admins = state.tournamentAdmins[t.id] || [];
    const maxPlayers = Logic.getMaxParticipantsForBoards(t.boards);
    const availableOptions = Logic.generatePouleOptions(t.users.length, t.boards, 3, 5);

    const checks = [
      { ok: t.boards > 0, label: `Boards configured (${t.boards})` },
      { ok: t.users.length <= maxPlayers, label: `Board capacity ok (${t.users.length}/${maxPlayers})` },
      { ok: availableOptions.length > 0, label: `Valid 3-5 poule layout available (${availableOptions.length})` },
      { ok: uniquePlayers.size === t.users.length, label: 'No duplicate player names' },
      { ok: admins.length > 0, label: `Tournament admins assigned (${admins.length})` },
      { ok: pouleSize >= 3 && pouleSize <= 5, label: `Valid preferred poule size (${pouleSize})` },
    ];

    return { checks, valid: checks.every((c) => c.ok), pouleCount, pouleSize };
  }

  function renderChecks(title, checks, extra = []) {
    const lines = checks
      .map((c) => `<li>${c.ok ? '✅' : '❌'} ${c.label}</li>`)
      .join('');
    const extraLines = extra.map((e) => `<li>ℹ️ ${e}</li>`).join('');
    el('proefdraai-output').innerHTML = `<p><strong>${title}</strong></p><ul>${lines}${extraLines}</ul>`;
  }

  function runProefdraai(t, options = { allowDemoFill: false, apply: false }) {
    const pouleCount = Number(el('poule-count').value) || 2;
    const pouleSize = Number(el('poule-size').value) || 4;
    const totalPlayers = pouleCount * pouleSize;
    const target = options.apply ? t : structuredClone(t);

    if (target.users.length < totalPlayers) {
      if (!options.allowDemoFill) {
        throw new Error(`Not enough users for configured poules (${target.users.length}/${totalPlayers}).`);
      }
      const extra = totalPlayers - target.users.length;
      const base = target.users.length;
      for (let i = 1; i <= extra; i += 1) {
        target.users.push(`DemoPlayer${base + i}`);
      }
    }

    const seedingMethod = el('seeding-method').value;
    target.poules = Logic.generateBalancedPoules(target.users.slice(0, totalPlayers), pouleCount, pouleSize, seedingMethod);
    target.matches = target.poules.flatMap((p) => Logic.generateRoundRobin(p.players, target.boards, target.boardNames, p.name));
    target.matches = Logic.schedulePouleMatches(target.matches, target.boards, target.boardNames).map((m) => ({ ...m, status: 'pending' }));
    target.currentRound = 1;

    target.matches.forEach((m) => {
      const [a, b] = randomWinningScore();
      m.scoreA = a;
      m.scoreB = b;
      m.status = 'done';
      m.updatedBy = 'proefdraai-bot';
      m.updatedAt = new Date().toISOString();
    });
    target.currentRound = Logic.getRoundSummary(target.matches, target.currentRound).maxRound;

    const standings = Logic.calculatePouleStandings(target.poules, target.matches);
    const ko = Logic.generateKOfromStandings(standings, target.boards, target.boardNames);
    target.ko.winner = ko.winner;
    target.ko.loser = ko.loser;

    [...target.ko.winner, ...target.ko.loser].forEach((m) => {
      const [a, b] = randomWinningScore();
      m.scoreA = a;
      m.scoreB = b;
      m.updatedBy = 'proefdraai-bot';
      m.updatedAt = new Date().toISOString();
    });

    const report = [
      `Players: ${target.users.length}`,
      `Poules: ${target.poules.length}`,
      `Poule matches scored: ${target.matches.filter((m) => m.scoreA != null && m.scoreB != null).length}/${target.matches.length}`,
      `Winner KO matches: ${target.ko.winner.length}`,
      `Loser KO matches: ${target.ko.loser.length}`,
      options.apply ? 'Applied to current tournament data' : 'Dry-run only (no data changed)',
    ];
    if (options.apply) {
      Object.assign(t, target);
    }
    el('proefdraai-output').innerHTML = `<p><strong>Proefdraai completed</strong></p><ul>${report.map((r) => `<li>✅ ${r}</li>`).join('')}</ul>`;
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
        state.adminPasswords = parsed.adminPasswords || state.adminPasswords || {};
        state.adminSession = parsed.adminSession || { loggedIn: false, user: '' };

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
      renderAdminPortalLock();
      saveState();
    });

    el('admin-login').addEventListener('click', () => {
      const user = el('current-user').value.trim().toLowerCase();
      const password = el('current-password').value;
      const expected = state.adminPasswords[user];
      if (!expected || expected !== password) {
        alert('Invalid admin login.');
        return;
      }
      state.currentUser = user;
      state.adminSession = { loggedIn: true, user };
      el('current-password').value = '';
      roleMessage();
      renderAdminPortalLock();
      saveState();
    });

    el('admin-logout').addEventListener('click', () => {
      state.adminSession = { loggedIn: false, user: '' };
      roleMessage();
      renderAdminPortalLock();
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
        status: 'draft',
        eventLog: [],
      }));
      state.tournamentAdmins[id] = [state.currentUser];
      pushEvent(state.tournaments[0], 'Tournament created');

      renderDashboard();
      ['admin-tournament', 'score-tournament'].forEach(tournamentOptions);
      tournamentOptions('live-tournament');
      renderPlayersAndAdmins();
      renderScoreBoards();
      renderScoreMatches();
      renderLiveBoards();
      renderLifecycle(state.tournaments[0]);
      renderPouleOptions(state.tournaments[0]);
      renderKOButtons(state.tournaments[0]);
      saveState();
      e.target.reset();
    });

    el('admin-tournament').addEventListener('change', () => {
      renderPlayersAndAdmins();
      renderPace();
      renderScoreBoards();
      renderScoreMatches();
      const selected = getTournamentById(el('admin-tournament').value);
      if (selected) {
        renderKoOutput(selected);
        renderStandings(selected);
        renderLifecycle(selected);
        renderPouleOptions(selected);
      }
      renderKOButtons(selected);
    });

    el('live-tournament').addEventListener('change', renderLiveBoards);

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
      const player = Logic.normalizePlayers(el('new-player').value)[0];
      if (!t || !player) return;

      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can add users.');
        return;
      }

      if (!t.users.includes(player)) t.users.push(player);
      pushEvent(t, `Player added: ${player}`);
      el('new-player').value = '';
      renderPlayersAndAdmins();
      renderDashboard();
      renderPouleOptions(t);
      renderLifecycle(t);
      saveState();
    });

    el('bulk-add-players').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      const t = getTournamentById(tid);
      if (!t) return;

      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can bulk add users.');
        return;
      }

      const players = Logic.normalizePlayers(el('bulk-players').value);
      if (!players.length) return;

      const existing = new Set(t.users.map((u) => u.toLowerCase()));
      players.forEach((p) => {
        if (!existing.has(p.toLowerCase())) {
          t.users.push(p);
          existing.add(p.toLowerCase());
        }
      });
      pushEvent(t, `Bulk players added (${players.length})`);

      el('bulk-players').value = '';
      renderPlayersAndAdmins();
      renderDashboard();
      renderPouleOptions(t);
      renderLifecycle(t);
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
      t.status = 'draft';
      pushEvent(t, 'Tournament users and matches reset');

      renderPlayersAndAdmins();
      renderScoreBoards();
      renderScoreMatches();
      renderKoOutput(t);
      renderPace();
      renderStandings(t);
      renderLifecycle(t);
      renderPouleOptions(t);
      renderKOButtons(t);
      saveState();
    });

    el('status-start-poules').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t || !canManageTournament(t.id)) return;
      if (!t.poules.length || !t.matches.filter((m) => m.phase === 'poule').length) {
        alert('Generate poules and rounds before starting poules.');
        return;
      }
      setTournamentStatus(t, 'poules_running');
      renderLifecycle(t);
      renderKOButtons(t);
      saveState();
    });

    el('status-close-poules').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t || !canManageTournament(t.id)) return;
      const completion = Logic.getPouleCompletion(t.matches);
      if (!completion.isComplete) {
        alert(`Cannot close poules yet (${completion.done}/${completion.total}).`);
        return;
      }
      setTournamentStatus(t, 'poules_closed');
      renderLifecycle(t);
      renderKOButtons(t);
      saveState();
    });

    el('status-start-ko').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t || !canManageTournament(t.id)) return;
      if (!t.ko.winner.length && !t.ko.loser.length) {
        alert('Generate KO brackets first.');
        return;
      }
      setTournamentStatus(t, 'ko_running');
      renderLifecycle(t);
      saveState();
    });

    el('status-finish').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t || !canManageTournament(t.id)) return;
      setTournamentStatus(t, 'finished');
      renderLifecycle(t);
      saveState();
    });

    el('calculate-poule-options').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      renderPouleOptions(t);
    });

    el('poule-options-output').addEventListener('click', (event) => {
      const button = event.target.closest('.apply-poule-option');
      if (!button) return;
      const sizes = (button.dataset.sizes || '').split(',').map((v) => Number(v)).filter(Boolean);
      if (!sizes.length) return;
      el('poule-count').value = sizes.length;
      el('poule-size').value = sizes[0];
      el('poule-output').innerHTML = `<p>Geselecteerde poule-verdeling: ${sizes.join(', ')} (alle spelers worden ingedeeld).</p>`;
    });

    el('generate-poules').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can generate poules.');
        return;
      }

      const t = getTournamentById(tid);
      if (!t) return;
      if ((t.status || 'draft') !== 'draft') {
        alert('Poules can only be generated while tournament status is draft.');
        return;
      }

      const pouleCount = Number(el('poule-count').value);
      const pouleSize = Number(el('poule-size').value);
      if (pouleSize < 3 || pouleSize > 5) {
        el('poule-output').innerHTML = '<p>Poule size moet tussen 3 en 5 liggen.</p>';
        return;
      }
      const options = Logic.generatePouleOptions(t.users.length, t.boards, 3, 5);
      if (!options.length) {
        el('poule-output').innerHTML = `<p>Geen geldige poule-verdeling mogelijk voor ${t.users.length} spelers op ${t.boards} borden.</p>`;
        renderPouleOptions(t);
        return;
      }
      const preferred = options.find((o) => o.pouleCount === pouleCount && o.sizes[0] === pouleSize) || options[0];

      const seedingMethod = el('seeding-method').value;
      t.poules = Logic.generatePoulesBySizes(t.users, preferred.sizes, seedingMethod);

      t.matches = t.poules.flatMap((p) => Logic.generateRoundRobin(p.players, t.boards, t.boardNames, p.name));
      t.matches = t.matches.map((m) => ({ ...m, status: 'pending', round: 1 }));
      t.currentRound = 1;
      pushEvent(t, `Poules generated (${preferred.sizes.join(', ')}, ${seedingMethod})`);

      el('poule-output').innerHTML = t.poules
        .map((p) => `<h4>${p.name}</h4><p>${p.players.join(', ')}</p>`)
        .join('') + `<p><strong>Generated matches:</strong> ${t.matches.length}</p><p><strong>Poule sizes:</strong> ${preferred.sizes.join(', ')}</p>`;

      renderScoreMatches();
      renderScoreBoards();
      renderPace();
      renderStandings(t);
      renderLiveBoards();
      renderLifecycle(t);
      renderKOButtons(t);
      saveState();
    });

    el('create-rounds').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can create board rounds.');
        return;
      }

      const t = getTournamentById(tid);
      if (!t) return;
      const pouleMatches = t.matches.filter((m) => m.phase === 'poule');
      const scheduled = Logic.schedulePouleMatches(pouleMatches, t.boards, t.boardNames).map((m) => ({
        ...m,
        status: m.status || 'pending',
      }));
      const nonPoule = t.matches.filter((m) => m.phase !== 'poule');
      t.matches = [...scheduled, ...nonPoule];
      t.currentRound = 1;
      pushEvent(t, 'Board rounds created');

      renderScoreMatches();
      renderScoreBoards();
      renderLiveBoards();
      renderLifecycle(t);
      renderKOButtons(t);
      saveState();
    });

    el('next-round').addEventListener('click', () => {
      const tid = el('admin-tournament').value;
      if (!canManageTournament(tid)) {
        alert('Only assigned tournament admins or super admins can advance rounds.');
        return;
      }
      const t = getTournamentById(tid);
      if (!t) return;

      const maxRound = Math.max(...t.matches.filter((m) => m.phase === 'poule').map((m) => m.round || 1), 1);
      t.currentRound = Math.min((t.currentRound || 1) + 1, maxRound);
      renderLiveBoards();
      saveState();
    });

    el('print-schedule').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t) return;

      const rows = t.matches
        .filter((m) => m.phase === 'poule')
        .sort((a, b) => (a.round || 1) - (b.round || 1) || (a.board || 1) - (b.board || 1))
        .map(
          (m) =>
            `<tr><td>${m.round || '-'}</td><td>${m.boardLabel || `Board ${m.board || '-'}`}</td><td>${m.a}</td><td>${m.b}</td><td>${m.writer}</td><td>${m.status || 'pending'}</td></tr>`
        )
        .join('');

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) return;
      w.document.write(`
        <html><head><title>${t.name} schedule</title>
        <style>body{font-family:Arial;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;text-align:left}</style>
        </head><body>
        <h1>${t.name} - Poule Schedule</h1>
        <table><thead><tr><th>Round</th><th>Board</th><th>Player A</th><th>Player B</th><th>Writer</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
        </body></html>
      `);
      w.document.close();
      w.focus();
      w.print();
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
      const completion = Logic.getPouleCompletion(t.matches);
      if ((t.status || 'draft') !== 'poules_closed' || !completion.isComplete) {
        alert(`KO is locked. Close poules first (${completion.done}/${completion.total}).`);
        return;
      }

      const ranked = t.poules.flatMap((p) => p.players);
      const mid = Math.ceil(ranked.length / 2);
      t.ko.winner = Logic.buildKOMatchesFromPlayers(ranked.slice(0, mid), t.boards, t.boardNames, 0);
      t.ko.loser = Logic.buildKOMatchesFromPlayers(ranked.slice(mid), t.boards, t.boardNames, 2);
      pushEvent(t, 'KO generated from poule lists');

      renderKoOutput(t);
      renderScoreMatches();
      renderScoreBoards();
      renderLifecycle(t);
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
      const completion = Logic.getPouleCompletion(t.matches);
      if ((t.status || 'draft') !== 'poules_closed' || !completion.isComplete) {
        alert(`KO is locked. Close poules first (${completion.done}/${completion.total}).`);
        return;
      }

      const standings = calculateStandings(t);
      const ko = Logic.generateKOfromStandings(standings, t.boards, t.boardNames);
      t.ko.winner = ko.winner;
      t.ko.loser = ko.loser;
      pushEvent(t, 'KO generated from standings');
      renderKoOutput(t);
      renderScoreMatches();
      renderScoreBoards();
      renderLifecycle(t);
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
      if (!['poules_closed', 'ko_running'].includes(t.status || 'draft')) {
        alert('Manual KO edits are allowed after poules are closed.');
        return;
      }

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
      pushEvent(t, `Manual KO add: ${player} -> ${target}`);
      renderKoOutput(t);
      renderScoreMatches();
      renderScoreBoards();
      renderLifecycle(t);
      saveState();
    });

    el('simulate-progress').addEventListener('click', renderPace);

    el('score-tournament').addEventListener('change', () => {
      renderScoreBoards();
      renderScoreMatches();
    });
    el('score-phase').addEventListener('change', () => {
      renderScoreBoards();
      renderScoreMatches();
    });
    el('score-board').addEventListener('change', renderScoreMatches);

    el('score-form-element').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = getTournamentById(el('score-tournament').value);
      if (!t) return;

      const phase = el('score-phase').value;
      const boardFilter = el('score-board').value;
      const idx = Number(el('score-match').value);
      const scoreA = Number(el('score-a').value);
      const scoreB = Number(el('score-b').value);
      const by = el('score-submitter').value.trim();

      let candidates = [];
      if (phase === 'poule') candidates = t.matches.filter((m) => m.phase === 'poule');
      if (phase === 'ko-winner') candidates = t.ko.winner;
      if (phase === 'ko-loser') candidates = t.ko.loser;
      if (boardFilter !== 'all') candidates = candidates.filter((m) => String(m.board) === String(boardFilter));
      const match = candidates[idx];
      if (!match) return;

      const status = t.status || 'draft';
      if (phase === 'poule' && status !== 'poules_running') {
        alert(`Poule score entry is only allowed while status is poules_running. Current: ${status}.`);
        return;
      }
      if ((phase === 'ko-winner' || phase === 'ko-loser') && status !== 'ko_running') {
        alert(`KO score entry is only allowed while status is ko_running. Current: ${status}.`);
        return;
      }

      if (match.scoreA != null || match.scoreB != null) {
        alert('Deze wedstrijd is al ingevuld en kan niet meer aangepast worden.');
        return;
      }

      match.scoreA = scoreA;
      match.scoreB = scoreB;
      if (phase === 'poule') match.status = 'done';
      match.updatedBy = by;
      match.updatedAt = new Date().toISOString();
      match.specials = {
        s180: parseSpecialEntries(el('score-180').value),
        finish100: parseSpecialEntries(el('score-finish100').value),
        d15: parseSpecialEntries(el('score-15darters').value),
      };

      t.scoreHistory.unshift({ phase, a: match.a, b: match.b, scoreA, scoreB, by, at: match.updatedAt });
      pushEvent(t, `Score saved (${phase}): ${match.a} ${scoreA}-${scoreB} ${match.b}`);

      updateKOWriters(t);
      if (phase === 'poule') {
        const summary = Logic.getRoundSummary(t.matches, t.currentRound || 1);
        if (summary.isComplete && (t.currentRound || 1) < summary.maxRound) {
          t.currentRound = (t.currentRound || 1) + 1;
        }
      }
      renderPace();
      renderKoOutput(t);
      renderScoreMatches();
      renderStandings(t);
      renderLiveBoards();
      renderLifecycle(t);
      renderKOButtons(t);

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

    el('run-proefdraai').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t) return;
      if (!canManageTournament(t.id)) {
        alert('Only assigned tournament admins or super admins can run proefdraai.');
        return;
      }

      const preflight = validateTournamentSetup(t);
      if (!preflight.valid && !el('allow-demo-fill').checked) {
        renderChecks('Preflight failed', preflight.checks, [
          'Fix failed items first, or explicitly enable demo autofill for a synthetic dry-run.',
        ]);
        return;
      }

      try {
        runProefdraai(t, {
          allowDemoFill: el('allow-demo-fill').checked,
          apply: el('apply-proefdraai').checked,
        });
      } catch (error) {
        el('proefdraai-output').innerHTML = `<p><strong>Proefdraai failed</strong></p><p>${error.message}</p>`;
        return;
      }

      renderDashboard();
      renderPlayersAndAdmins();
      renderScoreMatches();
      renderPace();
      renderStandings(t);
      renderKoOutput(t);
      renderLiveBoards();
      renderLifecycle(t);
      renderKOButtons(t);
      saveState();
    });

    el('run-preflight').addEventListener('click', () => {
      const t = getTournamentById(el('admin-tournament').value);
      if (!t) return;
      const preflight = validateTournamentSetup(t);
      renderChecks(preflight.valid ? 'Preflight passed' : 'Preflight failed', preflight.checks, [
        `Configured poules: ${preflight.pouleCount} x ${preflight.pouleSize}`,
      ]);
    });
  }

  function bootstrap() {
    initTabs();
    renderDashboard();
    ['admin-tournament', 'score-tournament'].forEach(tournamentOptions);
    tournamentOptions('live-tournament');
    renderPlayersAndAdmins();
    roleMessage();
    renderScoreBoards();
    renderScoreMatches();
    bindEvents();
    renderPace();

    const selected = getTournamentById(el('admin-tournament').value);
    if (selected) {
      renderKoOutput(selected);
      renderStandings(selected);
      renderLifecycle(selected);
      renderPouleOptions(selected);
    }
    renderAdminPortalLock();
    renderKOButtons(selected);
    renderLiveBoards();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
  }

  bootstrap();
})(window);
