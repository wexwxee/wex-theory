---
name: WEXTheory Home
description: The WEXTheory world. The home (/ and /welcome) is a dark wall of real test scenes behind a working test window that comes in softly and, on wide screens, demonstrates itself as you scroll; home rules are scoped to .hw. The rest of the site shares the palette (dark by default, light kept), with its own skins for the test room and the dashboard.
colors:
  bg: "#08090b"
  bg-2: "#0d0e11"
  window: "#0c0d10"
  panel: "#111216"
  raised: "#15161b"
  raised-2: "#1c1e24"
  image-well: "#15161a"
  gantry-black: "#050506"
  line: "#23252b"
  line-2: "#34363e"
  line-hover: "#5b5e68"
  gantry-rule: "#2b2d34"
  text: "#f4f4f5"
  soft: "#d4d4da"
  muted: "#a7a7b0"
  dim: "#80808a"
  led: "#5cc8ff"
  led-hi: "#86d7ff"
  led-soft: "rgba(92, 200, 255, 0.14)"
  led-wash: "rgba(92, 200, 255, 0.08)"
  led-ring: "rgba(92, 200, 255, 0.2)"
  led-selection: "rgba(92, 200, 255, 0.32)"
  led-glow: "rgba(92, 200, 255, 0.35)"
  led-edge: "rgba(92, 200, 255, 0.55)"
  led-tick: "rgba(92, 200, 255, 0.7)"
  led-button-glow: "rgba(92, 200, 255, 0.75)"
  ink: "#04121c"
  pinned-text: "#d3efff"
  good: "#4ade80"
  good-bg: "rgba(74, 222, 128, 0.1)"
  good-ink: "#052e14"
  bad: "#f87171"
  bad-bg: "rgba(248, 113, 113, 0.1)"
  bad-ink: "#3b0808"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(2.3rem, 3vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1.03
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 800
    letterSpacing: "-0.025em"
  caption-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  question:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.08rem, 1.3vw, 1.3rem)"
    fontWeight: 800
    lineHeight: 1.28
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.04rem"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 400
    lineHeight: 1.7
  statement:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.91rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 700
    lineHeight: 1.2
  meta:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
  numeral:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "\"tnum\""
rounded:
  rail: "2px"
  marker-label: "6px"
  tag: "7px"
  inner: "8px"
  timer: "10px"
  control-sm: "11px"
  row: "12px"
  statement: "13px"
  control: "14px"
  card: "16px"
  panel: "18px"
  surface: "20px"
  window: "22px"
  feature: "24px"
  pill: "999px"
spacing:
  wall-gap: "6px"
  reveal-dot: "10px"
  reveal-rise: "14px"
  gutter: "24px"
  gutter-narrow: "14px"
  window-inset: "18px"
  card-inset: "22px"
  caption-inset: "24px"
  plan-inset: "28px"
  column-gap: "56px"
  section: "clamp(72px, 9vw, 120px)"
components:
  button-primary:
    backgroundColor: "{colors.led}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.led-hi}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-line-hover:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
  button-raised:
    backgroundColor: "{colors.raised-2}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-raised-hover:
    backgroundColor: "#22252c"
  button-small:
    rounded: "{rounded.control-sm}"
    padding: "0 16px"
    height: "40px"
  toggle-option:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.inner}"
    padding: "0 10px"
    height: "32px"
  toggle-option-pressed:
    backgroundColor: "{colors.led-soft}"
    textColor: "{colors.led-hi}"
  statement:
    backgroundColor: "#14151a"
    textColor: "{colors.text}"
    typography: "{typography.statement}"
    rounded: "{rounded.statement}"
    padding: "11px 13px"
  statement-pressed:
    backgroundColor: "{colors.led-wash}"
  statement-right:
    backgroundColor: "{colors.good-bg}"
  statement-wrong:
    backgroundColor: "{colors.bad-bg}"
  test-window:
    backgroundColor: "{colors.window}"
    textColor: "{colors.text}"
    rounded: "{rounded.window}"
  session-feed:
    backgroundColor: "rgba(12, 13, 16, 0.94)"
    textColor: "{colors.muted}"
    rounded: "{rounded.panel}"
    padding: "14px"
  event-card:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.row}"
    padding: "8px 10px 8px 8px"
  gantry-strip:
    backgroundColor: "{colors.gantry-black}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  library-tile:
    backgroundColor: "#111214"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "14px"
  sign-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "{spacing.card-inset}"
  wording-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.feature}"
  plan-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.window}"
    padding: "{spacing.plan-inset}"
  guide-link:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
    height: "60px"
  tour-caption:
    backgroundColor: "rgba(12, 13, 16, 0.94)"
    textColor: "{colors.soft}"
    rounded: "{rounded.surface}"
    padding: "{spacing.caption-inset}"
  chip:
    backgroundColor: "rgba(255, 255, 255, 0.16)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  chip-free:
    backgroundColor: "{colors.led}"
    textColor: "{colors.ink}"
  nav-bar:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    height: "64px"
---

# Design System: WEXTheory Home

## Overview

**Creative North Star: "The Night Wall and the Lit Scene"**

**Scope.** This system covers only the home page world: `/` for signed-out visitors (signed-in visitors are sent to `/dashboard`) and `/welcome` for signed-in users. Both render `templates/index.html` with `static/css/home-wall.css`, `static/js/home-wall-init.js` (in `<head>`) and `static/js/home-wall.js`, and every home rule is scoped under the `.hw` wrapper. **Inner pages** keep their layouts and the `[data-theme]` system in `static/style.css`, including their EN/RU switches, but since 19–20 Oct 2026 they share this world's palette: dark by default with a refined light theme, signal blue for actions and selected states. The test room and the dashboard have their own skins. See **Site Theme** below. The scene wall, the always-dark rule and the home motion stay on the home. The previous home is still served at `/?look=classic` (`templates/index_classic.html`) on the incumbent system.

The home page is a night-time wall made of the test's own photo scenes, with a working test window in front of it. Visitors answer the real starter-test questions on the page instead of reading claims about the product. The wall sits dimmed in the background. The scene for the current question lights up in light blue on the wall, and each checked answer leaves a green or red dot on its tile. A session feed of dark event cards logs what the visitor did. The rest of the page follows the same idea: every section puts real material on screen (a sign shown in its scene, actual exam words, a real question in two wordings) and then says plainly what is free and what is paid.

The world is always dark and has no white surfaces: asphalt black, graphite panels and hairlines, heavy tight white Inter for every word, and bold light-blue numerals with tabular figures for every number. Blocks come in once, softly, with a dotted edge like a matrix sign brightening. On wide screens, when the visitor presses "How it works", a guide lifts the real test window out of the wall, grows it into the free space and plays one example question step by step with a caption. The world refuses the usual hero plus a row of feature cards; the first screen *is* the product.

