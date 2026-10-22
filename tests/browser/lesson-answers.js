// Answer one lesson situation the way a learner does. Exam-style situations: tick the true
// statements, then press Check answer. Older single-choice questions: press one option.
// right=false gives a deliberately wrong answer (first statement judged the wrong way round).
async function answerSituation(page, question, right = true) {
  if (question.kind === 'statements') {
    const rows = page.locator('.lesson-statement');
    for (let i = 0; i < question.statements.length; i++) {
      const truth = question.statements[i].correct;
      if (right || i > 0 ? truth : !truth) await rows.nth(i).click();
    }
    await page.locator('#lessonCheck').click();
    return;
  }
  const index = right ? question.correct : (question.correct + 1) % question.options.length;
  await page.locator(`.lesson-option[data-answer="${index}"]`).click();
}

// What a stored check holds for a right or wrong answer to this question.
function answerValue(question, right = true) {
  if (question.kind === 'statements') return right ? question.correct : question.correct ^ 1;
  return right ? question.correct : (question.correct + 1) % question.options.length;
}

// How many answer controls a situation shows.
function answerCount(question) {
  return question.kind === 'statements' ? question.statements.length : question.options.length;
}

module.exports = { answerSituation, answerValue, answerCount };
