(function () {
  const faqs = [
    {
      group: 'Access',
      q: 'What is included in full access?',
      a: 'Full access includes all 13 structured practice tests, 325 photo questions, explanations after each test, saved questions, progress history, support messages, Test 14 Exam Mode, and the Exam Words 2026 vocabulary helper.'
    },
    {
      group: 'Demo',
      q: 'Can I try the platform before full access?',
      a: 'Yes. Starter Test 0 works without registration. You can also open the <a href="/exam-words-demo">Exam Words demo</a> to see how the dictionary, cards, quiz, and audio feel before unlocking the full tool.'
    },
    {
      group: 'Tests',
      q: 'How many questions are in each test?',
      a: 'Each practice test contains 25 questions. The study target is at least 20 correct answers out of 25.'
    },
    {
      group: 'Tests',
      q: 'What is Test 14 / Exam Mode?',
      a: 'Test 14 is an extra mixed practice mode. Each attempt gives you 25 random questions from across the full practice library, so the questions change every time and appear in a mixed order.'
    },
    {
      group: 'Exam rules',
      q: 'Did the theory test change with the 2026 reform?',
      a: 'No. The test is still 25 questions in 25 minutes with a maximum of five mistakes. What changed on 1 July 2026 is the driving education around it: five modules, theory before the matching practice, and new subjects such as electric cars and driver assistance systems. See <a href="/rules-2026">what changed in 2026</a>.'
    },
    {
      group: 'Exam rules',
      q: 'Which language can I take the theory test in?',
      a: 'Danish, English, Faroese, Greenlandic or German. Interpreters have not been allowed since 1 January 2025, and the digital theory test runs in Danish, English and German with audio. More on <a href="/exam-language">the test language page</a>.'
    },
    {
      group: 'Exam rules',
      q: 'What is the difference between the paper and the digital theory test?',
      a: 'The paper test uses real photographs and yes/no answers, and you go straight through it. The digital test uses computer-generated scenes, you pick the correct answer or answers, you can move back and forth and flag questions, and the result appears on screen at once. Both are 25 questions in 25 minutes. See <a href="/exam-day">test day</a>.'
    },
    {
      group: 'Account',
      q: 'Do I need an account?',
      a: 'You do not need an account for Starter Test 0. You need an account for the main library, saved progress, support chat, certificates, and full Exam Words access.'
    },
    {
      group: 'Progress',
      q: 'Does progress save after I close the site?',
      a: 'Account test history, saved questions, and full Exam Words known/difficult progress are stored with your account. Demo progress can still stay only in the current browser.'
    },
    {
      group: 'Exam Words',
      q: 'What is Exam Words 2026?',
      a: 'It is a separate vocabulary helper for driving theory terms. It includes English-first terms, Russian translations, Danish reference words, category filters, flashcards, quiz mode, saved progress, and audio playback.'
    },
    {
      group: 'Audio',
      q: 'Why do I see different audio voices on different devices?',
      a: 'The voice list comes from your browser and operating system. Some phones or browsers include only a few voices, while desktop browsers can show more. Installing extra system voices can add more options.'
    },
    {
      group: 'Audio',
      q: 'Can I change the voice or accent?',
      a: 'Yes. Use the audio voice picker on supported pages. English study voices are recommended for question and vocabulary playback, while other available browser voices can still be tested when your device provides them.'
    },
    {
      group: 'Review',
      q: 'Can I review questions after a test?',
      a: 'Yes. After finishing a test, you can review your answers, correct answers, explanations, and the questions you saved from that attempt.'
    },
    {
      group: 'Support',
      q: 'What if verification email or access does not work?',
      a: 'Check spam or promotions first. If it still does not arrive, request a new code or contact support. For access problems, include the email used for the account and a screenshot if possible.'
    },
    {
      group: 'Certificate',
      q: 'How does certificate verification work?',
      a: 'A certificate can be checked with its serial number and security code. The Verify Certificate page explains what to enter if the QR scan opens without automatic verification.'
    },
    {
      group: 'Privacy',
      q: 'Can I request deletion of my data?',
      a: 'Yes. Use the contact page for account deletion or privacy requests. Full Exam Words progress is part of your account data; demo-only browser progress can be cleared by clearing local site storage.'
    }
  ];

  function toggleAccordion(idx) {
    const body = document.getElementById(`abody-${idx}`);
    const btn = document.getElementById(`abtn-${idx}`);
    if (!body || !btn) return;
    const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';

    faqs.forEach((_, i) => {
      const nextBody = document.getElementById(`abody-${i}`);
      const nextBtn = document.getElementById(`abtn-${i}`);
      if (nextBody) nextBody.style.maxHeight = '0px';
      nextBtn?.classList.remove('open');
    });

    if (!isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      btn.classList.add('open');
    }
  }

  document.getElementById('faqBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const list = document.getElementById('faqList');
  if (!list) return;

  faqs.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'accordion-item';
    div.innerHTML = `
      <button class="accordion-btn" id="abtn-${i}" aria-expanded="false" type="button">
        <span>
          <span class="accordion-kicker">${item.group}</span>
          <span>${item.q}</span>
        </span>
        <span class="accordion-icon" id="aicon-${i}" aria-hidden="true">+</span>
      </button>
      <div class="accordion-body" id="abody-${i}">
        <div class="accordion-body-inner">${item.a}</div>
      </div>
    `;
    list.appendChild(div);
    div.querySelector('.accordion-btn')?.addEventListener('click', () => {
      toggleAccordion(i);
      const button = document.getElementById(`abtn-${i}`);
      button?.setAttribute('aria-expanded', button.classList.contains('open') ? 'true' : 'false');
    });
  });

  toggleAccordion(0);
  document.getElementById('abtn-0')?.setAttribute('aria-expanded', 'true');
})();
