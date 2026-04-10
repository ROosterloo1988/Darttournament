const state = {
  superAdmins: ["alice", "bob"],
  tournamentAdmins: { spring_open: ["charlie", "alice"] },
  tournaments: [
    {
      id: "spring_open",
      name: "Spring Open",
      season: "2026 Spring",
      date: "2026-05-18",
      boards: 4,
      users: ["Ana", "Bram", "Cem", "Daan", "Eli", "Fay", "Gus", "Hugo"],
      poules: [],
      matches: [],
      ko: { winner: [], loser: [] },
    },
  ],
  currentUser: "alice",
};

const el = (id) => document.getElementById(id);

function initTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      button.classList.add("active");
      el(button.dataset.tab).classList.add("active");
    });
  });

  document.querySelectorAll(".quick").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(`.tab[data-tab='${button.dataset.tabTarget}']`).click();
    });
  });
}

function tournamentOptions(selectId) {
  const select = el(selectId);
  select.innerHTML = state.tournaments
    .map((t) => `<option value="${t.id}">${t.name} (${t.season})</option>`)
    .join("");
}

function renderDashboard() {
  const seasonList = el("season-list");
  seasonList.innerHTML = state.tournaments
    .map((t) => `<li>${t.season}: ${t.name} (${t.date})</li>`)
    .join("");
  el("active-tournament").textContent =
    state.tournaments[0] ? `${state.tournaments[0].name} on ${state.tournaments[0].date}` : "No tournament";
}

function getTournamentById(id) {
  return state.tournaments.find((t) => t.id === id);
}

function renderPlayers() {
  const tid = el("admin-tournament").value;
  const t = getTournamentById(tid);
  el("player-list").innerHTML = t ? t.users.map((u) => `<li>${u}</li>`).join("") : "";
}

function roleMessage() {
  const user = state.currentUser;
  const isSuper = state.superAdmins.includes(user);
  const isTournamentAdmin = Object.values(state.tournamentAdmins).some((admins) => admins.includes(user));
  const role = isSuper ? "Super Admin" : isTournamentAdmin ? "Tournament Admin" : "Public";
  el("role-status").textContent = `${user} role: ${role}`;
}

function generateRoundRobin(players, boards) {
  const matches = [];
  let boardCounter = 1;
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const writer = players.find((p) => p !== players[i] && p !== players[j]) || "Volunteer";
      matches.push({
        phase: "poule",
        a: players[i],
        b: players[j],
        board: boardCounter,
        writer,
        scoreA: null,
        scoreB: null,
      });
      boardCounter = boardCounter % boards + 1;
    }
  }
  return matches;
}

function renderScoreMatches() {
  const tid = el("score-tournament").value;
  const phase = el("score-phase").value;
  const t = getTournamentById(tid);
  const list = [];

  if (!t) return;
  if (phase === "poule") list.push(...t.matches.filter((m) => m.phase === "poule"));
  if (phase === "ko-winner") list.push(...t.ko.winner.map((m) => ({ ...m, phase: "ko-winner" })));
  if (phase === "ko-loser") list.push(...t.ko.loser.map((m) => ({ ...m, phase: "ko-loser" })));

  el("score-match").innerHTML = list
    .map((m, i) => `<option value="${i}">${m.a} vs ${m.b} (Board ${m.board ?? "-"}, writer ${m.writer})</option>`)
    .join("");
}

