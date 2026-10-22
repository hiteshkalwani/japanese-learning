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

// Local calendar date as YYYY-MM-DD ('sv' locale formats dates that way).
const dayKey = (d = new Date()) => d.toLocaleDateString('sv');

// Consecutive active days ending today, or yesterday so a streak survives until you study today.
function streak(log, now = new Date()) {
  let n = 0;
  const d = new Date(now);
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// Split a spaced sentence into phrase pieces; the particles は/を/も become pieces of their own.
const pieces = sentence => sentence.replace(/（[^）]*）/g, '').trim().replace(/[。？]$/, '')
  .split(/\s+/).flatMap(t => /^.+[はをも]$/.test(t) ? [t.slice(0, -1), t.slice(-1)] : [t]);

// JLPT 並べ替え: hide 4 pieces in a row; the answer is the one in the ★ slot (3rd).
function starQuestion(sentence) {
  const s = sentence.split('…')[0].replace(/（[^）]*）/g, '').trim();
  if (/。.|＝|→/.test(s)) return null; // two sentences, or a number/conjugation drill
  const parts = pieces(s);
  if (parts.length < 4) return null;
  const at = Math.floor(Math.random() * (parts.length - 3)), hidden = parts.slice(at, at + 4);
  if (new Set(hidden).size < 4) return null;
  const shown = [...parts.slice(0, at), '＿＿', '＿＿', '★', '＿＿', ...parts.slice(at + 4)];
  return { prompt: shown.join(' ') + '。', answer: hidden[2], choices: hidden };
}

// JLPT N5 scale: language knowledge 0–120 (min 38) + listening 0–60 (min 19); pass needs 80 of 180.
// Without listening (browser can't speak) the 80 pass mark is scaled to the 120 available.
function jlptScore(langRatio, listenRatio) {
  const lang = Math.round(120 * langRatio), listen = listenRatio == null ? null : Math.round(60 * listenRatio);
  const total = lang + (listen ?? 0), max = listen == null ? 120 : 180;
  return { lang, listen, total, max, pass: lang >= 38 && (listen == null || listen >= 19) && total >= 80 * max / 180 };
}

if (typeof module !== 'undefined') module.exports = { review, isDue, shuffle, quizOptions, pickWeighted, dayKey, streak, pieces, starQuestion, jlptScore, DAY };