The North Star name comes from the direction contract recorded in the template. It has not been confirmed with the user. The accent (light blue `#5CC8FF`), the removal of every white surface and of RU from the home, blocks assembling on scroll and the scroll tour were the owner's own choices on 19 Oct 2026; the motion idea comes from the Chatterino+ landing (chat.eblo.id), adapted, not copied. On 20 Oct the owner asked for the motion to be calmer and smoother, for the tour to demonstrate the window rather than only describe it, and for arrow keys; the square-cell assembly became the soft reveal. Later that day the owner found the scroll tour slow to scroll through and asked for it to start only on request; it became the guide opened with "How it works".

**Key Characteristics:**
- Always dark. The page forces `data-theme="dark"` for its shared parts without changing the visitor's saved theme.
- No white surfaces. Cards, toggles, buttons and feed events are graphite panels; light comes from photos and the accent.
- Real material only: test photos, Danish sign art, and questions and explanations from the database.
- One accent (signal blue), plus a green/red pair that appears only for results.
- Inter 800 with tight tracking for words and for numerals (tabular figures, Signal Blue). The dot-matrix digits were retired on 22 Oct 2026.
- Depth comes from light (dimmed versus lit photos), not from stacked shadows.
- English only on the home. The Russian helper lives inside the learning pages; the home mentions it once, in the FAQ.

## Colors

The palette is a graphite-black ground with one light-blue accent and a green/red pair reserved for verdicts. There is no light surface. The `--hw-*` custom properties on `.hw` are the source of truth: `--hw-bg`, `--hw-bg-2`, `--hw-panel`, `--hw-raised`, `--hw-raised-2`, `--hw-line`, `--hw-line-2`, `--hw-text`, `--hw-soft`, `--hw-muted`, `--hw-dim`, `--hw-led`, `--hw-led-hi`, `--hw-led-soft`, `--hw-ink`, and the verdict pair. `window`, `image-well`, `gantry-black`, `gantry-rule`, `line-hover`, `pinned-text` and the blue alphas are still literals in `home-wall.css`; they are named here because they recur.

### Primary
- **Signal Blue** (`led`, `#5cc8ff`): the single accent. It marks the primary button, the current step bar, the lit wall tile, focus rings, the ticked statement box, pressed toggles, the open FAQ chevron, hover borders on library tiles, lesson links and guide links, the tour's outline and rail, every numeral, and small source marks: the Danish term on a word card, the sign code, the "Why." label, inline links and list checks. It reaches 10.6:1 on Night Asphalt.
- **Signal Blue Bright** (`led-hi`, `#86d7ff`): the primary button on hover and the text of a pressed toggle.
- **Blue Ink** (`ink`, `#04121c`): text on Signal Blue (primary button, "Free sample" tag, Free chip, ticked check mark, E45 marker label). It reaches 10.1:1 on blue.
- **Blue Haze** (`led-soft`): the pinned note in the session feed (text `#d3efff`), pressed toggles and the finished-sample icon tile. Other blue alphas are derived in place: 8% for a ticked statement, 20% for rings, 32% for text selection, 35% for glows, 45–55% for hover and highlight borders, 70% for a ticked statement's border.

### Secondary (verdicts only)
- **Signal Green** (`good`) on **Green Wash** (`good-bg`): a correct statement, a missed correct statement (dashed border), a correct step bar, the result dot on a wall tile, and the feed badge (with `good-ink` on it).
- **Signal Red** (`bad`) on **Red Wash** (`bad-bg`): a wrong statement, a wrong step bar, the result dot and the feed badge (with `bad-ink`).

### Neutral
- **Night Asphalt** (`bg`): page ground, sticky nav, the hero scrim and the tour veil.
- **Deep Asphalt** (`bg-2`): ground of the sign-lesson links.
- **Window Black** (`window`): the test window. The session feed and tour caption use it at 94% opacity.
- **Graphite Panel** (`panel`): plan cards, word cards, the sign card and the wording card. The site's `--bg-card` maps to it inside `.hw`.
- **Raised Graphite** (`raised`): feed events, guide links and the wording card's answer rows. **Raised Graphite 2** (`raised-2`): the raised button, feed thumbnails and icon tiles, and guide links on hover.
- **Image Well** (`image-well`): sits behind every photo frame so loading tiles never flash.
- **Gantry Black** (`gantry-black`): ground of the fact strips (fact gantry, review days, exam-mode mosaic gaps).
- **Graphite Hairline** (`line`): section dividers, the nav rule, card borders, sign-card row rules, the how-list rules and FAQ rules.
- **Raised Hairline** (`line-2`): borders of controls and raised surfaces: outline and raised buttons, toggles, statements, the timer box, the test window, the sign and wording cards, guide links, the tour caption and idle rail bars. Hover goes to `line-hover`.
- **Headlight White** (`text`): headings and primary text, 18:1 on the ground.
- **Soft** (`soft`): ledes, explanations, sign-card answers, wording answers, plan list items, caption text and summary text.
- **Muted** (`muted`): section paragraphs, nav links, gantry labels, sign-card labels, how-list text, FAQ answers and footer links.
- **Dim** (`dim`): hints, small print, feed times, the tour step total and footer notes. At 5.0:1 on the ground it is the floor; no text goes dimmer.

### Named Rules
**The One Blue Rule.** Signal Blue is the only accent. It means "act here", "you are here", "this is selected" or "this is a number", and it never means right or wrong.

**The Verdict Pair Rule.** Green and red appear only after Check, or where the page explains what Check shows (the three verdict chips in "How the test window works"). They are never decoration, never section colour, and never used on buttons.

**The No-Paper Rule.** Nothing on the home is white or near-white. Surfaces step up from Night Asphalt to Graphite Panel to Raised Graphite with a hairline border; pressed and selected states use Signal Blue, never an inverted white chip.

## Typography

**Display Font:** Inter (with -apple-system, BlinkMacSystemFont, sans-serif), loaded site-wide in `base.html`
**Body Font:** Inter
**Numeral Font:** Inter 800 with tabular figures (Doto dot-matrix until 22 Oct 2026; no longer loaded)

**Character:** Heavy white Inter, set tight, does all the talking. Numbers are bold blue Inter with tabular figures. The root size inside `.hw` is 16px.

