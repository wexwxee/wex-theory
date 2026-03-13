"""
Run once to import test data: py import_data.py
Reads C:/Teori/Test01..Test13/*_ANSWERS.json
Creates tests, questions, answers in DB
"""
import json
import os
import sys
from database import engine, SessionLocal
import models

models.Base.metadata.create_all(bind=engine)

import os as _os
TEORI_PATH = _os.environ.get("TEORI_PATH", _os.path.join(_os.path.dirname(__file__), "data"))

TEST_TITLES = {
    1: "Theory Test 1",
    2: "Theory Test 2",
    3: "Theory Test 3",
    4: "Theory Test 4",
    5: "Theory Test 5",
    6: "Theory Test 6",
    7: "Theory Test 7",
    8: "Theory Test 8",
    9: "Theory Test 9",
    10: "Theory Test 10",
    11: "Theory Test 11",
    12: "Theory Test 12",
    13: "Theory Test 13 (Road Signs)",
}


def import_data():
    db = SessionLocal()
    try:
        existing = db.query(models.Test).count()
        if existing > 0:
            print(f"Data already imported ({existing} tests found). Use --force to reimport.")
            if "--force" not in sys.argv:
                return

            print("Force reimport: deleting existing data...")
            db.query(models.UserAnswer).delete()
            db.query(models.UserTestAttempt).delete()
            db.query(models.Answer).delete()
            db.query(models.Question).delete()
            db.query(models.Test).delete()
            db.commit()

        for test_num in range(1, 14):
            folder = f"Test{test_num:02d}"
            test_folder = os.path.join(TEORI_PATH, folder)

            if not os.path.exists(test_folder):
                print(f"WARNING: {test_folder} not found, skipping.")
                continue

            answers_file = os.path.join(test_folder, f"test{test_num:02d}_ANSWERS.json")
            if not os.path.exists(answers_file):
                print(f"WARNING: {answers_file} not found, skipping.")
                continue

            print(f"Importing {folder}...")

            with open(answers_file, "r", encoding="utf-8-sig") as f:
                questions_data = json.load(f)

            test = models.Test(
                id=test_num,
                title=TEST_TITLES[test_num],
                description=f"Official theory test {test_num}",
            )
            db.add(test)
            db.flush()

            for q_data in questions_data:
                q_index = q_data.get("question_index", 1)
                image_path = f"{folder}/screenshots/q{q_index:02d}.jpg"

                question = models.Question(
                    test_id=test_num,
                    question_index=q_index,
                    question_text=q_data.get("question_text", ""),
                    explanation=q_data.get("explanation", ""),
                    image_path=image_path,
                )
                db.add(question)
                db.flush()

                for ans_data in q_data.get("answers", []):
                    answer = models.Answer(
                        question_id=question.id,
                        text=ans_data.get("text", ""),
                        is_correct=ans_data.get("correct", False),
                    )
                    db.add(answer)

            db.commit()
            print(f"  -> {len(questions_data)} questions imported.")

        print("\nImport complete!")
        total_tests = db.query(models.Test).count()
        total_questions = db.query(models.Question).count()
        total_answers = db.query(models.Answer).count()
        print(f"  Tests: {total_tests}")
        print(f"  Questions: {total_questions}")
        print(f"  Answers: {total_answers}")

    except Exception as e:
        db.rollback()
        print(f"Error during import: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import_data()
