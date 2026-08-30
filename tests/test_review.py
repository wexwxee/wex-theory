"""Checks for the mistake review list.

The list is derived, not stored: a question is pending when the learner's most
recent answer to it was wrong. These tests pin that rule down, because it is
the whole contract - a learner who fixes a question in a real test expects it
to disappear.
"""

import os
import unittest
from datetime import datetime, timedelta

os.environ["SECRET_KEY"] = "review-tests-secret-key-with-enough-entropy"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.pop("RESEND_API_KEY", None)
os.environ.pop("REDIS_URL", None)

import models  # noqa: E402
import review  # noqa: E402
from database import SessionLocal, engine  # noqa: E402


class ReviewTests(unittest.TestCase):
    def setUp(self):
        models.Base.metadata.drop_all(bind=engine)
        models.Base.metadata.create_all(bind=engine)
        self.db = SessionLocal()

        expires = datetime.utcnow() + timedelta(days=30)
        self.user = models.User(
            name="Learner", email="learner@example.com", password_hash="x", expires_at=expires
        )
        self.other = models.User(
            name="Someone", email="someone@example.com", password_hash="x", expires_at=expires
        )
        self.db.add_all([self.user, self.other])
        self.db.flush()

        test = models.Test(id=1, title="Test 1", description="")
        self.db.add(test)
        self.db.flush()

        self.questions = []
        for index in range(1, 4):
            question = models.Question(
                test_id=test.id,
                question_index=index,
                question_text=f"Question {index}",
                question_text_ru=f"Вопрос {index}",
                explanation="Because.",
                explanation_ru="Потому что.",
                image_path=f"Test01/screenshots/q0{index}.jpg",
            )
            self.db.add(question)
            self.db.flush()
            self.db.add_all([
                models.Answer(question_id=question.id, text="right", is_correct=True),
                models.Answer(question_id=question.id, text="wrong", is_correct=False),
            ])
            self.questions.append(question)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def answer(self, user, question, correct):
        attempt = models.UserTestAttempt(user_id=user.id, test_id=1)
        self.db.add(attempt)
        self.db.flush()
        self.db.add(
            models.UserAnswer(attempt_id=attempt.id, question_id=question.id, is_correct=correct)
        )
        self.db.commit()

    def test_a_wrong_answer_puts_the_question_in_the_list(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.assertEqual(review.missed_question_ids(self.db, self.user.id), [self.questions[0].id])

    def test_getting_it_right_later_clears_it(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[0], correct=True)
        self.assertEqual(review.missed_question_ids(self.db, self.user.id), [])

    def test_getting_it_wrong_again_brings_it_back(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[0], correct=True)
        self.answer(self.user, self.questions[0], correct=False)
        self.assertEqual(review.missed_question_ids(self.db, self.user.id), [self.questions[0].id])

    def test_the_most_often_missed_question_comes_first(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[1], correct=False)
        self.answer(self.user, self.questions[1], correct=False)
        pending = review.missed_question_ids(self.db, self.user.id)
        self.assertEqual(pending[0], self.questions[1].id)

    def test_one_learner_never_sees_another_learners_mistakes(self):
        self.answer(self.other, self.questions[2], correct=False)
        self.assertEqual(review.missed_question_ids(self.db, self.user.id), [])
        self.assertEqual(review.review_count(self.db, self.other.id), 1)

    def test_the_round_is_capped(self):
        for question in self.questions:
            self.answer(self.user, question, correct=False)
        self.assertEqual(len(review.review_questions(self.db, self.user.id, limit=2)), 2)
        self.assertEqual(review.review_count(self.db, self.user.id), 3)

    def test_miss_counts_only_covers_pending_questions(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[1], correct=False)
        self.answer(self.user, self.questions[1], correct=True)
        counts = review.miss_counts(self.db, self.user.id)
        self.assertEqual(counts, {self.questions[0].id: 2})

    def test_attempts_are_counted_for_the_page_header(self):
        self.answer(self.user, self.questions[0], correct=False)
        self.answer(self.user, self.questions[1], correct=False)
        self.assertEqual(review.attempts_taken(self.db, self.user.id), 2)
        self.assertEqual(review.attempts_taken(self.db, self.other.id), 0)

    def test_payload_carries_answers_and_russian(self):
        self.answer(self.user, self.questions[0], correct=False)
        question = review.review_questions(self.db, self.user.id)[0]
        payload = review.as_payload(question, misses=3)
        self.assertEqual(payload["misses"], 3)
        self.assertEqual(payload["question_text_ru"], "Вопрос 1")
        self.assertEqual(payload["explanation_ru"], "Потому что.")
        self.assertEqual(len(payload["answers"]), 2)
        self.assertEqual(sum(1 for answer in payload["answers"] if answer["is_correct"]), 1)


if __name__ == "__main__":
    unittest.main()