### Hierarchy
- **Display** (800, clamp(2.3rem, 3vw, 3.4rem), 1.03, -0.04em): the single hero h1. At ≤700px it becomes clamp(2rem, 8.6vw, 2.5rem).
- **Headline** (800, clamp(2rem, 3.4vw, 3.2rem), 1.04, -0.04em): section h2s, capped at 18ch (16ch for the closing call, whose count is a blue numeral at 1.12em).
- **Title** (800, 1.3–1.6rem, -0.02 to -0.03em): card titles. The sign name is 1.3rem, a plan 1.4rem, a tour caption 1.5rem and the result summary 1.6rem. Library tile names are 0.98rem (1.6rem on the free tile); how-list items 1.15rem.
- **Question** (800, clamp(1.08rem, 1.3vw, 1.3rem), 1.28, -0.02em): the question in the test window. The wording card uses clamp(1.1rem, 1.5vw, 1.3rem) at 1.35.
- **Lede** (400, 1.04rem, 1.65, max 46ch, Soft): the hero paragraph.
- **Body** (400, 1.02rem, 1.7, 48–54ch, Muted): section paragraphs. FAQ answers run to 62ch. How-list text is 0.95rem at 1.6; caption text 0.98rem at 1.6 in Soft.
- **Statement** (400, 0.91rem, 1.4): answer statements. Explanations are 0.9rem at 1.6 in Soft.
- **Label** (700, 0.98rem, 1.2): buttons. Small buttons are 0.88rem, nav links 0.9rem at 600, and toggle options 0.82rem at 700.
- **Meta** (400, 0.76–0.85rem): small print, gantry and sign-card labels, feed times (tabular figures) and footer text.
- **Numeral** (Inter 800, -0.03em, tabular, blue, no glow): gantry facts 2rem; result score clamp(3.2rem, 6vw, 4.6rem); tour step 2.6rem with its total at 1.05rem in Dim; library tile numbers 1.7rem (3rem on the free tile); how-list numbers 1.9rem; review days 1.8rem; feed score 1.25rem; lesson numbers 1.15rem; timer 1.05rem.

### Named Rules
**The Plain Numerals Rule (22 Oct 2026).** The owner asked twice (20 and 22 Oct) to drop the pixel digits: they did not fit the rest of the type and confused learners coming from the tests. Every page, the home included, sets counts, scores, timers, step counters and two-digit indexes in Inter 800 with tabular figures and -0.03em tracking in the accent, with no glow and no dot grid behind them (`.hw-led`, `.wx-led`, the test-room timer and counter, the profile ID). Doto is not loaded anywhere. A number set over a photo gets a soft dark shadow for legibility.

**The Heavy-and-Tight Rule.** Headings are Inter 800 with negative tracking: -0.04em at display and headline sizes, -0.01 to -0.03em below them. Headings use `text-wrap: balance` and paragraphs use `text-wrap: pretty`.

## Layout

Two content widths are defined on `.hw`. **Wide** is min(1560px, 100% − 48px) and holds the nav and hero. **Shell** is min(1240px, 100% − 48px) and holds every section below. At ≤700px both become 100% − 28px, which gives 14px gutters.

**Hero.** The wall is a full-bleed, absolutely positioned grid of auto-fill tiles (min 176px, 5:3, 6px gap and padding). At ≤700px the tiles shrink to 112px with 4px gaps. All 84 wall scenes come from `static/home/wall/`, interleaved by question number so neighbouring tiles come from different tests. Tiles after the 42nd lazy-load. A scrim sits over the wall: a left-heavy horizontal gradient (96% → 30% by 46% of the width) plus fades at the top and bottom. At ≤980px it becomes a vertical 86% → 96% wash. The front grid has three widths:
- **≥1281px:** three columns (minmax(300px, 0.74fr) / minmax(0, 1.6fr) / minmax(262px, 0.52fr)). Headline and lede sit top-left, actions and gantry bottom-left, the test window in the centre and the feed on the right. Inside the window, the question and hint span the full width, the scene and statements sit side by side (1.08fr / 1fr), and the explanation and actions span again.
- **981–1280px:** two columns. The feed drops under the intro on the left and the window stays on the right. The window body stacks into one column, except while the tour is on (1024px and up), when it takes the side-by-side arrangement.
- **≤980px:** one column in story order (headline, window, actions and gantry, feed). The gantry runs four across at full width, then 2 × 2 again at ≤700px. Nav links hide and the burger remains.

**How the test window works.** The first section under the hero lists the guide's steps (01–06) in three columns between hairlines (two at ≤980px, one at ≤700px), each with a blue number, a title and a sentence, plus real material where it helps: the three verdict chips, the E45 sign, a Danish term with its English meaning. Everyone sees it; on wide screens its heading carries a "Watch it in the window" button that opens the guide.

**Sections.** Vertical padding is clamp(72px, 9vw, 120px), and sections are separated by graphite hairlines. A section header is either two columns (1.1fr / 0.9fr, bottom-aligned, gap 24px × 64px, 44px below) or stacked. Split sections use 0.9fr / 1.1fr with a 56px gap. Everything collapses to one column at ≤980px.

**Library.** Six columns, with the free tile spanning 2 × 2. At ≤1100px it is four columns and the free tile spans one row. At ≤700px it becomes a horizontal snap-scroll rail (cards minmax(210px, 66%)) that bleeds into the right gutter.

**Lists that thin out.** Sign lessons go from 3 to 2 columns (≤980px) to 1 (≤700px, first six shown). Word cards go from 2 columns to 1. The feed shows four events (three at ≤700px), and the script keeps at most six in the DOM. At ≤700px buttons go full-width, except small buttons and the window's own actions.

### Named Rules
**The Wall Behind, Window In Front Rule.** The scene wall is backdrop only: `aria-hidden`, dimmed and never interactive. On wide screens (≥1281px) the script moves the sample scenes into uncovered wall cells nearest the window, using layout offsets so the tour's transform does not disturb it, and the lit scene is always visible. Below 1281px the wall stays a quiet backdrop with no lighting and no verdict dots.

**The Whole Scene Rule.** Scenes are framed at their own 5:3 ratio. Question images are 1200 × 720 and wall and feed thumbnails are 320 × 192, so `object-fit: cover` never crops anything; the answer can depend on the edges of the photo. New scene assets must be exported at 5:3.

## Elevation & Depth

Depth comes from light. Wall photos sit at 30% greyscale and 58% brightness. The current scene returns to full brightness with a 2px blue outline and a blue glow. Library photos sit at 60% brightness under a gradient to 84% black and brighten to 74% on hover. During the tour a dithered veil (4px dot raster over 62% asphalt) settles over the wall so the lifted window and its caption read first. Drop shadows are rare: the test window floats on a deep ambient shadow, the tour caption casts a soft one, and the primary button carries a blue glow. Everything else is flat, with hairline borders.

