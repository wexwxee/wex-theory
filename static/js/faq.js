(function () {
  const faqs = [
    {
      q: 'What is included in full access?',
      a: 'Full access includes all 13 practice tests, 325 questions, explanations after the test, saved questions, and your progress history.'
    },
    {
      q: 'How many questions are in each test?',
      a: 'Each test contains 25 questions. You need at least 20 correct answers to pass.'
    },
    {
      q: 'Do I need an account?',
      a: 'You do not need an account for Test 1. You need an account for premium tests, saved progress, and support messages.'
    },
    {
      q: 'What is free?',
      a: 'Test 1 is free and can be opened without registration. Premium access is needed for Tests 2 to 13.'
    },
    {
      q: 'How does the subscription work?',
      a: 'Full access is activated for a fixed access period. When that period ends, premium tests lock again until you renew.'
    },
    {
      q: 'What if the verification email does not arrive?',
      a: 'Check spam or promotions first. If it still does not arrive, request a new code or contact support.'
    },
    {
      q: 'Does WEXTheory work on a phone?',
      a: 'Yes. The site is designed to work on mobile, tablet, and desktop.'
    },
    {
      q: 'Can I review questions after a test?',
      a: 'Yes. After finishing a test, you can review your answers, correct answers, explanations, and your saved questions from that attempt.'
    }
  ];

  function toggleAccordion(idx) {
    const body = document.getElementById(`abody-${idx}`);
    const btn = document.getElementById(`abtn-${idx}`);
    const icon = document.getElementById(`aicon-${idx}`);
    const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
    faqs.forEach((_, i) => {
      document.getElementById(`abody-${i}`).style.maxHeight = '0px';
      document.getElementById(`abtn-${i}`).classList.remove('open');
      document.getElementById(`aicon-${i}`).style.transform = 'rotate(0)';
    });
    if (!isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      btn.classList.add('open');
      icon.style.transform = 'rotate(45deg)';
    }
  }

  document.getElementById('faqBurgerBtn')?.addEventListener('click', sbOpen);
  document.getElementById('navThemeBtn')?.addEventListener('click', toggleTheme);

  const list = document.getElementById('faqList');
  faqs.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'accordion-item';
    div.innerHTML = `
      <button class="accordion-btn" id="abtn-${i}">
        <span>${item.q}</span>
        <span class="accordion-icon" id="aicon-${i}">+</span>
      </button>
      <div class="accordion-body" id="abody-${i}">
        <div class="accordion-body-inner">${item.a}</div>
      </div>
    `;
    list.appendChild(div);
    div.querySelector('.accordion-btn')?.addEventListener('click', () => toggleAccordion(i));
  });
})();