function bindEvents() {
  el("refresh-role").addEventListener("click", () => {
    state.currentUser = el("current-user").value.trim().toLowerCase();
    roleMessage();
  });

  el("create-tournament-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.superAdmins.includes(state.currentUser)) {
      alert("Only super admins can create tournaments.");
      return;
    }
    const name = el("t-name").value.trim();
    const season = el("t-season").value.trim();
    const date = el("t-date").value;
    const boards = Number(el("t-boards").value);
    const id = `${name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

    state.tournaments.unshift({
      id,
      name,
      season,
      date,
      boards,
      users: [],
      poules: [],
      matches: [],
      ko: { winner: [], loser: [] },
    });

    renderDashboard();
    ["admin-tournament", "score-tournament"].forEach(tournamentOptions);
    renderPlayers();
    renderScoreMatches();
    e.target.reset();
  });

  el("admin-tournament").addEventListener("change", renderPlayers);

  el("add-player").addEventListener("click", () => {
    const tid = el("admin-tournament").value;
    const t = getTournamentById(tid);
    const player = el("new-player").value.trim();
    if (!t || !player) return;
    if (!t.users.includes(player)) t.users.push(player);
    el("new-player").value = "";
    renderPlayers();
  });

  el("generate-poules").addEventListener("click", () => {
    const tid = el("admin-tournament").value;
    const t = getTournamentById(tid);
    if (!t) return;

    const pouleCount = Number(el("poule-count").value);
    const pouleSize = Number(el("poule-size").value);
    const playersNeeded = pouleCount * pouleSize;
    const players = t.users.slice(0, playersNeeded);

    if (players.length < playersNeeded) {
      el("poule-output").innerHTML = "<p>Not enough users to fill all poules.</p>";
      return;
    }

    t.poules = Array.from({ length: pouleCount }, (_, i) => ({
      name: `Poule ${String.fromCharCode(65 + i)}`,
      players: players.slice(i * pouleSize, (i + 1) * pouleSize),
    }));

    t.matches = t.poules.flatMap((p) => generateRoundRobin(p.players, t.boards));

    el("poule-output").innerHTML = t.poules
      .map((p) => `<h4>${p.name}</h4><p>${p.players.join(", ")}</p>`)
      .join("") + `<p><strong>Generated matches:</strong> ${t.matches.length}</p>`;

    renderScoreMatches();
  });

  el("generate-ko").addEventListener("click", () => {
    const t = getTournamentById(el("admin-tournament").value);
    if (!t || t.poules.length === 0) return;

    const ranked = t.poules.flatMap((p) => p.players);
    const mid = Math.ceil(ranked.length / 2);
    const winnerPlayers = ranked.slice(0, mid);
    const loserPlayers = ranked.slice(mid);

    const toMatches = (players, startBoard) => {
      const out = [];
      for (let i = 0; i < players.length; i += 2) {
        out.push({
          a: players[i] || "TBD",
          b: players[i + 1] || "TBD",
          board: ((startBoard + i / 2) % t.boards) + 1,
          writer: i < 2 ? "Volunteer" : "Loser previous match",
        });
      }
      return out;
    };

    t.ko.winner = toMatches(winnerPlayers, 0);
    t.ko.loser = toMatches(loserPlayers, 2);

    renderKoOutput(t);
    renderScoreMatches();
  });

  el("add-ko-player").addEventListener("click", () => {
    const t = getTournamentById(el("admin-tournament").value);
    const player = el("ko-fill-player").value.trim();
    const target = el("ko-fill-target").value;
    if (!t || !player) return;

    const bracket = t.ko[target];
    if (bracket.length === 0) bracket.push({ a: player, b: "TBD", board: 1, writer: "Volunteer" });
    else if (bracket[bracket.length - 1].b === "TBD") bracket[bracket.length - 1].b = player;
    else bracket.push({ a: player, b: "TBD", board: 1, writer: "Volunteer" });

    el("ko-fill-player").value = "";
    renderKoOutput(t);
    renderScoreMatches();
  });

  el("simulate-progress").addEventListener("click", () => {
    const t = getTournamentById(el("admin-tournament").value);
    if (!t || t.poules.length === 0) return;

    const html = t.poules
      .map((p, idx) => {
        const pace = Math.floor(Math.random() * 100);
        const cls = pace < 35 || idx === t.poules.length - 1 ? "bad" : pace < 60 ? "warn" : "ok";
        const label = cls === "bad" ? "RED - slow" : cls === "warn" ? "ORANGE" : "GREEN";
        return `<p class="pace ${cls}">${p.name}: ${pace}% complete (${label})</p>`;
      })
      .join("");

    el("pace-output").innerHTML = html;
  });

  el("score-tournament").addEventListener("change", renderScoreMatches);
  el("score-phase").addEventListener("change", renderScoreMatches);

  el("score-form-element").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = getTournamentById(el("score-tournament").value);
    if (!t) return;

    const phase = el("score-phase").value;
    const idx = Number(el("score-match").value);
    const scoreA = Number(el("score-a").value);
    const scoreB = Number(el("score-b").value);
    const by = el("score-submitter").value.trim();

    let match;
    if (phase === "poule") match = t.matches.filter((m) => m.phase === "poule")[idx];
    if (phase === "ko-winner") match = t.ko.winner[idx];
    if (phase === "ko-loser") match = t.ko.loser[idx];
    if (!match) return;

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.updatedBy = by;
    match.updatedAt = new Date().toISOString();

    el("score-msg").textContent = `Saved ${match.a} ${scoreA}-${scoreB} ${match.b} by ${by} at ${new Date(match.updatedAt).toLocaleTimeString()}`;
    e.target.reset();
    renderScoreMatches();
  });
}

function renderKoOutput(tournament) {
  const draw = (title, arr) =>
    `<h4>${title}</h4>` +
    arr
      .map(
        (m, i) =>
          `<p>M${i + 1}: ${m.a} vs ${m.b} | Board ${m.board} | Writer: ${m.writer}</p>`
      )
      .join("");

  el("ko-output").innerHTML = draw("Winner bracket", tournament.ko.winner) + draw("Loser bracket", tournament.ko.loser);
}

function bootstrap() {
  initTabs();
  renderDashboard();
  ["admin-tournament", "score-tournament"].forEach(tournamentOptions);
  renderPlayers();
  roleMessage();
  renderScoreMatches();
  bindEvents();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => null);
  }
}

bootstrap();