### Shadow Vocabulary
- **Window float** (`box-shadow: 0 44px 90px -34px rgba(0, 0, 0, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.04)`): the test window only.
- **Caption drop** (`box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.9)`): the tour caption card.
- **Raised edge** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05)`): the raised button.
- **Blue button glow** (`box-shadow: 0 12px 30px -16px rgba(92, 200, 255, 0.75)`): the primary button.
- **Lit tile** (`box-shadow: 0 0 0 4px rgba(92, 200, 255, 0.2), 0 0 50px rgba(92, 200, 255, 0.35)`): the wall tile of the current question.
- **Marker glow** (`box-shadow: 0 0 0 4px rgba(92, 200, 255, 0.2), 0 0 30px rgba(92, 200, 255, 0.35)`): the blue box around a sign in a scene. It pulses to an 8px ring and 48px glow twice.
- **Current step / rail** (`box-shadow: 0 0 12px rgba(92, 200, 255, 0.5)` and `0 0 10px rgba(92, 200, 255, 0.6)`): the active step bar and the active rail bar.
- **Verdict dot** (`box-shadow: 0 0 12px <good|bad>`): the 10px result dot on a wall tile.
- **Numeral glow:** retired with the dot-matrix digits on 22 Oct 2026; numerals have no glow.

### Named Rules
**The Lit-Not-Lifted Rule.** Things come forward by brightening and taking a blue glow, not by stacking shadows. Only the test window and the tour caption cast drop shadows. Hover lifts are 1px at most (the primary button), or a 4% photo zoom on library tiles.

## Shapes

Corners are soft and nest inward: the outer surface has the largest radius and things inside get smaller ones. The wording card is 24px, the window and plan cards 22px, the sign card, sign scene and tour caption 20px, the feed and review strip 18px, library tiles and word cards 16px, and buttons, the gantry, the question photo, the explanation panel, guide links and the tour outline 14px. Statements are 13px; feed events, pinned note, lesson links and wording answers 12px; toggle groups, small buttons and the burger 11px; the timer box 10px; wall tiles, toggle options, verdict chips and the sign marker 8px; tags, check boxes and feed thumbnails 7px; the marker label 6px; rail bars 2px. Step bars and chips are full pills (999px). Verdict dots and feed badges are circles. The FAQ chevron is drawn from two 2px borders and turned 45° → 225° when open; it is not an icon.

### Named Rules
**The Inner-Smaller Rule.** A shape inside another uses a smaller radius: window 22px → photo 14px → statement 13px → check box 7px; feed 18px → event 12px → thumbnail 7px.

**The Gantry Texture Rule.** Retired on 22 Oct 2026 with the dot-matrix digits: fact strips are plain Gantry Black with Gantry Rule lines, and no surface carries a blue dot grid.

## Motion

Motion has one job here: make the page feel like a sign brightening as you arrive, then show how the test window works by playing it. The owner asked for it to be smooth and calm rather than technical (20 Oct 2026), so nothing snaps or flickers.

**Soft reveal.** Every block comes in once, when it first enters the viewport (bottom 8% excluded): it fades and rises 14px while a dotted edge wipes down it, over 0.95s with `cubic-bezier(0.22, 1, 0.36, 1)`. The edge is a mask of two layers, a top-to-bottom gradient and a 10px dot grid whose dots grow, both driven by the registered properties `--hw-wipe` and `--hw-dot`; when the animation ends the block gets `is-done` and the mask is removed. The test window reveals without the rise, because the tour moves it. Wall tiles fade and settle from 94% scale over 0.9s, outward from the test window (80ms + distance × 1100ms + up to 160ms jitter). The first screen comes in at load: intro (60ms), window (180ms), actions and gantry (320ms), feed (440ms). Within one batch of blocks the stagger is at most 360ms. At the very bottom of the page whatever is left comes in at once.

**Guide.** Nothing moves until the visitor asks: the owner found a tour that starts on scroll slow to get through, so the page scrolls normally and the guide opens only from a "How it works" button in the window bar (it pulses twice for signed-out visitors) or the "Watch it in the window" button in the how-list. It is available at ≥1024px wide and ≥600px tall without reduced motion. Opening scrolls the page to the top if needed, locks page scrolling, fades the intro and feed out (`inert`), settles the dithered veil over the wall and moves the real window with a 0.75s ease-out transform (scale 0.6–1.35) into the space right of a 270–380px caption column, clear of the rail.

Then the window turns into a **demonstration**: its body switches to one example question that is not in the sample (Theory Test 1, question 2, the E45 scene), the bar reads "Example · Theory Test 1" and the "Free sample" tag hides. Each step adds to what the window shows, and going back takes it away again:
1. **Scene** — the whole photo is outlined.
2. **Statements** — two statements tick themselves, half a second apart.
3. **Check** — Check gives way to Next question and the verdicts appear: Correct, Wrong, Missed, and the untouched wrong statement fades.
4. **Why** — the first sentence of the real explanation rises into place (its space is reserved from the start so the window does not jump).
5. **Sign** — the E45 marker appears on the photo and pulses twice, with a chip naming the sign.
6. **Wording** — the question and statements cross-fade to their plain versions and an Original / Plain switch appears with Plain pressed.

The step's target has a 2px blue outline at 5px offset and the rest of the window steps back to 38% opacity. The caption card on the left repeats the step (counter, title, sentence, material), cross-fading between steps; it has a close button, a back button, the key hint and a blue next button that reads "Try it yourself" on the last step, where the caption also says the walk-through is over. A rail of 3 × 32px clickable bars at the right edge shows progress. **Moving:** one wheel turn or swipe is one step (the rest of the same flick is ignored until a 260ms pause); arrow keys, Page Up / Page Down and Space step too, Home and End jump to the first and last step. **Leaving:** Escape, the close button or a click anywhere outside the caption and window closes the guide and puts the window back; next on the last step closes it and moves focus to the first statement of the real sample. In the real window, arrow left and right change the sample question.

**Feedback.** Buttons shift colour in 0.15s and the primary button rises 1px; statements recolour in 0.15s; new feed events slide in from 10px above over 0.5s; the wording switch fades text out for 0.2s and swaps it at 180ms; the sign marker pulses twice.

### Named Rules
**The Visible-By-Default Rule.** Blocks are hidden only while `html.hw-anim` is set, which `home-wall-init.js` adds in `<head>` when masks and IntersectionObserver are available and reduced motion is off. If `home-wall.js` has not reported in after 3 seconds, the class is removed and everything shows. Print always shows everything and switches the tour off.

**The Reduced-Motion Rule.** With reduced motion there is no reveal, no tour and no wording fade; the how-list is shown as a plain list, transitions collapse to 0.01ms, the marker does not pulse and feed cards only fade in (0.3s).

**The Calm Motion Rule.** Motion eases in and out; nothing steps, flickers or jumps. Scroll-linked movement is eased, discrete changes (captions, demo states) cross-fade, and the only repeated movement is the marker's two pulses.

**The Ask-First Rule.** The guide never starts on its own, not on scroll and not on load. Scrolling the page always just scrolls the page.

**The Transform-Only Guide Rule.** The guide moves the window with `transform` (origin top left) and fades parts with `opacity`; geometry is measured from layout offsets when it opens, when the window changes height and on resize.

## Components

### Buttons
- **Shape:** gently rounded (14px), 52px tall, 24px side padding, 0.98rem / 700, 10px icon gap. Small buttons are 40px tall, 16px padding, 11px radius, 0.88rem.
- **Primary (blue):** Signal Blue with Blue Ink and the blue glow. It is the main action of every block: start the free test, check an answer, open lessons, try ten words, see how access works.
- **Hover / Focus:** blue brightens to `led-hi` and rises 1px. All buttons transition transform, background and border in 0.15s, and the shadow in 0.2s. Focus is a 2px blue outline at 3px offset, shared by every link, button and FAQ summary in `.hw`.
- **Outline (line):** transparent with a Raised Hairline border and white text. On hover the border goes to `line-hover` with a 4% white wash. Used for the secondary action beside a blue button.
- **Raised:** Raised Graphite 2 with a Raised Hairline border, a 1px inner top light and white text; on hover the border turns blue at 55% and the ground lightens to `#22252c`. Used in the nav (Create account, Dashboard) and on the free plan card.

