# Learning progress browser checks

`node tests/browser/results-report.test.js` uses the temporary fixture on 8765
to verify question reports from paid and sample result viewers, updating the
question after navigation, including the paid attempt ID and opening a mobile
contact form. It never submits the report.

`npm run test:resume` uses the temporary fixture on 8765 to check recovery after
closing a tab, saved answers, flags, position and remaining practice time,
account/wording isolation, the random exam's question set, failed submission,
restart and the prefilled question report. Reports are not sent. Drafts live in
the same browser for up to seven days and pause their saved time while closed;
they do not synchronize to other devices. The student journey also checks that
submitted drafts are cleared and original explanations are displayed unchanged.

`node tests/browser/admin-session.test.js` is a separate regression check against
the persistent localhost preview on port 8010 and its seeded admin/free accounts.
It switches accounts between two tabs, verifies admin read APIs return 403 for a
learner, and checks the old admin page clears after account switching and logout.
It does not edit user records. Do not run it against production.

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

`npm run test:auth` registers a new account using the actual form and captured
email, rejects a wrong code, grants and extends access through the admin UI,
checks invalid admin edits, resets the password through its email link, and
verifies old sessions and reused codes are rejected while paid access remains.
It also tests email confirmation with a stale cookie. The fixture-only mailbox
exists in memory at `/__test/mailbox` on port 8765; production and the persistent
preview do not register this route. Restart the fixture before repeating runs
to reset accounts and authentication rate limits.

The older `exam_words.test.js` is a separate JSDOM harness; it requires its own
rendered `ew_page.html` fixture and is not part of this suite.
