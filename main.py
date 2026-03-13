import json
import traceback
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException, Header
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func as sql_func

import models
from auth import hash_password, verify_password, create_token, decode_token, get_current_user, user_has_access
from database import engine, get_db
from stripe_helpers import (
    get_or_create_customer, create_checkout_session,
    create_portal_session, construct_webhook_event,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WEX Theory")


@app.on_event("startup")
async def startup_init():
    db = next(get_db())
    try:
        # 1. Import test data if DB is empty
        test_count = db.query(models.Test).count()
        if test_count == 0:
            print("[STARTUP] No tests found — running import_data...")
            try:
                from import_data import import_data
                import_data()
                print("[STARTUP] Data import complete")
            except Exception as ie:
                print(f"[STARTUP] Data import error: {ie}")
                traceback.print_exc()
        else:
            print(f"[STARTUP] Tests already in DB: {test_count}")

        # 2. Fix image paths: rename .png → .jpg (images were converted to JPEG)
        png_count = db.query(models.Question).filter(
            models.Question.image_path.like("%.png")
        ).count()
        if png_count > 0:
            db.query(models.Question).filter(
                models.Question.image_path.like("%.png")
            ).update(
                {models.Question.image_path: sql_func.replace(
                    models.Question.image_path, ".png", ".jpg"
                )},
                synchronize_session=False,
            )
            db.commit()
            print(f"[STARTUP] Fixed {png_count} image paths: .png → .jpg")
        else:
            print("[STARTUP] Image paths OK (already .jpg)")

        # 3. Run Stripe column migration (safe to re-run)
        try:
            import sqlite3
            conn = sqlite3.connect("wex_theory.db")
            cur = conn.cursor()
            for sql in [
                "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
                "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
                "ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free'",
                "ALTER TABLE users ADD COLUMN current_period_end DATETIME",
            ]:
                try:
                    cur.execute(sql)
                except Exception:
                    pass
            conn.commit()
            conn.close()
        except Exception as me:
            print(f"[STARTUP] Migration error: {me}")

        # 3. Create default admin if not exists
        existing = db.query(models.User).filter(models.User.email == "admin@wex.com").first()
        if not existing:
            u = models.User(
                name="Admin",
                email="admin@wex.com",
                password_hash=hash_password("admin123"),
                created_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=3650),
                is_admin=True,
            )
            db.add(u)
            db.commit()
            print("[STARTUP] Admin created: admin@wex.com")
        else:
            print(f"[STARTUP] Admin exists: id={existing.id}")

    except Exception as e:
        print(f"[STARTUP] Error: {e}")
        traceback.print_exc()
    finally:
        db.close()


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/test-images", StaticFiles(directory="test-images"), name="test-images")
templates = Jinja2Templates(directory="templates")


# ─── One-time setup endpoint ───────────────────────────────────────────────────

@app.get("/setup-admin-xk92")
async def setup_admin(db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == "admin@wex.com").first()
    if existing:
        existing.password_hash = hash_password("admin123")
        existing.expires_at = datetime.utcnow() + timedelta(days=3650)
        existing.is_admin = True
        db.commit()
        return {"status": "updated", "id": existing.id}
    u = models.User(
        name="Admin",
        email="admin@wex.com",
        password_hash=hash_password("admin123"),
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=3650),
        is_admin=True,
    )
    db.add(u)
    db.commit()
    return {"status": "created", "id": u.id}


# ─── Public pages ──────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("token")
    if token and decode_token(token):
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("about.html", {"request": request, "user": user})


@app.get("/faq", response_class=HTMLResponse)
async def faq_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("faq.html", {"request": request, "user": user})


@app.get("/contact", response_class=HTMLResponse)
async def contact_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("contact.html", {"request": request, "user": user})


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("privacy.html", {"request": request, "user": user})


@app.get("/subscription-expired", response_class=HTMLResponse)
async def expired_page(request: Request):
    return templates.TemplateResponse("subscription_expired.html", {"request": request})


