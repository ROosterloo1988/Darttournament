import json
import sqlite3
from datetime import date
from pathlib import Path
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI(title="Tournament Manager")
app.add_middleware(SessionMiddleware, secret_key="change-me")
app.mount("/static", StaticFiles(directory="server/static"), name="static")
templates = Jinja2Templates(directory="server/templates")

DB_PATH = Path(__file__).resolve().parent / "data.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                is_superadmin INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS tournaments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                planned_date TEXT NOT NULL,
                status TEXT NOT NULL,
                max_participants INTEGER NOT NULL,
                boards_json TEXT NOT NULL,
                poules_json TEXT NOT NULL,
                knockout_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tournament_admins (
                tournament_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                UNIQUE(tournament_id, username)
            );
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                present INTEGER NOT NULL DEFAULT 0,
                UNIQUE(tournament_id, name)
            );
            CREATE TABLE IF NOT EXISTS reserves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tournament_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                arrival_order INTEGER NOT NULL
            );
            """
        )
        has_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if has_users == 0:
            conn.executemany(
                "INSERT INTO users(username, password, is_superadmin) VALUES(?, ?, ?)",
                [("alice", "darts123", 1), ("bob", "darts123", 1)],
            )

        has_tournaments = conn.execute("SELECT COUNT(*) AS c FROM tournaments").fetchone()["c"]
        if has_tournaments == 0:
            conn.execute(
                """
                INSERT INTO tournaments(name, planned_date, status, max_participants, boards_json, poules_json, knockout_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Open Tuesday",
                    str(date.today()),
                    "planned",
                    24,
                    json.dumps([1, 2, 3]),
                    json.dumps({}),
                    json.dumps([]),
                ),
            )
            tid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
            conn.execute("INSERT INTO tournament_admins(tournament_id, username) VALUES(?, ?)", (tid, "alice"))
            conn.executemany(
                "INSERT INTO players(tournament_id, name, present) VALUES(?, ?, ?)",
                [(tid, "Ana", 0), (tid, "Bram", 0), (tid, "Cem", 0), (tid, "Daan", 0)],
            )
            conn.executemany(
                "INSERT INTO reserves(tournament_id, name, arrival_order) VALUES(?, ?, ?)",
                [(tid, "Eli", 1), (tid, "Fay", 2)],
            )

            conn.execute(
                """
                INSERT INTO tournaments(name, planned_date, status, max_participants, boards_json, poules_json, knockout_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Spring Finals",
                    "2026-03-10",
                    "finished",
                    16,
                    json.dumps([1, 2]),
                    json.dumps({}),
                    json.dumps([]),
                ),
            )
            tid2 = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
            conn.execute("INSERT INTO tournament_admins(tournament_id, username) VALUES(?, ?)", (tid2, "bob"))
        else:
            # Legacy demo cleanup: remove prefilled matches from Open Tuesday if nothing has been played yet.
            rows = conn.execute(
                "SELECT id, poules_json, knockout_json FROM tournaments WHERE name = ? AND status = ?",
                ("Open Tuesday", "planned"),
            ).fetchall()
            for row in rows:
                poules = json.loads(row["poules_json"] or "{}")
                knockout = json.loads(row["knockout_json"] or "[]")
                all_matches = [m for group in poules.values() for m in group] + list(knockout)
                if not all_matches:
                    continue
                has_scores = any(m.get("score_a") is not None or m.get("score_b") is not None for m in all_matches)
                if has_scores:
                    continue
                conn.execute(
                    "UPDATE tournaments SET poules_json = ?, knockout_json = ? WHERE id = ?",
                    (json.dumps({}), json.dumps([]), row["id"]),
                )


def is_superadmin(username: str):
    with get_conn() as conn:
        row = conn.execute("SELECT is_superadmin FROM users WHERE username = ?", (username,)).fetchone()
    return bool(row and row["is_superadmin"])


def list_tournaments():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM tournaments ORDER BY planned_date DESC, id DESC").fetchall()
    return [_hydrate_tournament(row) for row in rows]


def tournaments_for_admin(username: str):
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT t.* FROM tournaments t
            JOIN tournament_admins a ON a.tournament_id = t.id
            WHERE a.username = ?
            ORDER BY t.planned_date DESC, t.id DESC
            """,
            (username,),
        ).fetchall()
    return [_hydrate_tournament(row) for row in rows]


