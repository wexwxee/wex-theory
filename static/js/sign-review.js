(function (root) {
  const DAY = 86400000;
  const INTERVALS = [0, 1, 3, 7, 14, 30];
  function dueAt(entry, reviewedAt) {
    if (!entry || !Number.isInteger(entry.box) || entry.box <= 0) return 0;
    const time = typeof reviewedAt === 'number' ? reviewedAt : Date.parse(reviewedAt || '');
    if (!Number.isFinite(time)) return 0;
    return time + INTERVALS[Math.min(entry.box, 5)] * DAY;
  }
  function isDue(entry, reviewedAt, now = Date.now()) {
    return Boolean(entry) && dueAt(entry, reviewedAt) <= now;
  }
  function grade(previous, reviewedAt, right, mode, now = Date.now()) {
    const box = Number.isInteger(previous?.box) ? Math.max(0, Math.min(previous.box, 5)) : 0;
    if (!right) return {entry:{box:0}, reviewedAt:now, changed:true};
    // Self-assessment introduces a sign. It cannot advance an existing review level.
    if ((mode === 'cards' && box > 0) || (box > 0 && !isDue(previous, reviewedAt, now))) {
      return {entry:{box}, reviewedAt, changed:false};
    }
    return {entry:{box:Math.min(box + 1, 5)}, reviewedAt:now, changed:true};
  }
  const api = {dueAt, isDue, grade};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WEXSignReview = api;
})(typeof window === 'undefined' ? globalThis : window);