# ─── Auth API ──────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def api_register(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        print(f"[REGISTER] received: name={data.get('name')} email={data.get('email')}")

        name     = str(data.get("name", "")).strip()
        email    = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        days     = int(data.get("days", 30))

        if not name or not email or not password:
            return JSONResponse({"error": "All fields are required"}, status_code=400)
        if len(password) < 6:
            return JSONResponse({"error": "Password must be at least 6 characters"}, status_code=400)

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            print(f"[REGISTER] email taken: {email}")
            return JSONResponse({"error": "This email is already registered"}, status_code=400)

        user = models.User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=days),
            is_admin=(email == "admin@wex.com"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_token(user.id)
        resp = JSONResponse({"success": True, "redirect": "/dashboard"})
        resp.set_cookie("token", token, httponly=True, max_age=86400 * 30, samesite="lax")
        print(f"[REGISTER] success: id={user.id} email={email} admin={user.is_admin}")
        return resp

    except Exception as e:
        print(f"[REGISTER ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/login")
async def api_login(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        email    = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        print(f"[LOGIN] email={email}")

        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"[LOGIN] not found: {email}")
            return JSONResponse({"error": "Invalid email or password"}, status_code=401)
        if not verify_password(password, user.password_hash):
            print(f"[LOGIN] wrong password: {email}")
            return JSONResponse({"error": "Invalid email or password"}, status_code=401)

        token = create_token(user.id)
        redirect = "/admin" if user.is_admin else "/dashboard"
        resp = JSONResponse({"success": True, "redirect": redirect, "is_admin": user.is_admin})
        resp.set_cookie("token", token, httponly=True, max_age=86400 * 30, samesite="lax")
        print(f"[LOGIN] success: id={user.id} admin={user.is_admin}")
        return resp

    except Exception as e:
        print(f"[LOGIN ERROR] {e}")
        traceback.print_exc()
        return JSONResponse({"error": f"Server error: {str(e)}"}, status_code=500)


@app.post("/api/auth/logout")
async def api_logout():
    resp = JSONResponse({"success": True})
    resp.delete_cookie("token")
    return resp


@app.get("/logout")
async def logout_get():
    resp = RedirectResponse("/", status_code=302)
    resp.delete_cookie("token")
    return resp


@app.get("/api/auth/me")
async def api_me(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)
    return JSONResponse({
        "id": user.id, "name": user.name, "email": user.email,
        "is_admin": user.is_admin, "expires_at": user.expires_at.isoformat(),
    })


# ─── Protected pages ───────────────────────────────────────────────────────────

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    tests = db.query(models.Test).order_by(models.Test.id).all()
    finished = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.finished_at.isnot(None),
    ).all()

    best_scores: dict[int, int] = {}
    for a in finished:
        if a.test_id not in best_scores or (a.score or 0) > best_scores[a.test_id]:
            best_scores[a.test_id] = a.score or 0

    images: dict[int, str] = {}
    for t in tests:
        q = db.query(models.Question).filter(
            models.Question.test_id == t.id,
            models.Question.question_index == 1
        ).first()
        images[t.id] = q.image_path if q else ""

    completed = sum(1 for s in best_scores.values() if s >= 20)
    has_full_access = user_has_access(user)

    return templates.TemplateResponse("dashboard.html", {
        "request": request, "user": user, "tests": tests,
        "best_scores": best_scores, "images": images,
        "completed": completed, "has_access": has_full_access,
    })


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempts = (
        db.query(models.UserTestAttempt)
        .filter(
            models.UserTestAttempt.user_id == user.id,
            models.UserTestAttempt.finished_at.isnot(None),
        )
        .order_by(models.UserTestAttempt.finished_at.desc())
        .all()
    )
    return templates.TemplateResponse("profile.html", {
        "request": request, "user": user, "attempts": attempts,
        "now": datetime.utcnow(),
    })


