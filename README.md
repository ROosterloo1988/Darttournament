# Darttournament PWA

Starter PWA for running dart tournaments with:
- Dashboard (with Seizoenen tournaments at the bottom)
- Public **Score Form** tab (renamed from admin)
- Admin Portal with split responsibilities (super admin vs tournament admin)
- Poule generation, board assignment, writer assignment
- Winner/loser knockout generation + manual filling
- Pace overview with red/orange/green indicators
- Local browser persistence (localStorage)

## Run locally

Because this is a static PWA starter, you can serve it with any static server:

```bash
python3 -m http.server 4173
```

Then open: `http://localhost:4173`

## Demo users and permissions

- Super admins (max 2): `alice`, `bob`
- Tournament admin example: `charlie`
- Everyone can use **Score Form**
- Only super admins can create tournaments and assign tournament admins
- Tournament admins/super admins can manage players, poules and knockout

## Included files

- `index.html` — main UI with tabs (Dashboard, Score Form, Admin Portal)
- `styles.css` — app styling
- `app.js` — state + logic for tournaments, poules, KO, writers, pace monitor
- `manifest.webmanifest` — PWA metadata
- `sw.js` — basic offline caching service worker