def get_tournament(tid: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM tournaments WHERE id = ?", (tid,)).fetchone()
        if not row:
            return None
        t = _hydrate_tournament(row)
        admins = conn.execute("SELECT username FROM tournament_admins WHERE tournament_id = ? ORDER BY username", (tid,)).fetchall()
        players = conn.execute("SELECT name, present FROM players WHERE tournament_id = ? ORDER BY name", (tid,)).fetchall()
        reserves = conn.execute("SELECT name FROM reserves WHERE tournament_id = ? ORDER BY arrival_order", (tid,)).fetchall()
    t["admins"] = [a["username"] for a in admins]
    t["players"] = [{"name": p["name"], "present": bool(p["present"])} for p in players]
    t["reserves"] = [r["name"] for r in reserves]
    t["present_count"] = sum(1 for p in t["players"] if p["present"])
    return t


def _hydrate_tournament(row):
    poules = json.loads(row["poules_json"] or "{}")
    knockout = json.loads(row["knockout_json"] or "[]")
    match_count = sum(len(v) for v in poules.values()) + len(knockout)
    return {
        "id": row["id"],
        "name": row["name"],
        "planned_date": row["planned_date"],
        "status": row["status"],
        "max_participants": row["max_participants"],
        "boards": json.loads(row["boards_json"] or "[]"),
        "poules": poules,
        "knockout": knockout,
        "match_count": match_count,
    }


def save_tournament_matches(tournament):
    with get_conn() as conn:
        conn.execute(
            "UPDATE tournaments SET poules_json = ?, knockout_json = ? WHERE id = ?",
            (json.dumps(tournament["poules"]), json.dumps(tournament["knockout"]), tournament["id"]),
        )


def compute_special_standings(tournaments):
    scoreboard = {}
    for tournament in tournaments:
        match_groups = list(tournament.get("poules", {}).values()) + [tournament.get("knockout", [])]
        for matches in match_groups:
            for match in matches:
                specials = match.get("specials") or {}
                for suffix, player_key in [("_a", "a"), ("_b", "b")]:
                    player = match.get(player_key)
                    if not player:
                        continue
                    scoreboard.setdefault(player, {"s180": 0, "finish100": 0, "d15": 0})
                    scoreboard[player]["s180"] += int(specials.get(f"s180{suffix}", 0) or 0)
                    finish_values = str(specials.get(f"finish100{suffix}", "")).strip()
                    d15_values = str(specials.get(f"d15{suffix}", "")).strip()
                    scoreboard[player]["finish100"] += len([x for x in finish_values.split(",") if x.strip()]) if finish_values else 0
                    scoreboard[player]["d15"] += len([x for x in d15_values.split(",") if x.strip()]) if d15_values else 0
    rows = [{"name": name, **stats} for name, stats in scoreboard.items()]
    rows.sort(key=lambda r: (r["s180"] + r["finish100"] + r["d15"], r["s180"]), reverse=True)
    return rows[:10]


init_db()


def current_user(request: Request):
    return request.session.get("user")


def require_login(request: Request):
    user = current_user(request)
    if not user:
        return None
    return user


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    today = str(date.today())
    all_tournaments = list_tournaments()
    today_tournaments = [t for t in all_tournaments if t["planned_date"] == today and t["status"] != "finished"]
    finished_tournaments = [t for t in all_tournaments if t["status"] == "finished"]
    special_rows = compute_special_standings(all_tournaments)
    return templates.TemplateResponse(
        request=request,
        name="home.html",
        context={
            "request": request,
            "today_tournaments": today_tournaments,
            "finished_tournaments": finished_tournaments,
            "special_rows": special_rows,
        },
    )


@app.get("/tournament/{tid}/scores", response_class=HTMLResponse)
def score_entry(request: Request, tid: int):
    t = get_tournament(tid)
    if not t:
        raise HTTPException(404, "Tournament not found")
    return templates.TemplateResponse(
        request=request,
        name="score_entry.html",
        context={"request": request, "tournament": t},
    )


@app.post("/api/tournament/{tid}/score")
def save_score(tid: int, payload: dict):
    t = get_tournament(tid)
    if not t:
        raise HTTPException(404, "Tournament not found")

    match_id = payload.get("match_id")
    phase = payload.get("phase")
    score_a = payload.get("score_a")
    score_b = payload.get("score_b")
    specials = payload.get("specials") or {}

    target = None
    if phase == "poule":
        for matches in t["poules"].values():
            for m in matches:
                if m["id"] == match_id:
                    target = m
                    break
    else:
        for m in t["knockout"]:
            if m["id"] == match_id:
                target = m
                break

    if not target:
        raise HTTPException(404, "Match not found")

    target["score_a"] = score_a
    target["score_b"] = score_b
    target["specials"] = specials
    save_tournament_matches(t)
    return JSONResponse({"ok": True, "match": target})


@app.get("/admin/login", response_class=HTMLResponse)
def admin_login_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="admin_login.html",
        context={"request": request, "error": None},
    )