@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    if not user.is_admin:
        return RedirectResponse("/dashboard", status_code=302)

    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    messages = db.query(models.ContactMessage).order_by(
        models.ContactMessage.created_at.desc()
    ).all()
    unread_count = sum(1 for m in messages if not m.is_read)

    return templates.TemplateResponse("admin.html", {
        "request": request, "user": user, "users": users,
        "messages": messages, "unread_count": unread_count,
        "now": datetime.utcnow(),
    })


# ─── Free test (no auth) ───────────────────────────────────────────────────────

@app.get("/test/1/free", response_class=HTMLResponse)
async def free_test_page(request: Request, db: Session = Depends(get_db)):
    test = db.query(models.Test).filter(models.Test.id == 1).first()
    return templates.TemplateResponse("free_test.html", {"request": request, "test": test})


@app.get("/api/tests/1/questions/free")
async def api_free_questions(db: Session = Depends(get_db)):
    questions = db.query(models.Question).filter(
        models.Question.test_id == 1
    ).order_by(models.Question.question_index).all()
    return [
        {"id": q.id, "question_index": q.question_index, "question_text": q.question_text,
         "image_path": q.image_path, "answers": [{"id": a.id, "text": a.text} for a in q.answers]}
        for q in questions
    ]


@app.post("/api/tests/1/check/free")
async def api_free_check(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    user_answers = body.get("answers", {})

    questions = db.query(models.Question).filter(
        models.Question.test_id == 1
    ).order_by(models.Question.question_index).all()

    results = []
    score = 0
    for q in questions:
        correct_ids = [a.id for a in q.answers if a.is_correct]
        selected = user_answers.get(str(q.id), [])
        is_correct = set(selected) == set(correct_ids)
        if is_correct:
            score += 1
        results.append({
            "question_id": q.id, "question_index": q.question_index,
            "correct_ids": correct_ids, "selected_ids": selected,
            "is_correct": is_correct, "explanation": q.explanation,
            "image_path": q.image_path,
        })
    return {"score": score, "passed": score >= 20, "total": 25, "results": results}


# ─── Test pages ────────────────────────────────────────────────────────────────

@app.get("/test/{test_id}", response_class=HTMLResponse)
async def test_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    # Test 1: free for all authenticated users
    if test_id == 1:
        if not user:
            return RedirectResponse("/login", status_code=302)
    else:
        if not user:
            return RedirectResponse("/login", status_code=302)
        if not user_has_access(user):
            return RedirectResponse("/pricing", status_code=302)

    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("test.html", {"request": request, "user": user, "test": test})


@app.get("/test/{test_id}/overview", response_class=HTMLResponse)
async def overview_page(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404)
    return templates.TemplateResponse("overview.html", {"request": request, "user": user, "test": test})


@app.get("/results/free", response_class=HTMLResponse)
async def free_results_page(request: Request):
    return templates.TemplateResponse("results_free.html", {"request": request})


@app.get("/test/{test_id}/results/{attempt_id}", response_class=HTMLResponse)
async def results_page(test_id: int, attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.test_id == test_id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404)

    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    question_results = []
    for q in questions:
        ua = ua_map.get(q.id)
        correct_ids = [a.id for a in q.answers if a.is_correct]
        selected_ids = json.loads(ua.selected_answer_ids) if ua else []
        question_results.append({
            "question": q,
            "answers": q.answers,
            "is_correct": ua.is_correct if ua else False,
            "selected_ids": selected_ids,
            "correct_ids": correct_ids,
        })
    return templates.TemplateResponse("results.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "question_results": question_results,
    })


@app.get("/test/{test_id}/review/{attempt_id}", response_class=HTMLResponse)
async def review_page(test_id: int, attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
        models.UserTestAttempt.test_id == test_id,
    ).first()
    if not attempt:
        raise HTTPException(status_code=404)

    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    review_data = []
    for q in questions:
        ua = ua_map.get(q.id)
        review_data.append({
            "question": q, "answers": q.answers,
            "selected_ids": json.loads(ua.selected_answer_ids) if ua else [],
            "is_correct": ua.is_correct if ua else False,
        })
    return templates.TemplateResponse("review.html", {
        "request": request, "user": user, "test": attempt.test,
        "attempt": attempt, "review_data": review_data,
    })


