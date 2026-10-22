# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People in Denmark preparing for the category B driving theory test, which they sit in English. Many are not native English speakers; learners from Ukraine and other CIS countries benefit from Russian explanations, but the test itself is in English, so English stays the working language. They study in short sessions — evenings after work, commutes — mostly on phones, sometimes on laptops.

## Product Purpose

WEXTheory helps learners rehearse the theory test until the real one feels familiar: photo-based questions in the test's own format, answer review with explanations, road-sign lessons and exam vocabulary. Success is a learner who understands why an answer is right and passes the official test.

## Positioning

Practice built around the test's real format: photo road scenes, several statements per question that can each be right or wrong, a 25-question test with a 20/25 pass target, the original wording plus a plainer alternative, and every explanation in English with a Russian helper. Independent practice material — not the official test.

## Operating Context

- Free starter test: 15 photo questions, no account (`/test/0`).
- Full library: 13 practice tests (325 photo questions), Exam mode with 25 mixed questions, saved questions, attempt history, review of mistakes.
- Road signs: a course of 18 short lessons (learn one sign at a time, recall, compare look-alikes, 60 situation questions, 31 comparisons) with spaced review at 1, 3, 7, 14 and 30 days and one "next step"; progress is kept in the account for signed-in learners; verified explanations for 163 of 266 catalogue signs, the rest show official names only; full sign catalogue.
- Exam Words: vocabulary from the test with English–Russian practice; ten-word demo for guests.
- Quick session: ten words, then one sign lesson.
- Guides: 2026 training-rule changes, exam language, test-day costs.
- Access: a free account is separate from paid access. Full access is arranged manually with the admin on Telegram; the admin confirms price and period, then activates after payment.

## Capabilities and Constraints

- Server-rendered FastAPI + Jinja templates; site UI in English with EN/RU switches inside learning content.
- Pricing is not published and must not be invented on the site.
- No user counts, pass rates, testimonials or reviews exist; none may be shown.
- The service is independent and must not imply it is official or guarantees a pass.

## Brand Commitments

- Name: WEXTheory.
- Typeface family in use across the site: Inter.
- The user rejected the generic light "clean" redesign of 18 Oct 2026 as cheap; the home page direction they chose is a live, dark "working window" in the spirit of the Chatterino+ landing, adapted to WEXTheory's own design and to the driving-test subject — not copied.
- On 19 Oct 2026 the owner set the home's accent to light blue `#5CC8FF` (replacing amber), asked for no white surfaces and no RU on the home, and chose both motion ideas from that landing: blocks assembling in cells as you scroll, and a scroll tour of the test window. Inner pages keep their EN/RU switches.
- On 20 Oct 2026 the owner asked for that look across the site: dark by default everywhere, the light theme kept and refined, the test page dark, larger and matching the home, and the dashboard redesigned. They also asked for calmer, smoother motion (the square-cell effect felt too technical for a driving-test site), for the tour to demonstrate the window on an example, and for arrow keys to move forward and back. Later they asked for the tour to start only on request, for English nicknames instead of names like «Ученик», for top-bar links on every page, and for the profile and invite pages to match the home.

## Evidence on Hand

- Real test photos: `test-images/Test01`–`Test13/screenshots/*.jpg`.
- Real sign artwork: `static/signs/*.svg`.
- Real questions, answers and EN/RU explanations in the database (free sample map in `main.py`, `FREE_SAMPLE_QUESTION_MAP`).
- Absent and not to be fabricated: testimonials, user numbers, pass statistics, prices.

## Product Principles

1. Show the test, don't describe it: real scenes, real questions, real explanations.
2. Understanding over memorising: every answer comes with the reason.
3. English first, Russian as a helper — never a replacement for the test language.
4. Honest access: say plainly what is free, what is paid and how access is activated.
5. Short sessions on a phone must work as well as long ones on a laptop.

## Accessibility & Inclusion

Learners read in a second language: plain wording, generous line length and contrast, keyboard-operable practice, and reduced motion respected.
