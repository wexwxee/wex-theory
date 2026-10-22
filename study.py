"""Study suggestions and factual history from the learner's existing progress."""
from datetime import datetime, timedelta

import models
import sign_lessons

SIGN_INTERVALS = (0, 1, 3, 7, 14, 30)


def overview(db, user_id, full_attempts=(), now=None):
    now = now or datetime.utcnow()
    signs = db.query(models.SignProgress).filter_by(user_id=user_id).all()
    due = [row for row in signs if row.box == 0 or row.updated_at is None
           or row.updated_at + timedelta(days=SIGN_INTERVALS[min(max(row.box, 0), 5)]) <= now]
    words = db.query(models.ExamWordProgress).filter_by(user_id=user_id, status='hard').count()
    seen = {row.code for row in signs if row.box > 0}
    lessons = sign_lessons.all_lessons()
    finished = {row.lesson_id for row in db.query(models.SignLessonResult).filter_by(user_id=user_id).all()}
    # The next lesson is the first one without a finished check; lessons whose signs were all
    # met elsewhere come after the ones that still have new signs.
    suggested = (next((lesson for lesson in lessons if lesson['id'] not in finished and not set(lesson['codes']) <= seen), None)
                 or next((lesson for lesson in lessons if lesson['id'] not in finished), lessons[0]))
    attempts = sorted((a for a in full_attempts if a.user_id == user_id and a.finished_at is not None),
                      key=lambda a: (a.finished_at, a.id), reverse=True)
    recent = []
    for index, attempt in enumerate(attempts[:5]):
        mode = getattr(attempt, 'wording_mode', None) or 'original'
        previous = next((a for a in attempts[index + 1:] if a.test_id == attempt.test_id
                         and (getattr(a, 'wording_mode', None) or 'original') == mode), None)
        recent.append({'id': attempt.id, 'test_id': attempt.test_id, 'score': attempt.score or 0,
                       'wording': mode, 'finished_at': attempt.finished_at,
                       'change': (attempt.score or 0) - (previous.score or 0) if previous else None})
    return {'signs_due': len(due), 'hard_words': words, 'lesson': suggested,
            'lessons_done': len(finished & {lesson['id'] for lesson in lessons}), 'lessons_total': len(lessons),
            'recent': recent}