# ─── Test API ──────────────────────────────────────────────────────────────────

@app.get("/api/tests")
async def api_tests(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    tests = db.query(models.Test).order_by(models.Test.id).all()
    return [{"id": t.id, "title": t.title} for t in tests]


@app.get("/api/tests/{test_id}/questions")
async def api_questions(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    # Test 2+ requires active subscription
    if test_id != 1 and not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)
    questions = db.query(models.Question).filter(
        models.Question.test_id == test_id
    ).order_by(models.Question.question_index).all()
    if not questions:
        return JSONResponse({"error": "No questions found for this test"}, status_code=404)
    return [
        {"id": q.id, "question_index": q.question_index, "question_text": q.question_text,
         "image_path": q.image_path, "answers": [{"id": a.id, "text": a.text} for a in q.answers]}
        for q in questions
    ]


@app.post("/api/tests/{test_id}/start")
async def api_start_test(test_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    # Test 1 is free for all authenticated users; Test 2+ requires subscription
    if test_id != 1 and not user_has_access(user):
        return JSONResponse({"error": "Subscription required"}, status_code=403)

    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        return JSONResponse({"error": "Not found"}, status_code=404)

    attempt = models.UserTestAttempt(user_id=user.id, test_id=test_id, started_at=datetime.utcnow())
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {"attempt_id": attempt.id}


@app.post("/api/attempts/{attempt_id}/answer")
async def api_save_answer(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    body = await request.json()
    question_id = body.get("question_id")
    answer_ids  = body.get("answer_ids", [])

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not question:
        return JSONResponse({"error": "Not found"}, status_code=404)

    correct_ids = {a.id for a in question.answers if a.is_correct}
    is_correct  = set(answer_ids) == correct_ids

    existing = db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id == attempt_id,
        models.UserAnswer.question_id == question_id,
    ).first()
    if existing:
        existing.selected_answer_ids = json.dumps(answer_ids)
        existing.is_correct = is_correct
    else:
        db.add(models.UserAnswer(
            attempt_id=attempt_id, question_id=question_id,
            selected_answer_ids=json.dumps(answer_ids), is_correct=is_correct,
        ))
    db.commit()
    return {"ok": True, "is_correct": is_correct}


@app.post("/api/attempts/{attempt_id}/answers/batch")
async def api_save_answers_batch(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    body = await request.json()
    incoming = body.get("answers", [])  # [{question_id, answer_ids}, ...]

    question_ids = [a["question_id"] for a in incoming]
    questions = db.query(models.Question).options(
        selectinload(models.Question.answers)
    ).filter(models.Question.id.in_(question_ids)).all()
    q_map = {q.id: q for q in questions}

    # Delete existing answers for this attempt (idempotent re-submit)
    db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id == attempt_id
    ).delete(synchronize_session=False)

    for ans in incoming:
        q = q_map.get(ans["question_id"])
        if not q:
            continue
        correct_ids = {a.id for a in q.answers if a.is_correct}
        is_correct = set(ans.get("answer_ids", [])) == correct_ids
        db.add(models.UserAnswer(
            attempt_id=attempt_id,
            question_id=ans["question_id"],
            selected_answer_ids=json.dumps(ans.get("answer_ids", [])),
            is_correct=is_correct,
        ))

    db.commit()
    return {"ok": True}


@app.post("/api/attempts/{attempt_id}/finish")
async def api_finish_attempt(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    try:
        score = sum(1 for ua in attempt.user_answers if ua.is_correct)
        passed = score >= 20
        attempt.finished_at = datetime.utcnow()
        attempt.score = score
        attempt.passed = passed
        db.commit()
        return {"score": score, "passed": passed, "total": 25}
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/api/attempts/{attempt_id}/review")
async def api_review(attempt_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)

    attempt = db.query(models.UserTestAttempt).filter(
        models.UserTestAttempt.id == attempt_id,
        models.UserTestAttempt.user_id == user.id,
    ).first()
    if not attempt:
        return JSONResponse({"error": "Not found"}, status_code=404)

    ua_map = {ua.question_id: ua for ua in attempt.user_answers}
    questions = db.query(models.Question).filter(
        models.Question.test_id == attempt.test_id
    ).order_by(models.Question.question_index).all()

    return [
        {
            "id": q.id, "question_index": q.question_index,
            "question_text": q.question_text, "image_path": q.image_path,
            "explanation": q.explanation,
            "is_correct": ua_map[q.id].is_correct if q.id in ua_map else False,
            "selected_ids": json.loads(ua_map[q.id].selected_answer_ids) if q.id in ua_map else [],
            "answers": [{"id": a.id, "text": a.text, "is_correct": a.is_correct} for a in q.answers],
        }
        for q in questions
    ]


# ─── Contact API ───────────────────────────────────────────────────────────────

@app.post("/api/contact")
async def api_contact(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        msg = models.ContactMessage(
            name=data.get("name", ""), email=data.get("email", ""),
            subject=data.get("subject", "General"), message=data.get("message", ""),
        )
        db.add(msg)
        db.commit()
        print(f"[CONTACT] from={data.get('email')} subject={data.get('subject')}")
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[CONTACT ERROR] {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Admin API ─────────────────────────────────────────────────────────────────

@app.get("/api/admin/users")
async def api_admin_users(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    now = datetime.utcnow()
    return [
        {"id": u.id, "name": u.name, "email": u.email,
         "expires_at": u.expires_at.isoformat(), "is_admin": u.is_admin,
         "active": u.expires_at > now}
        for u in db.query(models.User).order_by(models.User.created_at.desc()).all()
    ]


@app.post("/api/admin/users")
async def api_admin_create_user(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    try:
        data = await request.json()
        existing = db.query(models.User).filter(models.User.email == data["email"].lower()).first()
        if existing:
            return JSONResponse({"error": "Email already registered"}, status_code=400)
        u = models.User(
            name=data["name"], email=data["email"].lower(),
            password_hash=hash_password(data["password"]),
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=int(data.get("days", 30))),
            is_admin=data.get("is_admin", False),
        )
        db.add(u)
        db.commit()
        return JSONResponse({"success": True, "id": u.id})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.put("/api/admin/users/{user_id}")
async def api_admin_update_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(request, db)
    if not admin or not admin.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    data = await request.json()
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return JSONResponse({"error": "Not found"}, status_code=404)
    if "name" in data:
        u.name = data["name"]
    if "email" in data:
        u.email = data["email"].lower()
    if "password" in data and data["password"]:
        u.password_hash = hash_password(data["password"])
    if "days" in data:
        u.expires_at = datetime.utcnow() + timedelta(days=int(data["days"]))
    if "is_admin" in data:
        u.is_admin = data["is_admin"]
    db.commit()
    return JSONResponse({"success": True})


@app.delete("/api/admin/users/{user_id}")
async def api_admin_delete_user(user_id: int, request: Request, db: Session = Depends(get_db)):
    admin = get_current_user(request, db)
    if not admin or not admin.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        return JSONResponse({"error": "Not found"}, status_code=404)
    if u.id == admin.id:
        return JSONResponse({"error": "Cannot delete yourself"}, status_code=400)
    db.query(models.UserAnswer).filter(
        models.UserAnswer.attempt_id.in_(
            db.query(models.UserTestAttempt.id).filter(models.UserTestAttempt.user_id == user_id)
        )
    ).delete(synchronize_session=False)
    db.query(models.UserTestAttempt).filter(models.UserTestAttempt.user_id == user_id).delete()
    db.delete(u)
    db.commit()
    return JSONResponse({"success": True})


@app.get("/api/admin/messages")
async def api_admin_messages(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    messages = db.query(models.ContactMessage).order_by(
        models.ContactMessage.created_at.desc()
    ).all()
    return [
        {"id": m.id, "name": m.name, "email": m.email, "subject": m.subject,
         "message": m.message, "created_at": m.created_at.isoformat(), "is_read": m.is_read}
        for m in messages
    ]


@app.put("/api/admin/messages/{msg_id}/read")
async def api_admin_mark_read(msg_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user or not user.is_admin:
        return JSONResponse({"error": "Forbidden"}, status_code=403)
    msg = db.query(models.ContactMessage).filter(models.ContactMessage.id == msg_id).first()
    if not msg:
        return JSONResponse({"error": "Not found"}, status_code=404)
    msg.is_read = True
    db.commit()
    return JSONResponse({"success": True})


# ─── Pricing / Subscription pages ─────────────────────────────────────────────

@app.get("/pricing", response_class=HTMLResponse)
async def pricing_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("pricing.html", {"request": request, "user": user})


@app.get("/success", response_class=HTMLResponse)
async def success_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse("/login", status_code=302)
    return templates.TemplateResponse("success.html", {"request": request, "user": user})


@app.get("/cancel", response_class=HTMLResponse)
async def cancel_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    return templates.TemplateResponse("cancel.html", {"request": request, "user": user})


# ─── Stripe API ─────────────────────────────────────────────────────────────

@app.post("/api/create-checkout-session")
async def api_create_checkout(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        customer_id = get_or_create_customer(user)
        if not user.stripe_customer_id:
            user.stripe_customer_id = customer_id
            db.commit()
        url = create_checkout_session(customer_id, user.id)
        return JSONResponse({"url": url})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/api/billing-portal")
async def api_billing_portal(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        # Auto-create Stripe customer if not yet present
        if not user.stripe_customer_id:
            customer_id = get_or_create_customer(user)
            user.stripe_customer_id = customer_id
            db.commit()
        url = create_portal_session(user.stripe_customer_id)
        return JSONResponse({"url": url})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


async def _handle_stripe_webhook(request: Request, db: Session, stripe_signature: str):
    payload = await request.body()
    try:
        event = construct_webhook_event(payload, stripe_signature)
    except Exception as e:
        print(f"[WEBHOOK] Signature error: {e}")
        return JSONResponse({"error": "Invalid signature"}, status_code=400)

    event_type = event["type"]
    data_obj   = event["data"]["object"]
    print(f"[WEBHOOK] {event_type}")

    if event_type == "checkout.session.completed":
        user_id = data_obj.get("metadata", {}).get("user_id")
        customer_id = data_obj.get("customer")
        subscription_id = data_obj.get("subscription")
        if user_id:
            u = db.query(models.User).filter(models.User.id == int(user_id)).first()
            if u:
                u.stripe_customer_id = customer_id
                u.stripe_subscription_id = subscription_id
                u.subscription_status = "active"
                db.commit()
                print(f"[WEBHOOK] User {user_id} activated")

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = data_obj.get("customer")
        status = data_obj.get("status")
        period_end = data_obj.get("current_period_end")
        u = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if u:
            u.subscription_status = status
            u.stripe_subscription_id = data_obj.get("id")
            if period_end:
                u.current_period_end = datetime.utcfromtimestamp(period_end)
            db.commit()
            print(f"[WEBHOOK] Subscription {status} for customer {customer_id}")

    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer")
        u = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if u:
            u.subscription_status = "canceled"
            u.stripe_subscription_id = None
            db.commit()
            print(f"[WEBHOOK] Subscription canceled for customer {customer_id}")

    return JSONResponse({"received": True})


# Accept webhook on both paths (Stripe dashboard may be configured to either)
@app.post("/stripe/webhook")
async def stripe_webhook_root(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    return await _handle_stripe_webhook(request, db, stripe_signature)


@app.post("/api/stripe/webhook")
async def api_stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    return await _handle_stripe_webhook(request, db, stripe_signature)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
