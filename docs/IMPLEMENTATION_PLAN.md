# Implementation Plan (Phase 1)

## Sprint 1 — Foundation
- Project bootstrap (React + TS + PWA)
- Auth integration
- Role model setup
- Baseline dashboard layout

## Sprint 2 — Public score flow
- Rename Admin tab to Score Form
- Build public score entry form
- Add match selection by phase
- Save scores with audit trail

## Sprint 3 — Admin portal basics
- Super admin tournament creation
- Tournament admin assignment
- Tournament user management (isolated per tournament)

## Sprint 4 — Poules and scheduling
- Poule generation and assignment
- Match generation per poule
- Board assignment
- Poule writer assignment (non-playing player)

## Sprint 5 — Knockout flow
- Winner + loser bracket generation
- Manual slot completion by admin
- Writer logic in KO:
  - First round = volunteer
  - Follow-up = previous match loser

## Sprint 6 — Monitoring and polish
- Poule progress dashboard
- Red/orange/green pace status
- PWA installability and offline fallback
- QA and tournament-day test run

## Acceptance criteria highlights
- Public can submit scores without admin rights.
- Only super admins can create tournaments.
- Tournament admins can only manage assigned tournaments.
- Each tournament has a fresh user list.
- KO bracket can be completed even with odd participation counts.