### Toggle (Original / Plain)
- **Style:** a segmented group with 3px padding, a Raised Hairline border and an 11px radius. Options are 32px × 42px minimum with an 8px radius, Muted 0.82rem / 700, white on hover.
- **State:** the pressed option is Blue Haze with Signal Blue Bright text and a 1px inset blue ring at 50% (`aria-pressed="true"`).
- **Behaviour:** Original is pressed by default. Switching fades the question and answers out for 0.2s and swaps the text at 180ms, or instantly with reduced motion.

### Statements (the window's inputs)
- **Style:** a full-width button row: a 22px check box (7px radius, 1.5px `#5f626b` border), the statement text, then a verdict label. Ground `#14151a`, Raised Hairline border, 13px radius, 11px × 13px padding.
- **Ticked:** a blue border at 70% over an 8% blue wash, and the box fills Signal Blue with a Blue Ink check.
- **After Check:** right is a green border with Green Wash and the label "Correct". Missed is a dashed green border and "Missed". Wrong is a red border with Red Wash and "Wrong". Untouched wrong statements fade to 60%. Verdict labels are 0.72rem / 800 uppercase at 0.05em, in the verdict colour.
- **Hint:** "Tick every statement that is right — often more than one." in Dim. It turns blue when Check is pressed with nothing ticked.

### Chips
- **Style:** pill, 3px × 8px, 0.72rem / 700, 16% white on photos. **Free** is Signal Blue with Blue Ink; **Full access** is the white-alpha chip with a lock icon. The exam-mode "Mixed" tag is a 7px-radius chip in 60% black with blue text. **Verdict chips** in the how-list repeat the statement verdict labels: 8px radius, 1px border, Correct (green on Green Wash), Missed (dashed green), Wrong (red on Red Wash).

### Cards / Containers
- **Library tile:** a 4:3.5 photo tile with a 16px radius, Graphite Hairline border and `#111214` ground. The photo sits under a gradient to 84% black. A bold blue two-digit test number sits top-left (with a soft dark shadow over the photo); the name (0.98rem / 800) and meta with a chip sit at the bottom. On hover the border turns blue at 55% and the photo zooms 4% and brightens. The free tile spans 2 × 2 with a blue border, "00" at 3rem and 22px padding. The exam-mode tile uses a 2 × 2 mosaic of four scenes with 2px gaps. Theory Test 12 asks rule questions without a road scene; its tile shows the test's own rules graphic (the one every Test 12 question uses), dimmed to 42% brightness.
- **Plan card:** Graphite Panel, Graphite Hairline border, 22px radius, 28px padding (22px at ≤700px). The title is 1.4rem / 800, the list is Soft with blue checks, and the button is pinned to the bottom left. The full-access card adds a blue border at 45% and an 8% blue wash at the top.
- **Word card:** Graphite Panel, 16px radius, 18px padding. The Danish term is in blue (0.82rem / 700, `lang="da"`) above the English in white (1.1rem / 800).
- **Guide link:** a Raised Graphite bar at least 60px tall with a Raised Hairline border, a 14px radius, 700 white text and a blue trailing arrow that moves 3px on hover while the border turns blue.
- **Shadow strategy:** flat, apart from the exceptions listed under Elevation & Depth.

### Navigation
- **Top bar:** sticky, 64px tall, solid Night Asphalt with a Graphite Hairline underneath and no blur. It holds the burger (40px, 11px radius, outlined), the WEXTheory wordmark (Inter 800, -0.045em, from the site `.logo`), and anchor links in Muted 0.9rem / 600 with 26px gaps that turn white on hover. On the right are Sign in (text) and Create account (raised small button), or Dashboard when signed in. The links hide at ≤980px. At ≤480px Create account hides and Sign in becomes a 40px outlined control.
- **Footer:** Graphite Hairline on top, wordmark, Muted 0.9rem links and a Dim 0.82rem note.
- **FAQ disclosure:** `details` rows between hairlines. The summary is 1.05rem / 700 with a drawn chevron that turns blue when open. The answer is Muted, 62ch, line height 1.7.

### Test Window (signature)
The working sample, `section#try`. Window Black, Raised Hairline border, 22px radius, window float shadow.
- **Bar:** a blue "Free sample" tag (hidden at ≤480px), the "Question n of N" title (1rem / 700) and a blue tabular timer in an outlined 10px-radius box.
- **Timer:** decorative (`aria-hidden`). It counts down from 25:00 only while the hero is on screen, the tab is visible and the sample is unfinished, and it wraps back to 25:00 at zero.
- **Steps:** one pill bar per question, 5px tall. Idle is `#2a2c33` (hover `#4a4d56`), checked bars turn green or red, and the current bar is blue with a glow (`aria-current="step"`). Each bar is a button that jumps to its question.
- **Body:** the whole 5:3 scene (14px radius), the question, the hint, the statements, and the explanation panel. The panel is `#121318` with a Graphite Hairline border and 14px radius, a blue "Why." label and Soft 0.9rem text. Check answer (blue) becomes Next question (outline, with an arrow), which reads "See your result" on the last question.
- **Summary:** the score in blue at clamp(3.2rem, 6vw, 4.6rem), a 1.6rem title, a short paragraph, then "Continue with N free questions" (blue) and "Try these again" (outline).
- **Keyboard and focus:** keys 1–4 tick statements while the window has focus. After Check, focus moves to Next. After Next, it moves to the new question text; at the end, to the summary's main action. A `noscript` line links to `/test/0`.

