# Thursday Trial Runbook (Real Tournament)

Use this checklist on tournament day to run a **real** event safely.

## 1) Before players arrive

1. Open the app on the admin device.
2. Go to **Admin Portal**.
3. Select your tournament.
4. Add all players (single or bulk add).
5. Set:
   - number of poules
   - players per poule
   - board count / board names
6. Click **Run preflight checks**.

Only continue if all checks are ✅.

## 2) Generate setup

1. Choose seeding method (`Snake` recommended for balanced poules).
2. Click **Generate poules**.
3. Click **Create board rounds**.
4. Open **Live Boards** tab and verify round 1 assignments.

## 3) During matches

1. Everyone can submit scores via **Score Form**.
2. Keep **Live Boards** open on a TV/laptop for table overview.
3. Round auto-advance is enabled when all round matches are marked done.

## 4) After poules

1. In Admin Portal, click **Calculate standings**.
2. Validate standings table with officials.
3. Click **Generate KO from standings**.
4. Fill any missing KO slots with **Add to bracket** if needed.

## 5) Safety operations

- Before critical phase switches, click **Export JSON backup**.
- If needed, restore with **Import JSON backup**.
- Use **Print schedule** for paper fallback.

## 6) Proefdraai mode notes

- **Run full proefdraai** is available for testing workflows.
- Keep **Apply proefdraai scores** unchecked for safe dry-runs.
- Only enable **Allow demo player autofill** if you intentionally want synthetic players.

## 7) Quick troubleshooting

- If preflight fails on player count: reduce poule settings or add players.
- If duplicate names are detected: normalize names before generation.
- If KO looks incomplete: add players manually to fill bracket sheet.

## 8) End of evening

1. Export a final JSON backup.
2. Save printed standings / screenshots for audit.
3. Archive tournament data by season.
