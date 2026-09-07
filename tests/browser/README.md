# Learning progress browser checks

Install Python dependencies with `python -m pip install -r requirements-dev.txt`.
From this directory, run `npm install` and `npx playwright install chromium`.

Start `python tests/browser/serve_learning.py` from the project root, then run
`npm test` from `tests/browser` in a second terminal. Restart the fixture server
before repeating the suite: it creates a fresh temporary database each time.
Stop it with Ctrl+C when finished. It binds only to 127.0.0.1:8765.

The fixture imports the repository's questions into a temporary database and
creates dummy accounts. It does not use the site's real database, send email,
or call Stripe. `CHROMIUM_PATH` can select an already installed Chromium binary.

Coverage: actual login form, mobile overflow on six pages, scheduled review and
lost-response retry, offline sign progress surviving reload, second-device sync,
profile weak signs, hidden empty avatar, and the legacy review redirect.
Screenshots are generated locally and ignored by Git.

`npm run test:student` exercises the learner journey in a 390 px touch viewport:
the 15-question guest sample, a full 25-question test, the random 25-question
exam, navigation and flags, bookmarks, score consistency after reload, answer
breakdown, mistake practice, four ten-word study rounds and all three twelve-sign
rounds. Use the same fixture server. The suite checks horizontal overflow and
JavaScript exceptions. Listening quality and the factual accuracy of the question
content require separate checks.

`npm run test:access` checks the homepage and manual access flow for guests,
expired and active accounts, including the account ID in the Telegram draft,
renewal links, both themes and mobile layout. Telegram navigation is intercepted
locally; the suite sends no messages and makes no payments.

The older `exam_words.test.js` is a separate JSDOM harness; it requires its own
rendered `ew_page.html` fixture and is not part of this suite.
