# Exam-style wording files

Each file in this folder defines optional manual exam-style wording for one test.

Naming:
- `test_01.json`
- `test_02.json`
- ...
- `test_13.json`

JSON structure:

```json
{
  "test_id": 1,
  "questions": [
    {
      "question_index": 1,
      "question_text": "Manual exam-style wording for the question",
      "answers": {
        "1": "Manual exam-style wording for answer option 1",
        "3": "Manual exam-style wording for answer option 3"
      }
    }
  ]
}
```

Notes:
- `question_index` matches the question number inside the test.
- `question_text` updates `questions.exam_style_text`.
- `answers` uses the visible answer order in that question:
  - `"1"` = first answer option
  - `"2"` = second answer option
  - etc.
- If `question_text` is missing or empty, the original wording is used.
- If an answer entry is missing or empty, the original wording is used.
