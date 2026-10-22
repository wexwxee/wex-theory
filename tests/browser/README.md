# Learning progress browser checks

`npm run test:sign-tests` uses the temporary fixture on 8765 to check Road Sign
Tests 1-4: their own dashboard block, a full 25-question run of test 1 scored
like an ordinary test, the score on its card, the profile counter that still
counts only the 14 theory tests, the four tests on the sign course page after
the lessons, and the sign-test label in the mistake review.
The fixture creates the sign tests with `sign_tests.sync`.

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
breakdown, mistake practice, four ten-word study rounds and two sign review rounds
(twelve signs of lesson 01 for a new learner, then the seven signs of lesson 02),
each mixing "name this sign" and "find the sign". Use the same fixture server. The suite checks horizontal overflow and
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


`node site-readiness.test.js` checks cookie reopening, withdrawal and cross-tab
updates; clear registration/access wording; small sign sets; mobile first action;
exact round recovery including option order and already graded answers; account
isolation and confirmed reset. Use a fresh fixture before repeating. It uses
only dummy accounts and writes screenshots in this directory.

`npm run test:sign-lessons` checks the lesson player: one sign at a time on the
Learn step, the recall step (choices from the same lesson, a missed sign comes
back at the end, every lesson sign gets a review level), bilingual situations,
answered-state recovery, the lasting lesson result and missed-only retry; six
lessons at 320, 390 and 1440 px with their scene images; due-only review; and
exclusion of equivalent arrow variants from answer choices. An unfinished lesson
stays in the same browser for seven days; a finished result is kept without
expiry and, for signed-in learners, in the account (`/api/signs/lessons`).

`npm run test:sign-review` checks the pure scheduling rules without a browser.
Intervals are 1/3/7/14/30 days. A first correct answer introduces a sign; later
levels require a correct answer on the due day, and immediate repeats cannot
promote the review level. A mistake starts the sign again.

`SITE_TEST_BASE` optionally overrides the localhost address for the lesson,
readiness, learning and student-journey suites. Use only an isolated local
fixture; never production. This allows testing a staged copy on another port.

`npm run test:study` checks dashboard continuation into the exact saved test,
clearing a submitted draft, recent full-test history, the real ten-word/lesson
journey, saved step results, next actions, three viewport widths, and account
isolation. Expired accounts use the public words demo and sign lessons; their
paid drafts and another account's drafts are excluded. The fixture now creates
dummy learners 1–5; learner 3 is expired and learners 4/5 are used by this suite.
Use a fresh fixture before repeating. Its full-test history assertion expects
one newly completed test. Restart rather than weakening login rate limits.

`npm run test:drafts` checks browser draft validation without Chromium: expiry,
future timestamps, malformed data, test/access/wording filters, account scope,
and generated internal resume links. The resume browser suite also accepts
`SITE_TEST_BASE` for a staged fixture on another localhost port.

`npm run test:catalog` checks all fourteen sign lessons at 320/390/1440 px, completes
the three added application checks in Russian and restores their results. It
also checks the 129-note catalogue filter together with group/search, restored
filter controls and the corrected horse-rider path variant. It uses only public
lesson assets; no mailbox or external DNS settings are changed. This suite also
accepts `SITE_TEST_BASE` for an isolated localhost fixture.

`npm run test:word-store` checks word-round expiry, dictionary changes, ownership,
guided mode, answer history, malformed cached options and unavailable storage.
`npm run test:word-rounds` drives recovery through reload, tab close and account
changes, including revealed cards, all quiz modes, completed scores, explicit
restart, silent listening recovery and the standalone/guided/demo boundaries.
It also checks stable choices across server-progress and voice refreshes,
blocked storage, broken caches and 320/390/1440 px layouts. Use an isolated
fixture with dummy learners 1–5 and `SITE_TEST_BASE` for its local address.

`npm run test:warnings` checks all five added warning/restriction lessons and
their 16 application questions. It drives EN/RU explanations, wrong answers,
reload recovery, missed-only retry, saved results, decoded SVGs, three new
public scene links, source links and the checked catalogue filter. It checks
320/390/1440 px and captures both mobile themes. The study suite now completes
the four-question road-shape lesson in the actual ten-word/sign-study journey.
Use `SITE_TEST_BASE` for an isolated local fixture.

`npm run test:lesson-store` checks first-score preservation, retry transitions,
stable shuffled options, invalid caches, seven-day expiry and conservative v1
migration. `npm run test:study-session` checks that neither a words retry nor a
signs retry can replace a study step's first score or completion time.

`npm run test:lesson-quality` checks topic/search filtering, zero-result recovery,
the first score versus the corrected score, recommendations to review mistakes,
cross-tab updates, focused feedback, enlarged images, zoom and keyboard focus,
legacy results, changed-question resets, account isolation and the real guided
study journey. It checks every lesson at 320/390/1440 px, including containment
of comparison images, both themes and practice with storage disabled. Use a fresh
fixture before repeating suites that submit a full test; keep login rate limits.

Lesson checks now store answer indices separately from the displayed shuffled
option order. Browser tests select `[data-answer]` rather than a screen position.
After a mistake retry, `.lesson-score` retains the first check and
`.lesson-reviewed-score` shows the corrected result. Migrated v1 results are
labelled saved checks because their original first attempt cannot be recovered.


`npm run test:continuity` checks native word-study keyboard controls, selected
and correct answer labels, focus continuity, modal site navigation, cookie-setting
handoff, FAQ states, study next steps and canceling new-session setup. It covers
twelve old pages at 320/390/1440 in both themes, including mobile referral content
and profile history. Uses the isolated fixture and dummy learner 2.

`npm run test:results-accessibility` checks result cards with Enter/Space, review
focus trapping/return, the nested image lightbox, independent Escape handling,
and paid tests/results with localStorage blocked. Uses dummy learner 1.
These suites, auth/access/report suites and the existing learner suites accept
`SITE_TEST_BASE` for an isolated localhost fixture. Never run against production;
restart the fixture between large batches to respect login rate limits.

The word-round browser suite now compares `.ew-option-meaning` when checking
stable option order, since checked options also include separate feedback labels.

`lesson-answers.js` answers a sign-lesson situation the way a learner does: for exam-style situations it ticks the true statements and presses Check answer, for older single-choice questions it presses the option. Sign-lesson suites use it instead of clicking `.lesson-option[data-answer]` directly.
