"""Study facts must use the account's actual history and comparable results."""
import asyncio
import os
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'study-tests-local-secret-with-enough-entropy'
os.environ.pop('REDIS_URL', None)

import main
import models
import study
from database import SessionLocal, engine
from starlette.requests import Request


def setup_db():
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    db = SessionLocal()
    users = [models.User(name=str(i), email=f'study{i}@example.com', password_hash='x',
                         expires_at=datetime(2030, 1, 1)) for i in (1, 2)]
    db.add_all(users)
    db.commit()
    return db, users


def test_due_signs_and_difficult_words_are_account_scoped_and_scheduled():
    db, (one, two) = setup_db()
    try:
        now = datetime(2026, 10, 16)
        db.add_all([
            models.SignProgress(user_id=one.id, code='B11', box=1, updated_at=now-timedelta(days=2)),
            models.SignProgress(user_id=one.id, code='B13', box=2, updated_at=now-timedelta(days=2)),
            models.SignProgress(user_id=one.id, code='B18', box=0, updated_at=now),
            models.SignProgress(user_id=two.id, code='C61', box=0, updated_at=now),
            models.ExamWordProgress(user_id=one.id, term_id='a', status='hard'),
            models.ExamWordProgress(user_id=one.id, term_id='b', status='known'),
            models.ExamWordProgress(user_id=two.id, term_id='c', status='hard'),
        ])
        db.commit()
        data = study.overview(db, one.id, now=now)
        assert data['signs_due'] == 2 and data['hard_words'] == 1
        assert data['lesson']['id'] == 'starter'
        assert study.overview(db, two.id, now=now)['signs_due'] == 1
    finally:
        db.close()


def test_history_changes_only_compare_same_test_wording_and_account():
    db, (one, two) = setup_db()
    try:
        def attempt(id, user, test, mode, score, days):
            return SimpleNamespace(id=id, user_id=user.id, test_id=test, wording_mode=mode,
                                   score=score, finished_at=datetime(2026, 10, 16)-timedelta(days=days))
        attempts = [attempt(1, one, 1, 'original', 14, 3), attempt(2, one, 1, 'exam', 24, 2),
                    attempt(3, one, 2, 'original', 23, 1), attempt(4, one, 1, 'original', 18, 0),
                    attempt(5, two, 1, 'original', 25, 0)]
        data = study.overview(db, one.id, attempts)
        assert [row['id'] for row in data['recent']] == [4, 3, 2, 1]
        assert data['recent'][0]['change'] == 4
        assert all(row['change'] is None for row in data['recent'][1:])
    finally:
        db.close()


def test_study_requires_login_and_expired_accounts_use_public_steps():
    db, (one, _) = setup_db()
    try:
        req = Request({'type':'http', 'method':'GET', 'path':'/study', 'headers':[],
                       'query_string':b'', 'scheme':'http', 'server':('testserver',80)})
        req.state.csp_nonce = 'test'
        with patch('main.get_current_user', return_value=None):
            assert asyncio.run(main.study_page(req, db)).status_code == 302
        one.expires_at = datetime(2020, 1, 1)
        db.commit()
        with patch('main.get_current_user', return_value=one):
            response = asyncio.run(main.study_page(req, db))
        assert response.status_code == 200
        assert b'data-words-url="/exam-words-demo"' in response.body
        assert b'Full tests require access' in response.body
    finally:
        db.close()