### Session Feed (signature)
Window Black at 94%, Graphite Hairline border, 18px radius, 14px padding. The header is "Session" with the blue score. Below it is a pinned Blue Haze note saying nothing is saved. Events are Raised Graphite cards (12px radius, Graphite Hairline border, the newest one with a blue border at 45%) in three columns: a 52 × 34px thumbnail (7px radius), the text (0.84rem / 600 white) and a tabular time in Dim. A checked question's thumbnail is its own scene with a 16px green or red badge. Non-question events use an icon tile on Raised Graphite 2: the keyboard tip ("Keys 1–4 tick statements", hidden on touch screens) and the finished sample (Blue Haze with a blue flag). New events slide in from 10px above. The list is `aria-live="polite"`.

### Fact Gantry (signature)
One strip of facts instead of separate stat boxes. It is a `dl` in a 2 × 2 grid up to 420px wide, with a Gantry Rule border and 14px radius, on Gantry Black. Each cell has 14px × 16px padding, a Graphite Hairline divider, a 2rem blue number above a Muted 0.8rem label. The same strip and numerals form the review strip (1, 3, 7, 14, 30 days, divided by Gantry Rule lines).

### Sign Card and Scene Marker (signature)
The scene is a 5:3 figure with a 20px radius and a Graphite Hairline border. The sign in the photo is boxed by a 2px blue marker (8px radius) labelled with its code in a blue chip. It pulses twice over 2.4s each and then rests. A 60% black caption chip sits bottom-left. Beside it is a Graphite Panel sign card with a Raised Hairline border (20px radius, 22px padding): the 64px sign artwork (52px at ≤700px), the code in blue 0.82rem / 800 at 0.06em, the name as a 1.3rem title, and three rows ("What it means", "Your action", "Common mistake" with a blue warning icon) divided by Graphite Hairlines, labels in Muted and answers in Soft.

### Wording Card (signature)
A Graphite Panel two-column card with a Raised Hairline border and a 24px radius: the scene fills the left half (min-height 320px) and the body sits on the right, padded clamp(24px, 3.4vw, 44px). It holds the Original/Plain toggle, the question at 800, and answers as Raised Graphite rows (Raised Hairline, 12px radius, 0.93rem Soft). At ≤980px it stacks, with the photo back at 5:3.

### Tour Caption and Rail (signature)
The caption is a card at the left of the hero, vertically centred in the visible area: Window Black at 94%, Raised Hairline border, 20px radius, 24px padding, caption drop shadow. Its body (`aria-hidden`, since the how-list carries the same text for screen readers) holds the step counter (2.6rem, total in Dim), a 1.5rem title and Soft text copied from the matching how-list item, and cross-fades on each step. Under a hairline sit two 38px back and next buttons, the key hint and a blue "Try the sample" link. The rail is a column of 3 × 32px clickable bars, 4px apart, 16px from the right edge: idle Raised Hairline, passed `line-hover`, current Signal Blue with a glow. Both fade in with the lift.

## Site Theme (inner pages)

On 19–20 Oct 2026 the owner asked for the home's look on the rest of the site too, starting with the test and the dashboard, and to keep and refine the light theme. The inner pages keep their own layouts and the `[data-theme]` system in `static/style.css`; what changed is the palette, the default and a few shared components.

**Default and choice.** Dark is the default for every page (`<html data-theme="dark">`, `theme-init.js`, `base.js`). A visitor who picks light keeps it under the `localStorage` key `wex-theme-v2`; the key changed on 20 Oct 2026 so that a light theme saved under the old `wex-theme` key before the redesign does not carry over. The home is always dark.

**Tokens** (`static/style.css`, `:root` for dark and `[data-theme="light"]`):

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#08090b` | `#f6f7f9` | page ground |
| `--bg-card` | `#111216` | `#ffffff` | cards, answer rows |
| `--bg-soft` | `#15161b` | `#eef0f3` | wells, image grounds, small panels |
| `--border` / `--border-strong` | `#23252b` / `#34363e` | `#e2e4e9` / `#cdd1d8` | hairlines / controls |
| `--text` / `--text-soft` / `--text-muted` | `#f4f4f5` / `#d4d4da` / `#a7a7b0` | `#0b0c0f` / `#2d3038` / `#5b5f69` | text levels |
| `--accent` | `#5cc8ff` | `#0a6fa8` | links, selected states, progress, focus |
| `--accent-soft` / `--accent-ring` | blue at 14% / 45% | deep blue at 10% / 40% | selected grounds and rings |
| `--btn-bg` / `--btn-hover` / `--btn-text` | `#5cc8ff` / `#86d7ff` / `#04121c` | `#5cc8ff` / `#47bdf7` / `#04121c` | the primary button in both themes |
| `--correct` / `--wrong` and their `-bg` | unchanged greens and reds | `#15803d` / `#b91c1c` on `#ecfdf3` / `#fef2f2` | verdicts, readable on white |

**Phones (22 Oct 2026).** The owner found the home page and the sign pages awkward on a phone, so phones get their own order rather than a squeezed desktop. Home (≤700px): title, the start button and the access link first, then the sample window, then the facts; no session feed; sections 40px apart with smaller headings; "How it works" shows only its six titles; the sign section keeps the scene and the meaning, without the review-days strip and the lesson list; two word cards; no plain-wording demo; tighter access cards. A second pass hides the ledes of How it works, the library, the sign section and test day, and the word cards (the heading and the Try ten words button stay), with sections 32px apart. The page went from about 12 screens to 6.4. Signs (≤760px): smaller headings, no method strip on the course page, one-line lesson rows (number, title and meta, state chip on the right, no meter), the lesson's focus line hidden while studying, the situations' intro line hidden, a solid action bar under Learn (Back narrow, Next on one line), a full-width Check answer, and switching steps always brings the step bar under the site bar. On touch screens answer hover never colours an answer, so a tapped option does not look selected (sign pages and the test room).

**Shared components.** The primary button is signal blue with Blue Ink in both themes (10px radius, 700, colour hover with a blue glow); the outline button has a `--border-strong` border and a 10px radius. Selected answers, pressed tabs, filter chips and language switches use `--accent-soft` with `--accent` text and an `--accent-ring` inset ring, never an inverted white or black chip. Progress fills and the current-question dot use `--accent`. Text selection, the focus ring and the scrollbar take the palette. `static/css/world.css`, loaded on every page, holds the pieces pages share: `.wx-led` numerals (Inter 800, tabular, accent), the `.wx-wall` strip of real scenes, the `.wx-gantry` strip of counted facts and the top-bar links.

