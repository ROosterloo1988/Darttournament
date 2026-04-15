from datetime import date
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI(title="Tournament Manager")
app.add_middleware(SessionMiddleware, secret_key="change-me")
app.mount("/static", StaticFiles(directory="server/static"), name="static")
templates = Jinja2Templates(directory="server/templates")

# Demo in-memory data layer
TOURNAMENTS = {
    1: {
        "id": 1,
        "name": "Open Tuesday",
        "planned_date": str(date.today()),
        "status": "planned",
        "boards": [1, 2, 3],
        "admins": ["alice"],
        "players": [
            {"name": "Ana", "present": False},
            {"name": "Bram", "present": False},
            {"name": "Cem", "present": False},
            {"name": "Daan", "present": False},
        ],
        "reserves": ["Eli", "Fay"],
        "max_participants": 24,
        "poules": {
            "A": [
                {"id": "A-1", "board": 1, "a": "Ana", "b": "Bram", "score_a": None, "score_b": None, "legs_a": None, "legs_b": None, "specials": {}},
                {"id": "A-2", "board": 1, "a": "Cem", "b": "Daan", "score_a": None, "score_b": None, "legs_a": None, "legs_b": None, "specials": {}},
            ],
            "B": [
                {"id": "B-1", "board": 2, "a": "Ana", "b": "Cem", "score_a": None, "score_b": None, "legs_a": None, "legs_b": None, "specials": {}},
            ],
        },
        "knockout": [
            {"id": "K-1", "board": 1, "a": "TBD", "b": "TBD", "score_a": None, "score_b": None, "legs_a": None, "legs_b": None, "specials": {}},
            {"id": "K-2", "board": 2, "a": "TBD", "b": "TBD", "score_a": None, "score_b": None, "legs_a": None, "legs_b": None, "specials": {}},
        ],
    },
    2: {
        "id": 2,
        "name": "Spring Finals",
        "planned_date": "2026-03-10",
        "status": "finished",
        "boards": [1, 2],
        "admins": ["bob"],
        "players": [],
        "reserves": [],
        "max_participants": 16,
        "poules": {},
        "knockout": [],
    },
}

USERS = {"alice": "darts123", "bob": "darts123"}


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
    today_tournaments = [t for t in TOURNAMENTS.values() if t["planned_date"] == today and t["status"] != "finished"]
    finished_tournaments = [t for t in TOURNAMENTS.values() if t["status"] == "finished"]
    return templates.TemplateResponse(
        request=request,
        name="home.html",
        context={
            "request": request,
            "today_tournaments": today_tournaments,
            "finished_tournaments": finished_tournaments,
        },
    )


@app.get("/tournament/{tid}/scores", response_class=HTMLResponse)
def score_entry(request: Request, tid: int):
    t = TOURNAMENTS.get(tid)
    if not t:
        raise HTTPException(404, "Tournament not found")
    return templates.TemplateResponse(
        request=request,
        name="score_entry.html",
        context={"request": request, "tournament": t},
    )


@app.post("/api/tournament/{tid}/score")
def save_score(tid: int, payload: dict):
    t = TOURNAMENTS.get(tid)
    if not t:
        raise HTTPException(404, "Tournament not found")

    match_id = payload.get("match_id")
    phase = payload.get("phase")
    score_a = payload.get("score_a")
    score_b = payload.get("score_b")
    legs_a = payload.get("legs_a")
    legs_b = payload.get("legs_b")
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
    target["legs_a"] = legs_a
    target["legs_b"] = legs_b
    target["specials"] = specials
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
    if USERS.get(username) != password:
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
    own_tournaments = [t for t in TOURNAMENTS.values() if user in t.get("admins", [])]
    return templates.TemplateResponse(
        request=request,
        name="admin_home.html",
        context={"request": request, "user": user, "tournaments": own_tournaments},
    )


@app.get("/admin/tournament/{tid}", response_class=HTMLResponse)
def admin_tournament(request: Request, tid: int):
    user = require_login(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    t = TOURNAMENTS.get(tid)
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
