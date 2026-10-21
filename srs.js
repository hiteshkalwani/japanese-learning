// Leitner spaced repetition: a card in box n comes back INTERVALS[n] days after its last review.
const INTERVALS = [0, 1, 3, 7, 14, 30];
const DAY = 864e5;

function review(card = { box: 0 }, correct, now = Date.now()) {
  const box = correct ? Math.min(card.box + 1, INTERVALS.length - 1) : 0;
  return { box, due: now + INTERVALS[box] * DAY };
}

const isDue = (card, now = Date.now()) => !card || card.due <= now;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function quizOptions(answer, pool, n = 4) {
  const wrong = shuffle([...new Set(pool)].filter(x => x !== answer)).slice(0, n - 1);
  return shuffle([answer, ...wrong]);
}

// Each section gets its fixed share of n (empty sections' share goes to the rest).
// Questions within a section are random and only repeat once that section is used up.
function pickWeighted(sections, weights, n) {
  const names = Object.keys(weights).filter(k => sections[k]?.length);
  const sum = names.reduce((s, k) => s + weights[k], 0);
  const counts = names.map(k => Math.floor(n * weights[k] / sum));
  for (let i = 0; names.length && counts.reduce((a, b) => a + b, 0) < n; i++) counts[i % names.length]++;
  return shuffle(names.flatMap((k, i) => {
    const out = [];
    while (out.length < counts[i]) out.push(...shuffle([...sections[k]]));
    return out.slice(0, counts[i]);
  }));
}

if (typeof module !== 'undefined') module.exports = { review, isDue, shuffle, quizOptions, pickWeighted, DAY };
