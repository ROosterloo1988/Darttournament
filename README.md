# Darttournament PWA

A Progressive Web App (PWA) to run dart tournaments with:
- Poules (group phase)
- Winner + loser knockout brackets
- Live scoring by everyone (open score form)
- Dedicated admin portal with role separation

This project is intentionally aligned with the existing **ZomerCompetitie** UX, but adapted for tournament day operations.

## Product goals

1. Keep the familiar dashboard from ZomerCompetitie.
2. Make score entry public and fast (rename "Admin" tab to **Score Form**).
3. Introduce a protected **Admin Portal** for tournament setup and control.
4. Support tournament flow end-to-end:
   - Create tournament
   - Register users
   - Build poules + schedule + boards + writers
   - Auto-generate knockout winner/loser rounds
   - Monitor pace and bottlenecks per poule

## User roles

### 1) Public user
- Can open the app and fill in scores in **Score Form**.
- Can select:
  - Tournament
  - Phase (Poule / Knockout)
  - Match
- Can submit result for a match.

### 2) Tournament admin
- Assigned per tournament.
- Can:
  - Add/remove users for that tournament
  - Manage poules and board planning
  - Adjust bracket entries (fill winner/loser bracket spots)
  - Manage writers per match
- Cannot create new tournaments globally.

### 3) Super admin (max 2 users)
- Global role.
- Can:
  - Create/edit/archive tournaments
  - Assign tournament admins
  - Manage the fixed list of super admins

## Core screens

## 1. Dashboard (same style as ZomerCompetitie)
Sections:
- Active tournament card
- Quick links (Score Form, Poules, Knockout)
- Bottom section: **Tournament Seasons** (historical + current)

## 2. Score Form (renamed from old Admin tab)
Publicly accessible form:
- Tournament selector
- Phase selector: Poule / KO Winner / KO Loser
- Match selector
- Score fields (legs/sets depending on rules)
- Submit button

Validation:
- Prevent double-finish submissions unless overwrite is confirmed
- Show who submitted and timestamp

## 3. Admin Portal
Protected area with modules:
- Tournament creation wizard
- Tournament admin assignment
- User management per tournament (clean list per tournament)
- Poule builder (count + size)
- Board planner
- Writer planner
- KO generator + manual completion tools
- Poule progress monitor (speed status with red alerts)

## Tournament setup workflow

### Step 1: Create tournament (super admin)
Fields:
- Name
- Season
- Date/time
- Location
- Ruleset (best-of, points system)
- Number of boards

### Step 2: Assign admins
- Super admin selects tournament admins.

### Step 3: Register tournament users
- Tournament-scoped user list only.
- No carry-over between tournaments by default.

### Step 4: Configure poules
- Set number of poules.
- Set players per poule.
- Auto-seed or manual assign.

### Step 5: Generate poule schedule
- Round-robin schedule per poule.
- Assign each match:
  - Board
  - Writer

Writer rule for poules:
- Prefer a player in the same poule who is not currently playing.

### Step 6: Generate knockout
- Generate winner + loser brackets from poule standings.
- Allow admin to add extra users to fill incomplete bracket sheets.

Writer rule for knockout:
- First KO matches: volunteer writers allowed.
- After that: loser of previous linked match becomes writer of next match.

## Progress monitoring (slow poules)

Admin portal includes a poule pace dashboard:
- Metrics:
  - Matches completed / total
  - Average match duration
  - Idle time per board
  - Delay vs expected schedule
- Alert coloring:
  - Green = on pace
  - Orange = slightly behind
  - Red = clearly behind (one or more poules significantly slower)

## Suggested MVP scope

Build in this order:
1. Authentication + roles (public, admin, super admin)
2. Dashboard + Score Form rename and open access
3. Tournament + user management (admin portal basics)
4. Poule generation + scheduling + board assignment
5. KO generation (winner/loser) + manual completion
6. Writer automation rules (poule + KO)
7. Pace monitor with red slow-poule indicator

## Suggested technical architecture

- **Frontend**: React + TypeScript + Vite (PWA plugin)
- **Backend**: Supabase (Auth + Postgres + Row Level Security)
- **Realtime**: Supabase realtime channels for live score updates
- **Hosting**: Vercel / Netlify

## Data model (high level)

Main entities:
- `users`
- `roles` (`super_admin`, `tournament_admin`, `public`)
- `tournaments`
- `tournament_admins`
- `tournament_users`
- `poules`
- `poule_members`
- `matches`
- `match_scores`
- `boards`
- `writers`
- `brackets`
- `bracket_slots`

Important constraints:
- Max 2 active super admins.
- Tournament users are isolated per tournament.
- Match score updates are audited (who + when).

## Next implementation milestone

If you want, the next step can be:
1. Scaffold the actual React PWA structure in this repository.
2. Add Supabase schema migrations.
3. Build the first working pages:
   - Dashboard
   - Public Score Form
   - Super Admin tournament creation page

---

If you share preferred stack choices (React/Next.js, Firebase/Supabase, etc.), this plan can be converted into concrete tickets and code immediately.