@app.post("/admin/login", response_class=HTMLResponse)
def admin_login(request: Request, username: str = Form(...), password: str = Form(...)):
    with get_conn() as conn:
        row = conn.execute("SELECT password FROM users WHERE username = ?", (username,)).fetchone()
    if not row or row["password"] != password:
        return templates.TemplateResponse(
            request=request,
            name="admin_login.html",
            context={"request": request, "error": "Onjuiste inlog"},
        )
    request.session["user"] = username
    return RedirectResponse("/admin", status_code=303)


@app.get("/admin/logout")
def admin_logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=303)


@app.get("/admin", response_class=HTMLResponse)
def admin_home(request: Request):
    user = require_login(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    own_tournaments = tournaments_for_admin(user)
    return templates.TemplateResponse(
        request=request,
        name="admin_home.html",
        context={"request": request, "user": user, "tournaments": own_tournaments, "is_superadmin": is_superadmin(user)},
    )


@app.post("/admin/tournament/create")
def create_tournament(
    request: Request,
    name: str = Form(...),
    planned_date: str = Form(...),
    board_count: int = Form(3),
    max_participants: int = Form(24),
):
    user = require_login(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not is_superadmin(user):
        raise HTTPException(403, "Only super admins can create tournaments")

    boards = list(range(1, max(board_count, 1) + 1))
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO tournaments(name, planned_date, status, max_participants, boards_json, poules_json, knockout_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (name.strip(), planned_date, "planned", max_participants, json.dumps(boards), json.dumps({}), json.dumps([])),
        )
        tid = conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
        conn.execute("INSERT INTO tournament_admins(tournament_id, username) VALUES (?, ?)", (tid, user))
    return RedirectResponse(f"/admin/tournament/{tid}", status_code=303)


@app.post("/admin/tournament/{tid}/setup")
def update_setup(
    request: Request,
    tid: int,
    max_participants: int = Form(...),
    board_count: int = Form(...),
):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")

    boards = list(range(1, max(board_count, 1) + 1))
    with get_conn() as conn:
        conn.execute(
            "UPDATE tournaments SET max_participants = ?, boards_json = ? WHERE id = ?",
            (max(max_participants, 1), json.dumps(boards), tid),
        )
    return RedirectResponse(f"/admin/tournament/{tid}#setup", status_code=303)


@app.get("/admin/tournament/{tid}", response_class=HTMLResponse)
def admin_tournament(request: Request, tid: int):
    user = require_login(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    t = get_tournament(tid)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    progress_total = sum(len(v) for v in t["poules"].values()) + len(t["knockout"])
    progress_done = sum(
        1
        for v in t["poules"].values()
        for m in v
        if m["score_a"] is not None and m["score_b"] is not None
    ) + sum(1 for m in t["knockout"] if m["score_a"] is not None and m["score_b"] is not None)

    return templates.TemplateResponse(
        request=request,
        name="admin_tournament.html",
        context={
            "request": request,
            "user": user,
            "tournament": t,
            "progress_total": progress_total,
            "progress_done": progress_done,
        },
    )


@app.post("/admin/tournament/{tid}/players/add")
def add_player(request: Request, tid: int, player_name: str = Form(...)):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    name = player_name.strip()
    if not name:
        return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)
    if len(t["players"]) >= t["max_participants"]:
        with get_conn() as conn:
            row = conn.execute("SELECT COALESCE(MAX(arrival_order), 0) AS m FROM reserves WHERE tournament_id = ?", (tid,)).fetchone()
            conn.execute(
                "INSERT INTO reserves(tournament_id, name, arrival_order) VALUES (?, ?, ?)",
                (tid, name, row["m"] + 1),
            )
        return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO players(tournament_id, name, present) VALUES (?, ?, 0)",
            (tid, name),
        )
    return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)


