(() => {
  'use strict';

  const root = document.documentElement;
  // The home page is dark by design. base.js restores the saved theme on load; keep shared parts
  // (menu, cookie banner) in their dark styling on this page only, without changing the saved choice.
  root.setAttribute('data-theme', 'dark');

  // Set by home-wall-init.js in <head> when motion is welcome and masks are supported.
  const motion = root.classList.contains('hw-anim');
  const page = document.querySelector('.hw');
  const hero = document.querySelector('.hw-hero');
  const wall = document.querySelector('.hw-wall');
  const quiz = document.querySelector('[data-hw-quiz]');
  const dataNode = document.getElementById('hwQuestions');
  const questions = dataNode ? JSON.parse(dataNode.textContent) : [];
  const tiles = new Map([...document.querySelectorAll('.hw-tile[data-scene]')].map((tile) => [tile.dataset.scene, tile]));

  // Small seeded generator, so the cell patterns and delays are the same on every visit.
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Original / plain wording switch.
  document.querySelectorAll('[data-hw-wording]').forEach((card) => {
    const buttons = [...card.querySelectorAll('[data-hw-mode]')];
    buttons.forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.hwMode;
      if (button.getAttribute('aria-pressed') === 'true') return;
      buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      const swap = () => card.querySelectorAll('[data-original]').forEach((node) => { node.textContent = node.dataset[mode]; });
      if (!motion) return swap();
      card.classList.add('is-swapping');
      setTimeout(() => { swap(); card.classList.remove('is-swapping'); }, 180);
    }));
  });

  /* ── Soft reveal ──
     Each block comes in once, when it first enters view: it fades up while a dotted edge wipes
     down it. The wall's tiles light up outward from the test window. */
  function setupReveal() {
    const rand = seeded(0x5cc8ff);
    const show = (node, delay) => {
      if (node.classList.contains('is-in')) return;
      node.style.setProperty('--hw-in-delay', `${Math.round(delay)}ms`);
      const done = (event) => {
        if (event.target !== node) return;
        node.classList.add('is-done');
        node.removeEventListener('animationend', done);
      };
      node.addEventListener('animationend', done);
      node.classList.add('is-in');
    };

    const anchor = (quiz || hero || page).getBoundingClientRect();
    const cx = anchor.left + anchor.width / 2;
    const cy = anchor.top + anchor.height / 2;
    const far = Math.hypot(window.innerWidth, window.innerHeight) || 1;
    tiles.forEach((tile) => {
      const r = tile.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) / far;
      show(tile, 80 + d * 1100 + rand() * 160);
    });
    if (wall) setTimeout(() => wall.classList.add('is-settled'), 2400);
    [['.hw-intro-head', 60], ['.hw-window', 180], ['.hw-intro-foot', 320], ['.hw-feed', 440]].forEach(([selector, delay]) => {
      const node = hero && hero.querySelector(selector);
      if (node) show(node, delay);
    });

    const rest = [...page.querySelectorAll('[data-reveal]')].filter((node) => !node.classList.contains('is-in'));
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        show(entry.target, Math.min(n * 90, 360) + rand() * 60);
        n += 1;
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    rest.forEach((node) => io.observe(node));

    // At the very bottom the shrunken observer area can miss the last blocks: show what is left.
    const atBottom = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) return;
      rest.forEach((node) => { io.unobserve(node); show(node, 0); });
      window.removeEventListener('scroll', atBottom);
    };
    window.addEventListener('scroll', atBottom, { passive: true });
    root.classList.add('hw-anim-ready');
  }

  if (!quiz || !questions.length) {
    if (motion && page) setupReveal();
    return;
  }

  /* ── The sample test window ── */
  const pick = (selector) => quiz.querySelector(selector);
  const ui = {
    index: pick('[data-hw-index]'),
    image: pick('[data-hw-image]'),
    text: pick('[data-hw-text]'),
    hint: pick('[data-hw-hint]'),
    list: pick('[data-hw-statements]'),
    why: pick('[data-hw-why]'),
    whyText: pick('[data-hw-why-text]'),
    check: pick('[data-hw-check]'),
    next: pick('[data-hw-next]'),
    body: pick('[data-hw-body]'),
    summary: pick('[data-hw-summary]'),
    final: pick('[data-hw-final]'),
    restart: pick('[data-hw-restart]'),
    timer: pick('[data-hw-timer]'),
    steps: [...quiz.querySelectorAll('[data-hw-goto]')],
  };
  const feed = document.querySelector('[data-hw-feed]');
  const score = document.querySelector('[data-hw-score]');

  const TEXT = {
    hint: 'Tick every statement that is right — often more than one.',
    pickFirst: 'Tick at least one statement first.',
    next: 'Next question',
    finish: 'See your result',
    correct: 'Correct',
    missed: 'Missed',
    wrong: 'Wrong',
  };

  const state = {
    i: 0,
    picked: new Set(),
    checked: false,
    results: questions.map(() => null),
    finished: false,
  };
  const startedAt = Date.now();
  const touring = () => page.classList.contains('is-guide');
  const changed = () => quiz.dispatchEvent(new CustomEvent('hw:render'));

  function clock() {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  // Feed events carry the scene they are about; other events carry a small icon.
  function addEvent({ text, scene = null, verdict = null, icon = null, tone = '' }) {
    if (!feed) return;
    const item = document.createElement('li');
    item.className = 'hw-ev is-new';
    const art = document.createElement('span');
    art.className = 'hw-ev-art' + (icon ? ` is-icon ${tone}` : '');
    if (scene) {
      const img = document.createElement('img');
      img.src = `/static/home/wall/${scene}.webp`;
      img.alt = '';
      img.width = 320;
      img.height = 192;
      art.appendChild(img);
      if (verdict) {
        const badge = document.createElement('span');
        badge.className = 'hw-ev-badge' + (verdict === 'bad' ? ' is-bad' : '');
        badge.innerHTML = `<i class="fa-solid ${verdict === 'bad' ? 'fa-xmark' : 'fa-check'}" aria-hidden="true"></i>`;
        art.appendChild(badge);
      }
    } else if (icon) {
      art.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
    }
    const label = document.createElement('span');
    label.className = 'hw-ev-text';
    label.textContent = text;
    const time = document.createElement('span');
    time.className = 'hw-ev-time';
    time.textContent = clock();
    item.append(art, label, time);
    feed.prepend(item);
    while (feed.children.length > 6) feed.lastElementChild.remove();
  }

  function updateScore() {
    const right = state.results.filter((result) => result === true).length;
    if (score) score.textContent = `${right}/${questions.length}`;
    return right;
  }

  function statement(answer, n) {
    const picked = state.picked.has(n);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hw-st';
    button.setAttribute('aria-pressed', String(picked));
    button.innerHTML = '<span class="hw-st-box" aria-hidden="true"><i class="fa-solid fa-check"></i></span><span class="hw-st-text"></span><span class="hw-st-verdict"></span>';
    button.querySelector('.hw-st-text').textContent = answer.text;
    if (state.checked) {
      button.disabled = true;
      const verdict = button.querySelector('.hw-st-verdict');
      if (answer.correct && picked) {
        button.classList.add('is-right');
        verdict.textContent = TEXT.correct;
      } else if (answer.correct) {
        button.classList.add('is-missed');
        verdict.textContent = TEXT.missed;
      } else if (picked) {
        button.classList.add('is-wrong');
        verdict.textContent = TEXT.wrong;
      } else {
        button.classList.add('is-quiet');
      }
    } else {
      button.addEventListener('click', () => {
        if (state.picked.has(n)) state.picked.delete(n);
        else state.picked.add(n);
        button.setAttribute('aria-pressed', String(state.picked.has(n)));
        ui.hint.classList.remove('is-alert');
        ui.hint.textContent = TEXT.hint;
      });
    }
    return button;
  }

  function lightTile(scene) {
    tiles.forEach((tile, key) => tile.classList.toggle('is-lit', key === scene));
  }

  function render() {
    const q = questions[state.i];
    ui.index.textContent = String(state.i + 1);
    if (ui.image.getAttribute('src') !== q.image) ui.image.src = q.image;
    ui.image.alt = `Test scene for question ${state.i + 1}`;
    ui.text.textContent = q.text;
    ui.hint.classList.remove('is-alert');
    ui.hint.textContent = TEXT.hint;
    ui.list.replaceChildren(...q.answers.map(statement));
    ui.whyText.textContent = q.explanation;
    ui.why.hidden = !state.checked;
    ui.check.hidden = state.checked;
    ui.next.hidden = !state.checked;
    ui.next.firstChild.textContent = (state.i === questions.length - 1 ? TEXT.finish : TEXT.next) + ' ';
    ui.steps.forEach((button, n) => {
      if (n === state.i) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      button.classList.toggle('is-good', state.results[n] === true);
      button.classList.toggle('is-bad', state.results[n] === false);
    });
    lightTile(q.scene);
    changed();
  }

  function go(index) {
    state.i = index;
    state.picked = new Set();
    state.checked = false;
    state.finished = false;
    ui.summary.hidden = true;
    ui.body.hidden = false;
    render();
    update();
  }

  function describe(missed, wrong) {
    const parts = [];
    if (missed) parts.push(`${missed} missed`);
    if (wrong) parts.push(`${wrong} wrong`);
    return parts.join(', ');
  }

  ui.check.addEventListener('click', () => {
    if (!state.picked.size) {
      ui.hint.textContent = TEXT.pickFirst;
      ui.hint.classList.add('is-alert');
      return;
    }
    const q = questions[state.i];
    const missed = q.answers.filter((answer, n) => answer.correct && !state.picked.has(n)).length;
    const wrong = q.answers.filter((answer, n) => !answer.correct && state.picked.has(n)).length;
    const right = !missed && !wrong;
    state.checked = true;
    state.results[state.i] = right;
    render();
    const tile = tiles.get(q.scene);
    if (tile) {
      tile.classList.remove('is-good', 'is-bad');
      tile.classList.add(right ? 'is-good' : 'is-bad');
    }
    addEvent({
      text: right ? `Q${state.i + 1} · every statement right` : `Q${state.i + 1} · ${describe(missed, wrong)}`,
      scene: q.scene,
      verdict: right ? 'good' : 'bad',
    });
    updateScore();
    ui.next.focus({ preventScroll: touring() });
  });

  ui.next.addEventListener('click', () => {
    if (state.i < questions.length - 1) {
      go(state.i + 1);
      ui.text.setAttribute('tabindex', '-1');
      ui.text.focus({ preventScroll: true });
      return;
    }
    const right = updateScore();
    state.finished = true;
    ui.final.textContent = `${right}/${questions.length}`;
    ui.body.hidden = true;
    ui.summary.hidden = false;
    lightTile(null);
    addEvent({ text: `Sample finished · ${right} of ${questions.length} fully right`, icon: 'fa-flag-checkered', tone: 'is-done' });
    update();
    changed();
    ui.summary.querySelector('a').focus({ preventScroll: true });
  });

  ui.restart.addEventListener('click', () => {
    state.results = questions.map(() => null);
    tiles.forEach((tile) => tile.classList.remove('is-good', 'is-bad'));
    seconds = 25 * 60;
    renderTimer();
    updateScore();
    go(0);
  });

  ui.steps.forEach((button, n) => button.addEventListener('click', () => go(n)));

  // While the test window has focus: keys 1-4 tick statements, arrows left and right change question.
  quiz.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || page.classList.contains('is-guide')) return;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !ui.body.hidden) {
      const next = state.i + (event.key === 'ArrowRight' ? 1 : -1);
      if (next < 0 || next >= questions.length) return;
      event.preventDefault();
      go(next);
      ui.text.setAttribute('tabindex', '-1');
      ui.text.focus({ preventScroll: true });
      return;
    }
    if (state.checked) return;
    const target = ui.list.children[Number(event.key) - 1];
    if (target && !target.disabled) {
      event.preventDefault();
      target.click();
    }
  });

  // Ticking timer: paused while the hero is off screen, the tab is hidden or the sample is finished.
  let seconds = 25 * 60;
  let onScreen = true;
  let tick = null;
  function renderTimer() {
    if (ui.timer) ui.timer.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }
  function update() {
    const active = onScreen && !document.hidden && !state.finished;
    if (active && !tick && ui.timer) {
      tick = setInterval(() => {
        seconds = seconds > 0 ? seconds - 1 : 25 * 60;
        renderTimer();
      }, 1000);
    } else if (!active && tick) {
      clearInterval(tick);
      tick = null;
    }
  }
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', update);

  // Move the sample scenes into wall cells that nothing covers, nearest the test window, so the
  // lit scene is always in view on wide screens. Layout offsets are used, so the tour's transform
  // on the window does not affect the result.
  const originalOrder = wall ? [...wall.children] : [];
  const box = (node) => ({ left: node.offsetLeft, top: node.offsetTop, right: node.offsetLeft + node.offsetWidth, bottom: node.offsetTop + node.offsetHeight });
  function swapNodes(a, b) {
    const marker = document.createComment('');
    a.replaceWith(marker);
    b.replaceWith(a);
    marker.replaceWith(b);
  }
  function placeSampleScenes() {
    if (!wall || !hero) return;
    wall.replaceChildren(...originalOrder);
    if (!window.matchMedia('(min-width: 1281px)').matches) return;
    const heroBottom = hero.offsetHeight;
    const grow = { '.hw-window': Infinity, '.hw-feed': 220 };
    const blockers = ['.hw-intro-head', '.hw-intro-foot', '.hw-window', '.hw-feed']
      .map((selector) => [selector, hero.querySelector(selector)])
      .filter(([, node]) => node)
      .map(([selector, node]) => {
        const r = box(node);
        return { ...r, bottom: Math.min(r.bottom + (grow[selector] || 0), heroBottom) };
      });
    const windowRight = box(quiz).right;
    const gap = 10;
    const samples = questions.map((q) => tiles.get(q.scene)).filter(Boolean);
    const open = originalOrder
      .filter((tile) => !samples.includes(tile))
      .map((tile) => ({ tile, rect: box(tile) }))
      .filter(({ rect }) => rect.top >= 0 && rect.bottom <= heroBottom)
      .filter(({ rect }) => !blockers.some((b) => rect.left < b.right + gap && rect.right > b.left - gap && rect.top < b.bottom + gap && rect.bottom > b.top - gap))
      .sort((a, b) => Math.abs(a.rect.left - windowRight) - Math.abs(b.rect.left - windowRight) || a.rect.top - b.rect.top)
      .map(({ tile }) => tile);
    samples.forEach((sample, k) => {
      const target = open[k];
      if (target) swapNodes(sample, target);
    });
  }

  /* ── Guide (wide screens, motion welcome) ──
     Opened only with a "How it works" button. The real test window lifts out of the wall into the
     middle of the screen and plays one example question step by step, with a caption for each
     step. One wheel turn, swipe, arrow key or button press moves one step; Escape, the close
     button or a click outside ends it, and the last step hands the visitor back to the sample. */
  const tour = setupGuide();

  function setupGuide() {
    const caption = hero && hero.querySelector('.hw-caption');
    const captionBody = caption && caption.querySelector('.hw-caption-body');
    const nextLabel = caption && caption.querySelector('[data-hw-guide-next-label]');
    const rail = hero && hero.querySelector('.hw-rail');
    const heroIn = hero && hero.querySelector('.hw-hero-in');
    const list = document.querySelector('[data-hw-how]');
    const demo = quiz.querySelector('[data-hw-demo]');
    const nav = document.querySelector('.hw-nav');
    const openers = [...document.querySelectorAll('[data-hw-guide-open]')];
    if (!caption || !captionBody || !rail || !heroIn || !list || !demo || !openers.length) return null;

    const steps = [...list.children];
    const names = steps.map((item) => item.dataset.focus);
    const total = String(steps.length).padStart(2, '0');
    const fades = ['.hw-intro-head', '.hw-intro-foot', '.hw-feed'].map((selector) => hero.querySelector(selector)).filter(Boolean);
    const inDemo = (selector) => demo.querySelector(selector);
    const parts = [quiz.querySelector('.hw-win-bar'), quiz.querySelector('.hw-steps')]
      .concat(['.hw-shot', '.hw-q-text', '.hw-q-hint', '.hw-statements', '.hw-why', '.hw-win-actions'].map(inDemo))
      .filter(Boolean);
    const focusOf = {
      shot: '.hw-shot',
      statements: '.hw-statements',
      check: '.hw-statements',
      why: '.hw-why',
      scene: '.hw-shot',
      words: '.hw-q-text',
    };
    const able = window.matchMedia('(min-width: 1024px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)');
    const g = { open: false, step: -1, swap: 0, closing: 0, opener: null, wheelAt: 0, wheelUsed: false, wheelSum: 0, touchY: null };

    rail.replaceChildren(...steps.map((_, n) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.innerHTML = '<span></span>';
      button.addEventListener('click', () => setStep(n));
      return button;
    }));
    const bars = [...rail.children];

    function setAvailable() {
      const on = able.matches;
      page.classList.toggle('has-guide', on);
      if (!on && g.open) close(false);
      if (on && g.open) place();
    }

    // Move the window from its place in the hero to the free space right of the caption.
    function place() {
      const vh = window.innerHeight;
      const navH = nav ? nav.offsetHeight : 0;
      const heroTop = hero.getBoundingClientRect().top;
      const visTop = Math.max(0, navH - heroTop);
      const visH = vh - Math.max(navH, heroTop);
      const inX = heroIn.offsetLeft;
      const inW = heroIn.offsetWidth;
      const capW = Math.round(Math.min(380, Math.max(270, inW * 0.27)));
      const gap = Math.round(Math.max(28, inW * 0.03));
      const areaX = inX + capW + gap;
      const areaW = Math.min(inX + inW, hero.offsetWidth - 44) - areaX;
      const pad = 24;
      const nw = quiz.offsetWidth;
      const nh = quiz.offsetHeight;
      const scale = Math.max(0.6, Math.min(1.35, areaW / nw, (visH - pad * 2) / nh));
      const x = areaX + (areaW - nw * scale) / 2;
      const y = visTop + Math.max(pad, (visH - nh * scale) / 2);
      quiz.style.transform = `translate(${(x - quiz.offsetLeft).toFixed(1)}px, ${(y - quiz.offsetTop).toFixed(1)}px) scale(${scale.toFixed(4)})`;
      caption.style.left = `${inX}px`;
      caption.style.width = `${capW}px`;
      caption.style.top = `${visTop + visH / 2}px`;
      rail.style.top = `${visTop + visH / 2}px`;
    }

    function markParts(k) {
      parts.forEach((node) => node.classList.remove('is-tour-focus', 'is-tour-dim'));
      if (k < 0) return;
      const target = inDemo(focusOf[names[k]] || '.hw-shot');
      parts.forEach((node) => node.classList.add(node === target ? 'is-tour-focus' : 'is-tour-dim'));
    }

    function fillCaption(k) {
      captionBody.innerHTML = steps[k].innerHTML;
      captionBody.querySelectorAll('.hw-guide-open').forEach((node) => node.remove());
      const counter = captionBody.querySelector('.hw-how-n');
      if (counter) counter.insertAdjacentHTML('beforeend', `<span class="hw-how-of">/${total}</span>`);
      if (k === steps.length - 1) {
        captionBody.insertAdjacentHTML('beforeend', `<p class="hw-caption-end">That's the whole window. Now try the ${questions.length} sample questions yourself.</p>`);
      }
      captionBody.classList.remove('is-leaving', 'is-entering');
      void captionBody.offsetWidth;
      captionBody.classList.add('is-entering');
    }

    function setStep(k) {
      if (!g.open) return;
      if (k >= steps.length) return close(true);
      k = Math.max(0, k);
      g.step = k;
      clearTimeout(g.swap);
      bars.forEach((bar, n) => {
        bar.classList.toggle('is-on', n === k);
        bar.classList.toggle('is-done', n < k);
      });
      quiz.classList.add('is-demo');
      names.forEach((name, n) => demo.classList.toggle(`is-${name}`, n <= k));
      markParts(k);
      if (nextLabel) nextLabel.textContent = k === steps.length - 1 ? 'Try it yourself' : 'Next';
      if (!caption.classList.contains('is-on')) {
        fillCaption(k);
        caption.classList.add('is-on');
        return;
      }
      captionBody.classList.add('is-leaving');
      g.swap = setTimeout(() => fillCaption(k), 180);
    }

    function lock(on) {
      root.classList.toggle('hw-guide-lock', on);
      fades.forEach((node) => { node.inert = on; });
    }

    function open(opener) {
      if (g.open || !page.classList.contains('has-guide')) return;
      g.opener = opener || null;
      openers.forEach((button) => button.classList.remove('is-hint'));
      const start = () => {
        clearTimeout(g.closing);
        g.open = true;
        lock(true);
        page.classList.add('is-guide');
        quiz.classList.add('is-moving');
        place();
        setTimeout(() => {
          quiz.classList.remove('is-moving');
          setStep(0);
          caption.querySelector('.hw-caption-next')?.focus({ preventScroll: true });
        }, 420);
      };
      if (window.scrollY < 2) return start();
      // Bring the window back to the top of the page first.
      window.scrollTo({ top: 0 });
      let last = -1;
      let calm = 0;
      const wait = () => {
        const y = window.scrollY;
        calm = Math.abs(y - last) < 1 ? calm + 1 : 0;
        last = y;
        if (y < 2 || calm > 6) start();
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    }

    function close(toSample) {
      if (!g.open) return;
      g.open = false;
      g.step = -1;
      clearTimeout(g.swap);
      lock(false);
      caption.classList.remove('is-on');
      bars.forEach((bar) => bar.classList.remove('is-on', 'is-done'));
      quiz.classList.remove('is-demo');
      names.forEach((name) => demo.classList.remove(`is-${name}`));
      markParts(-1);
      page.classList.remove('is-guide');
      quiz.style.transform = '';
      g.closing = setTimeout(() => {
        if (toSample) {
          const first = ui.list.querySelector('.hw-st') || ui.check;
          first?.focus({ preventScroll: true });
        } else {
          g.opener?.focus({ preventScroll: true });
        }
      }, 450);
    }

    openers.forEach((button) => button.addEventListener('click', () => open(button)));
    caption.querySelector('[data-hw-guide-close]')?.addEventListener('click', () => close(false));
    caption.querySelectorAll('[data-hw-guide-step]').forEach((button) => button.addEventListener('click', () => {
      setStep(g.step + Number(button.dataset.hwGuideStep));
    }));
    hero.querySelector('.hw-veil')?.addEventListener('click', () => close(false));

    // One wheel gesture moves one step: the first notch counts, the rest of the same flick waits
    // for a short pause before the next step can start.
    window.addEventListener('wheel', (event) => {
      if (!g.open) return;
      event.preventDefault();
      const now = performance.now();
      if (now - g.wheelAt > 260) {
        g.wheelUsed = false;
        g.wheelSum = 0;
      }
      g.wheelAt = now;
      if (g.wheelUsed) return;
      g.wheelSum += event.deltaY || event.deltaX;
      if (Math.abs(g.wheelSum) < 24) return;
      g.wheelUsed = true;
      setStep(g.step + (g.wheelSum > 0 ? 1 : -1));
    }, { passive: false });
    window.addEventListener('touchstart', (event) => {
      if (g.open) g.touchY = event.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchend', (event) => {
      if (!g.open || g.touchY === null) return;
      const dy = g.touchY - event.changedTouches[0].clientY;
      g.touchY = null;
      if (Math.abs(dy) > 40) setStep(g.step + (dy > 0 ? 1 : -1));
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (!g.open || event.altKey || event.ctrlKey || event.metaKey) return;
      const forward = ['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key);
      const back = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key);
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setStep(event.key === 'Home' ? 0 : steps.length - 1);
      } else if (forward || back) {
        if (event.key === ' ' && event.target.closest && event.target.closest('button, a')) return;
        event.preventDefault();
        setStep(g.step + (forward ? 1 : -1));
      }
    });

    // Anything else on the page closes the guide first.
    document.addEventListener('click', (event) => {
      if (!g.open) return;
      if (event.target.closest('.hw-caption, .hw-window, .hw-rail, [data-hw-guide-open]')) return;
      close(false);
    }, true);

    if ('ResizeObserver' in window) new ResizeObserver(() => { if (g.open) place(); }).observe(quiz);
    able.addEventListener?.('change', setAvailable);

    return { sync: () => (g.open ? place() : setAvailable()) };
  }

  function layout() {
    if (tour) tour.sync();
    placeSampleScenes();
  }
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  render();
  layout();
  // After layout, so the wall switches on outward from where the window really is.
  if (motion && page) setupReveal();
  update();
})();