**Top bar.** Inner pages (not sign-in, sign-up, password, admin or the test) include `templates/_nav_links.html` next to the logo: Tests, Signs, Words, and Quick session and Profile when signed in or Access when not, Muted 0.88rem / 600, the current page in Headlight with a 2px blue underline. The links hide at ≤960px, where the menu button holds them.

**The test room** (`templates/test.html` + `static/css/test-room.css`). The photo takes as much width as the screen height allows at 5:3, up to 64% of a container of min(1680px, 100% − 48px), and the statements take the rest, so the question fills the screen without zooming. The question is Inter 800 at clamp(1.22rem, 0.85rem + 0.62vw, 1.7rem); statements are 1px `--border-strong` rows with a 14px radius. The timer and the bottom counter are Inter 800 with tabular figures in `--accent`. Keys: ← and → move between questions and 1–9 tick answers, except while typing, with the menu, a dialog, the question map or the photo zoom open, or while text is selected for the word helper. A hint under the counter shows them on screens with a keyboard.

**The dashboard** (`templates/dashboard.html` + `static/css/dashboard.css`). A strip of twelve real scenes sits behind the top of the page under a fade to the page ground. Below it: "Your learning" in Inter 800 up to 3.6rem, the access pill and note, the actions, and one gantry strip of counted facts with bold numerals (tests completed out of the library, mistakes to review only when there are some, days of access left). Three ways in show real material: a scene fills the Practice tests card, four sign artworks head Road signs, one exam phrase heads Exam words. Test cards follow the home library tiles: photo with a bold two-digit number and a Free or Full access chip, then the title, wording note and the Original / Alternative results; on phones they become compact rows with the photo on the left. Cards open with Enter or Space as well as a click.

**The profile** (`templates/profile.html` + `static/css/profile.css`). The same scene strip, the 3.6rem title and the actions, then one identity card: a 104px avatar in a graphite well with a blue ring, the name at up to 2.2rem, pills, the user ID in tabular Inter, and beside it the access and completion panels with bold numbers and a blue meter that grows in. The four results (attempts, passed, average, best) are one gantry strip. The attempt history is a hairline table with blue row hover; side panels are graphite cards. Sections rise in over 0.7s.

