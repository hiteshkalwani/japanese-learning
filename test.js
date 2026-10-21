// Run: node test.js  — checks lesson data shape and the spaced-repetition logic.
const assert = require('assert');
const fs = require('fs');
global.window = {};

const files = fs.readdirSync(`${__dirname}/lessons`).filter(f => f.endsWith('.js'));
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
for (const f of files) {
  require(`./lessons/${f}`);
  assert(html.includes(`lessons/${f}`), `${f} is missing a <script> tag in index.html`);
}

for (const f of fs.readdirSync(`${__dirname}/kanji`).filter(f => f.endsWith('.js'))) {
  require(`./kanji/${f}`);
  assert(html.includes(`kanji/${f}`), `kanji/${f} is missing a <script> tag in index.html`);
}
const levels = new Set();
for (const lv of window.KANJI) {
  assert(/^N[1-5]$/.test(lv.level) && !levels.has(lv.level), `bad or duplicate kanji level ${lv.level}`);
  levels.add(lv.level);
  const seen = new Set();
  for (const [char, meaning, on, kun, examples] of lv.kanji) {
    assert(char && meaning && (on || kun), `${lv.level}: incomplete kanji ${char}`);
    assert(!seen.has(char), `${lv.level}: duplicate kanji ${char}`);
    seen.add(char);
    assert(examples.length && examples.every(e => e.length === 3 && e[0].includes(char) && e[1] && e[2]),
      `${lv.level}: bad example for ${char} (each needs [word containing the kanji, reading, meaning])`);
  }
}

const ids = new Set();
for (const l of window.LESSONS) {
  assert(!ids.has(l.id), `duplicate lesson id ${l.id}`);
  ids.add(l.id);
  assert(l.title && l.vocab.length && l.grammar.length, `lesson ${l.id} is incomplete`);
  const seen = new Set();
  for (const w of l.vocab) {
    assert(w.length === 3 && w[0] && typeof w[1] === 'string' && w[2], `lesson ${l.id}: bad word ${JSON.stringify(w)}`);
    assert(!seen.has(w[0]), `lesson ${l.id}: duplicate word ${w[0]}`);
    seen.add(w[0]);
  }
  for (const g of l.grammar) {
    assert(g.pattern && g.note && g.examples.length, `lesson ${l.id}: incomplete grammar ${g.pattern}`);
    g.examples.forEach(e => assert(e.length === 2 && e[0] && e[1], `lesson ${l.id}: bad example in ${g.pattern}`));
  }
  assert(l.quiz?.length, `lesson ${l.id} has no grammar quiz`);
  for (const [s, a, wrong, en] of l.quiz) {
    assert(s.includes('＿') && a && en, `lesson ${l.id}: bad quiz item ${s}`);
    assert(wrong.length === 3 && !wrong.includes(a) && new Set(wrong).size === 3, `lesson ${l.id}: bad wrong answers for ${s}`);
  }
}

const { review, isDue, quizOptions, pickWeighted, DAY } = require('./srs.js');
const count = (qs, k) => qs.filter(q => q === k).length;
const sections = { a: ['a'], b: ['b'], c: [] };
let picked = pickWeighted(sections, { a: 70, b: 30, c: 50 }, 200);
assert.strictEqual(picked.length, 200);
assert.strictEqual(count(picked, 'a'), 140, 'empty section c share is redistributed by weight');
picked = pickWeighted({ a: [1, 2, 3, 4], b: [5] }, { a: 50, b: 50 }, 16);
assert.deepStrictEqual(picked.filter(x => x <= 4).sort(), [1, 1, 2, 2, 3, 3, 4, 4], 'repeats only after using every question');
assert.strictEqual(pickWeighted({ a: [1] }, { a: 1 }, 10).length, 10);
assert.strictEqual(pickWeighted({}, { a: 1 }, 10).length, 0);
let c = review(undefined, true, 0);
assert.deepStrictEqual(c, { box: 1, due: DAY });
c = review(c, true, 0);
assert.deepStrictEqual(c, { box: 2, due: 3 * DAY });
c = review(c, false, 0);
assert.deepStrictEqual(c, { box: 0, due: 0 });
for (let i = 0; i < 10; i++) c = review(c, true, 0);
assert.strictEqual(c.box, 5, 'box caps at the last interval');
assert(isDue(undefined) && isDue({ due: 0 }, 0) && !isDue({ due: DAY }, 0));

const opts = quizOptions('a', ['a', 'b', 'b', 'c', 'd', 'e']);
assert.strictEqual(opts.length, 4);
assert(opts.includes('a'));
assert.strictEqual(new Set(opts).size, 4, 'options are distinct');

const { dayKey, streak, pieces, starQuestion, jlptScore } = require('./srs.js');
assert.deepStrictEqual(pieces('わたしは マイク・ミラーです。'), ['わたし', 'は', 'マイク・ミラーです']);
assert.deepStrictEqual(pieces('（hint）これを ください。'), ['これ', 'を', 'ください']);
const today = new Date(2026, 9, 21), back = n => dayKey(new Date(2026, 9, 21 - n));
assert.strictEqual(dayKey(today), '2026-10-21');
assert.strictEqual(streak({ [back(0)]: {}, [back(1)]: {}, [back(3)]: {} }, today), 2);
assert.strictEqual(streak({ [back(1)]: {}, [back(2)]: {} }, today), 2, 'streak survives until you study today');
assert.strictEqual(streak({ [back(2)]: {} }, today), 0);

assert.deepStrictEqual(starQuestion('ミラーさんは IMCの しゃいんです。'),
  { prompt: '＿＿ ＿＿ ★ ＿＿。', answer: 'IMCの', choices: ['ミラーさん', 'は', 'IMCの', 'しゃいんです'] });
assert.strictEqual(starQuestion('これは じしょです。'), null, 'too short');
assert.strictEqual(starQuestion('ミラーさんは せんせいです。グプタさんも せんせいです。'), null, 'two sentences');
for (const l of window.LESSONS) for (const g of l.grammar) for (const [jp] of g.examples) {
  const q = starQuestion(jp);
  if (q) assert(q.prompt.includes('★') && q.choices.includes(q.answer) && new Set(q.choices).size === 4, jp);
}

assert.deepStrictEqual(jlptScore(0.5, 0.5), { lang: 60, listen: 30, total: 90, max: 180, pass: true });
assert.strictEqual(jlptScore(0.3, 1).pass, false, 'language part under 38');
assert.strictEqual(jlptScore(0.9, 0.3).pass, false, 'listening part under 19');
assert.strictEqual(jlptScore(0.5, null).pass, true);
assert.strictEqual(jlptScore(0.4, null).pass, false, '48/120 is under the scaled pass mark');

console.log(`ok: ${window.LESSONS.length} lessons, ${window.LESSONS.reduce((n, l) => n + l.vocab.length, 0)} words`);
