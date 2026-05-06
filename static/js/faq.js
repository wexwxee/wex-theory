(function () {
  const faqs = [
    {
      group: 'Access',
      q: 'What is included in full access?',
      a: 'Full access includes all 13 structured practice tests, 325 photo questions, explanations after each test, saved questions, progress history, support messages, and the Exam Words 2026 vocabulary helper.'
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
      group: 'Account',
      q: 'Do I need an account?',
      a: 'You do not need an account for Starter Test 0. You need an account for the main library, saved progress, support chat, certificates, and full Exam Words access.'
    },
    {
      group: 'Progress',
      q: 'Does progress save after I close the site?',
      a: 'Account test history and saved questions are stored with your account. Exam Words progress is saved in the same browser using local storage, so known and difficult terms stay after refresh, sleep, and reopening the site on that device.'
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
      a: 'Yes. Use the contact page for account deletion or privacy requests. Browser-only Exam Words progress can also be cleared by clearing local site storage in your browser.'
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