**Road signs** (`templates/sign_lessons.html`, `sign_lesson.html`, `sign_learn.html`, `signs.html`, `sign_detail.html` + `static/css/signs.css`; 20 Oct 2026, the owner chose "a course of short lessons with spaced review" over a single daily button or a light refresh). One path with one progress record (`static/js/sign-progress.js`): review levels per sign (`sign-review.js`, 1/3/7/14/30 days) and finished lesson results, kept in the browser for guests and in the account for signed-in learners (`/api/signs/progress`, `/api/signs/lessons`, table `sign_lesson_results`). Only source-checked notes from `curriculum.json` are taught; the 103 signs without one show their official names and "Explanation not checked yet".
- **Course page** (`/signs/lessons`): the 3.6rem title and lede, a gantry strip (signs in your review of the 150 the course teaches, signs to repeat today, lessons done; "learned" — three correct spaced answers — is counted on the review page), and a Next step panel (accent border, blue wash at the top) whose one button always knows what comes next: repeat due signs, fix a lesson's situation mistakes, continue an opened lesson, or start the next one. A hairline strip shows the method (Learn, Recall, Compare, Decide, repeat after 1 3 7 14 30 days). The 18 lessons follow as one numbered route 01–18 (bold number, three sign artworks, title, focus, topic and counts, a state chip New / In progress / Fix mistakes / Done and a blue meter of signs started), with a search field and topic chips. After the lessons comes "After the lessons: road sign tests" (`#signTests`): the four Road Signs Tests as photo cards (first situation, number top-left, title, last result or "25 situations · full access"), a line saying most situations come from the lessons and 15 are new, and the official Færdselsstyrelsen practice test (dtp.fstyr.dk) as the last rehearsal. When every lesson is done, the Next step button points to this block. The catalogue is one panel at the end.
- **Lesson player** (`/signs/lesson/<id>`): a numbered header, then a bar of five step chips (current: blue number on a blue-ringed chip; done: blue-washed number; Result disabled until the first check is finished), then one window (22px, `--border-strong`, the window float in dark). Learn shows one sign at a time: sign thumbnails as tabs, a 280px art well, code and Danish name, the name at up to 1.9rem and a rows panel (What it means when checked, Your action, Common mistake with a blue "!" mark); a checked road scene sits under the art. When a sign has no checked test photo, an illustrated example takes the wide column under the rows (up to 680px, 5:3, opens in the lightbox like a test photo) with the caption "Example on the road · Illustration: the street is AI-made, the sign is the official drawing."; on phones it follows the art. Recall asks "What does this sign mean?" with four names from the same lesson (equivalent arrows excluded), shows the verdict with the checked meaning (or action) and, after a miss, the common mistake, and asks a missed sign again at the end; each answer grades the sign. Compare lists the checked comparisons. Situations keep the first-check store (`lesson-check-store.js`). Result shows three scores (first check, recall on the first try, signs in review with the next repeat), the missed situations with a link back to their sign, Practise my mistakes, Repeat these signs and the next lesson. Without JavaScript all steps show stacked. ← and → move between signs; 1–4 answer.
- **Review** (`/signs/learn`): rounds of up to 12 checked signs. Due signs first; with none due, extra practice with signs already met; a new learner gets lesson 01. No modes or set menus; `?lesson=`, `?group=` and `?review=due` narrow the round. Since 22 Oct 2026 it is one room like the test room, because the owner found the old page small and the question too low: right under the tabs a bar holds the title, the lesson and the progress (counter, pills, score), and the question starts at the top of the panel. Two columns from 1020px: "What does this sign mean?" shows the sign in a large square well on the left and the question with four 66px answer rows on the right; "Which sign has this meaning?" shows the question and the checked meaning in a large panel on the left and a 2 × 2 grid of sign tiles on the right. A sign whose note has no checked meaning is asked by name ("Find this sign"), never by its action alone. Type is larger than in the lesson player (question up to 2.1rem, answers up to 1.18rem). The verdict panel and Next sign follow the answers; the next question scrolls back to the top of the room. The result reads like a test result: the score, "Round finished", the next repeat, every sign of the round marked Right or Missed, Repeat the missed ones / New round / Back to lessons, and a link to the road sign tests. The counts (to repeat now, learning, learned) are one plain line under the room.
- **Catalogue and a sign's page**: a sticky toolbar (search, "Only checked explanations", family chips), status dots on cards (learned green, learning blue ring, repeat now blue with glow) and a "name only" tag on unchecked signs. A sign's page has a dot-textured art well, the status pill, the rows panel or the dashed "not checked yet" note, "Learn it in lesson NN", the lessons that teach it, "Do not confuse" comparisons, the checked scene (or, without one, the labelled illustrated example) and the same family.
- **Illustrated examples** (`data/signs/scene_examples.json`, `static/signs/scenes/<code>.webp`; 20–21 Oct 2026, asked for by the owner). An image model (Codex image generation or Gemini) draws only a Danish street in the style of the test scenes, with no signs or text and one flat #FF00FF board on an empty post (prompts and rules: `.impeccable/sign-scenes/scenes.md`). A script finds the board, fills it from its surroundings and draws the official artwork from `static/signs/` there, with the plate under its main sign for U-plates, then crops to 5:3, sharpens lightly and saves 1200 × 720 WebP. The model never draws a sign, so no sign in an example can be wrong. One street serves several signs. Examples exist only for signs with a checked note, are always labelled as illustrations, never appear in questions, and give way to a checked test photo when there is one. Every composite is looked at before it is published.
- **Exam-style situations** (`data/signs/situations.json`, pictures in `static/signs/situations/`; 21 Oct 2026, the owner asked for situations "from the driver's seat, like the exam", including "your car" seen from behind as in Test09 q17). Since 21 Oct 2026 all 18 lessons use them in the Situations step (85 situations), instead of the older single-choice questions. Each one is a 5:3 picture, a question, a hint "Tick every statement that is true", 2–4 statement rows (checkbox square, the same rows as the answer options) and a Check answer button. The answer is the ticked set; it counts only when it matches the true statements exactly, as in the theory test. After checking, each row turns green or red by whether the learner judged it right, and shows "This is true" or "This is false" with a one-line reason; the panel below gives the verdict and the explanation. Statements only restate checked notes or checked lesson questions (`basis` names which). Pictures are 3D driving-simulator renders like the exam (the owner's choice), one place per situation, with the road user the question is about; two situations use checked exam photos. Backgrounds and their brief: `.impeccable/sign-scenes/bg-3d/`, `scenes-3d.md`.
- **Road sign tests 1–4** (22 Oct 2026, the owner's choice: a separate block numbered 1–4, four tests of 25, paid like the other tests). The dashboard shows a second block "Road sign tests" under "Practice tests", with the same cards (picture, LED number 01–04, tag "Road signs · 25 situations", latest score). They are ordinary tests 101–104 (`sign_tests.py`, data `data/signs/sign_tests.json`), so they use the normal test room, results and mistake review: the picture is the situation, the answer options are its statements, and the explanation lists each statement as true/false with its reason. Each test mixes all 18 lessons: the 85 lesson situations plus 15 test-only ones (brief `scenes-3d-tests.md`). They never count toward the "tests completed of 14" figure.
- On phones the steps become five compact chips, the Learn buttons stick to the bottom of the screen, the lesson cards drop their artwork and focus line, and filter chips scroll sideways.

**Invite friends** (`templates/referrals.html` + `static/css/referrals.css`). The offer headline sets its day counts in bold numerals beside the invite link panel (link box with a blue copy button, share buttons with brand icons, a quiet regenerate link). "How an invite works" is four steps on one line with icons; while the flow is on screen a blue light travels along the line every 6 seconds and wakes each step as it passes (it stops off screen and with reduced motion). Rewards are one gantry strip, then the reward limit with a blue meter and the rules, then the list of recent invites.

## Do's and Don'ts

### Do:
- **Do** scope every home style under `.hw`, and map the site tokens (`--bg`, `--bg-card`, `--border`, `--text`, `--text-muted`) to the home values inside that scope, so shared parts such as the menu and cookie banner render dark on this page only.
- **Do** take every count from data: `home_facts` (tests, questions, free questions, lessons, signs explained, exam words) and the length of `home_questions`, all built in `build_home_context` in `main.py`. Only format constants of the real test (25 questions, pass at 20, review after 1, 3, 7, 14 and 30 days) may be written into copy. Copy that names the sample's size hides when there are no sample questions.
- **Do** use real material only: photos from the test library, artwork from `static/signs/`, and questions, statements and explanations from the database. The one exception, chosen by the owner on 20–21 Oct 2026, is the labelled illustrated sign examples in the sign lessons and sign pages (see Road signs); they never stand in for a test photo or a question image.
- **Do** keep the home in English. The home's question data is English only; Russian stays inside the learning pages.
- **Do** keep the working window fully keyboard-operable, with `aria-pressed` toggles, `aria-current` steps, keys 1–4, managed focus and a polite live feed, in the tour as well as outside it.
- **Do** give every new home block `data-reveal` so it comes in with the rest, and keep it visible when `html.hw-anim` is absent.
- **Do** add a tour step by adding an item to the how-list with a `data-focus` name and a matching entry in `focusOf` in `home-wall.js`; the track, counter and rail follow the list length.
- **Do** give every photo intrinsic width and height and the Image Well ground. Lazy-load wall tiles after the 42nd and everything below the fold, and preload the first question scene with high fetch priority.

### Don't:
- **Don't** force dark, the scene wall or the home motion onto inner pages; they share the tokens and keep the visitor's theme choice. **Don't** paint a selected state on any page as an inverted white or black chip; use the accent tokens.
- **Don't** bring back white or near-white surfaces, inverted white toggles or a white button anywhere on the home.
- **Don't** add an EN/RU switch or Russian text to the home; the FAQ answer about the Russian helper is the one mention.
- **Don't** bring back dot-matrix digits or a dot grid behind numbers (retired 22 Oct 2026).
- **Don't** use blue, or any colour other than the verdict pair, to say right or wrong.
- **Don't** crop a scene to another ratio, or show a cropped detail as the question image.
- **Don't** show user counts, pass rates, testimonials, reviews or prices. The gantry holds counted catalogue facts only.
- **Don't** make the wall interactive or expose it to screen readers, and don't light tiles or place verdict dots below 1281px.
- **Don't** pile numbers into separate stat boxes; facts live in one gantry strip.
- **Don't** add a second scroll-driven effect or a different entrance per section; the soft reveal is the one entrance and the tour the one scroll moment. Keep motion calm: no stepped, pixel or flicker effects (the owner found them too technical for a driving-test site).
- **Don't** animate layout properties in the tour or hide content without the `html.hw-anim` guard.
- **Don't** turn the two uppercase tracked micro-labels in the build (the window's "Free sample" tag and the feed's "Session" header) into a label style for other blocks. They stay local to those two components; the verdict labels and chips share their own style.