@app.post("/admin/tournament/{tid}/players/toggle")
def toggle_player(request: Request, tid: int, player_name: str = Form(...)):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT present FROM players WHERE tournament_id = ? AND name = ?",
            (tid, player_name),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE players SET present = ? WHERE tournament_id = ? AND name = ?",
                (0 if row["present"] else 1, tid, player_name),
            )
    updated = get_tournament(tid)
    accepts_json = "application/json" in request.headers.get("accept", "")
    if accepts_json:
        current = next((p for p in updated["players"] if p["name"] == player_name), None)
        return JSONResponse(
            {
                "ok": True,
                "player_name": player_name,
                "present": bool(current and current["present"]),
                "present_count": updated["present_count"],
                "total_players": len(updated["players"]),
            }
        )
    return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)


@app.post("/admin/tournament/{tid}/players/rename")
def rename_player(request: Request, tid: int, old_name: str = Form(...), new_name: str = Form(...)):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    new_name = new_name.strip()
    if not new_name:
        return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)

    # Update player table
    with get_conn() as conn:
        conn.execute(
            "UPDATE players SET name = ? WHERE tournament_id = ? AND name = ?",
            (new_name, tid, old_name),
        )

    # Update pairings in poules/knockout JSON
    for matches in t["poules"].values():
        for match in matches:
            if match["a"] == old_name:
                match["a"] = new_name
            if match["b"] == old_name:
                match["b"] = new_name
    for match in t["knockout"]:
        if match["a"] == old_name:
            match["a"] = new_name
        if match["b"] == old_name:
            match["b"] = new_name
    save_tournament_matches(t)
    return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)


@app.post("/admin/tournament/{tid}/reserves/add")
def add_reserve(request: Request, tid: int, reserve_name: str = Form(...)):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    with get_conn() as conn:
        row = conn.execute("SELECT COALESCE(MAX(arrival_order), 0) AS m FROM reserves WHERE tournament_id = ?", (tid,)).fetchone()
        next_order = row["m"] + 1
        conn.execute(
            "INSERT INTO reserves(tournament_id, name, arrival_order) VALUES (?, ?, ?)",
            (tid, reserve_name.strip(), next_order),
        )
    return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)


@app.post("/admin/tournament/{tid}/reserves/promote")
def promote_reserve(request: Request, tid: int):
    user = require_login(request)
    t = get_tournament(tid)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    if not t or user not in t.get("admins", []):
        raise HTTPException(403, "No access")
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, name FROM reserves WHERE tournament_id = ? ORDER BY arrival_order LIMIT 1",
            (tid,),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM reserves WHERE id = ?", (row["id"],))
            conn.execute("INSERT OR IGNORE INTO players(tournament_id, name, present) VALUES (?, ?, 1)", (tid, row["name"]))
            conn.execute("UPDATE players SET present = 1 WHERE tournament_id = ? AND name = ?", (tid, row["name"]))
    return RedirectResponse(f"/admin/tournament/{tid}#inschrijvingen", status_code=303)
