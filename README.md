# Darttournament PWA

Starter PWA for running dart tournaments with:
- Dashboard (with Seizoenen tournaments at the bottom)
- Public **Score Form** tab (renamed from admin)
- Live Boards tab for tournament-day screen view
- Admin Portal with split responsibilities (super admin vs tournament admin)
- Poule generation, board assignment, writer assignment
- Winner/loser knockout generation + manual filling
- Pace overview with red/orange/green indicators
- Local browser persistence (localStorage)
- JSON backup export/import
- Poule standings table with points/wins/leg-difference
- KO generation based on standings (top players to winner bracket)
- Round scheduling over boards (conflict-free per round)
- Live round control (advance rounds during tournament day)
- Auto-advance to next round when all matches in current round are completed
- Print-friendly poule schedule export
- Bulk player import (paste lines/comma-separated names)
- One-click proefdraai simulation (full E2E local tournament flow)
- Preflight validation + safe dry-run mode before live tournament day

## Run locally

Because this is a static PWA starter, you can serve it with any static server:

```bash
python3 -m http.server 4173
```

Then open: `http://localhost:4173`

Run tests:

```bash
npm test
```

## Install on a clean Ubuntu server

There is now an installer script for a bare Ubuntu VPS:

```bash
sudo ./scripts/install_ubuntu.sh
```

With custom repo/branch:

```bash
sudo ./scripts/install_ubuntu.sh --repo https://github.com/<you>/<repo> --branch main
```

With domain + HTTPS:

```bash
sudo ./scripts/install_ubuntu.sh --domain darts.example.com --email admin@example.com
```

What the script does:
- Installs `git`, `rsync`, `nginx`, `certbot` and dependencies
- Clones/updates the repo into `/opt/darttournament`
- Deploys static files to `/var/www/darttournament/current`
- Configures nginx for SPA fallback (`/index.html`)
- Optionally requests Let's Encrypt TLS when `--domain` + `--email` are provided

## Demo users and permissions

- Super admins (max 2): `alice`, `bob`
- Tournament admin example: `charlie`
- Everyone can use **Score Form**
- Only super admins can create tournaments and assign tournament admins
- Tournament admins/super admins can manage players, poules and knockout
- Tournament users can be reset per tournament (clean list per event)

## Included files

- `index.html` — main UI with tabs (Dashboard, Score Form, Admin Portal)
- `styles.css` — app styling
- `src/web/store.js` — browser state persistence and defaults
- `src/web/tournament-app.js` — UI bindings and app flow controller
- `src/tournament-logic.js` — shared UMD tournament logic (browser + Node tests)
- `tests/tournament-logic.test.js` — Node test coverage for poules/KO logic
- `scripts/install_ubuntu.sh` — one-command Ubuntu install + nginx (+optional TLS)
- `manifest.webmanifest` — PWA metadata
- `sw.js` — basic offline caching service worker
