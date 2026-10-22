const lessons = (window.LESSONS || []).sort((a, b) => a.id - b.id);
const levels = (window.KANJI || []).sort((a, b) => b.level.localeCompare(a.level)); // N5 first
// Lesson files store vocab as [kana, kanji, english] tuples for easy authoring.
lessons.forEach(l => l.vocab = l.vocab.map(([kana, kanji, en]) => ({ id: `${l.id}:${kana}`, kana, kanji, en })));
// Kanji files store [kanji, meaning, on, kun, examples]; front/reading/say let them reuse the flashcards.
levels.forEach(lv => lv.kanji = lv.kanji.map(([char, meaning, on, kun, examples]) => ({
  id: `kanji:${char}`, char, meaning, on, kun, examples,
  front: char, reading: `音 ${on || '—'}　訓 ${kun || '—'}`, en: meaning, say: examples[0][1],
})));
const allCards = () => [...lessons.flatMap(l => l.vocab), ...levels.flatMap(lv => lv.kanji)];
const merge = ls => ({ vocab: ls.flatMap(l => l.vocab), grammar: ls.flatMap(l => l.grammar), quiz: ls.flatMap(l => l.quiz) });

const app = document.getElementById('app');
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const store = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
let progress = load('jlpt-progress', {}); // card id -> { box, due }
const log = load('jlpt-log', {});         // 'YYYY-MM-DD' -> { reviews, answered, correct }
const exams = load('jlpt-exams', []);     // [{ date, total, max, pass }]
const save = () => store('jlpt-progress', progress);
let timer;

function track(kind, correct) {
  const d = log[dayKey()] ||= { reviews: 0, answered: 0, correct: 0 };
  d[kind]++;
  if (correct) d.correct++;
  store('jlpt-log', log);
}

const dueWords = words => words.filter(w => isDue(progress[w.id]));
// Learned = "Got it" twice in a row, so one lucky click doesn't count.
const learned = words => words.filter(w => progress[w.id]?.box >= 2).length;
const say = text => `<button class="say" data-say="${text}" aria-label="Play audio">🔊</button>`;

function speak(text) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text.replace(/[～\[\]]/g, ''));
  u.lang = 'ja-JP';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.preventDefault(); speak(b.dataset.say); }
});

// Chapter picker shared by Quiz, Flashcards and Exam; the selection is kept while you move between pages.
const chosen = new Set([...lessons.map(l => String(l.id)), ...levels.map(lv => lv.level)]);
const lessonItems = () => lessons.map(l => [String(l.id), `第${l.id}課 ${l.title}`]);
const picker = (items, legend = 'Chapters') => `<fieldset class="picker"><legend>${legend}</legend>${items.map(([v, label]) =>
  `<label><input type="checkbox" value="${v}" ${chosen.has(v) ? 'checked' : ''}> ${label}</label>`).join('')}</fieldset>`;
const pickedLessons = () => lessons.filter(l => chosen.has(String(l.id)));
document.addEventListener('change', e => {
  if (e.target.closest('.picker')) chosen[e.target.checked ? 'add' : 'delete'](e.target.value);
});

const NAV = { lesson: 'chapters' }; // sub-pages that light up a different navbar item
function route() {
  const [, view = '', id, tab] = location.hash.split('/');
  clearInterval(timer);
  window.scrollTo(0, 0);
  document.querySelectorAll('.top a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#/${NAV[view] ?? view}`));
  const lesson = view === 'lesson' && lessons.find(l => String(l.id) === id);
  const level = view === 'kanji' && levels.find(lv => lv.level === id);
  if (lesson) return renderLesson(lesson, tab);
  if (level) return renderKanji(level, tab);
  if (view === 'practice') return renderPractice(id);
  const pages = { chapters: renderChapters, quiz: renderQuizPage, cards: renderCardsPage, kanji: renderLevels, exam: renderExamPage };
  (pages[view] || renderDashboard)();
}
window.addEventListener('hashchange', route);

// Page shell: title and optional tab bar. Returns the element the page renders into.
function shell(title, base = '', tabs = {}, tab = '') {
  app.innerHTML = `
    <h1>${title}</h1>
    ${Object.keys(tabs).length ? `<nav class="tabs">${Object.entries(tabs).map(([k, v]) =>
      `<a href="${base}/${k}" class="${k === tab ? 'active' : ''}">${v}</a>`).join('')}</nav>` : ''}
    <section id="view"></section>`;
  return document.getElementById('view');
}

const tile = (href, num, title, items, unit, extra = '') => `
  <a class="lesson" href="${href}">
    <span class="num">${num}</span>
    <strong>${title}</strong>
    <small class="muted">${items.length} ${unit}${extra} · ${dueWords(items).length} due</small>
    <span class="bar"><i style="width:${100 * learned(items) / items.length}%"></i></span>
  </a>`;

const progressRow = (href, label, items) => {
  const n = learned(items);
  return `<a class="row" href="${href}" title="${label}: ${n} of ${items.length} learned">
    <span>${label}</span>
    <span class="track"><i style="width:${100 * n / items.length}%"></i></span>
    <span>${n === items.length ? '✓ Completed' : `${n}/${items.length}`}</span>
  </a>`;
};

function renderDashboard() {
  const all = allCards(), today = log[dayKey()] || { reviews: 0, answered: 0, correct: 0 };
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const d = log[dayKey(date)] || {};
    return { date, reviews: d.reviews || 0, answered: d.answered || 0, n: (d.reviews || 0) + (d.answered || 0) };
  });
  const max = Math.max(1, ...days.map(d => d.n));
  const done = lessons.filter(l => learned(l.vocab) === l.vocab.length).length;
  shell('Dashboard').innerHTML = `
    <div class="stats">
      <div class="stat"><b>${today.reviews}</b><small class="muted">cards reviewed today</small></div>
      <div class="stat"><b>${today.answered}</b><small class="muted">questions today${today.answered ? ` · ${Math.round(100 * today.correct / today.answered)}% right` : ''}</small></div>
      <div class="stat"><b>${streak(log)}</b><small class="muted">day streak</small></div>
      <div class="stat"><b>${done} / ${lessons.length}</b><small class="muted">chapters completed</small></div>
    </div>
    <a class="btn primary" href="#/cards">Review ${dueWords(all).length} due cards</a>

    <h2>Last 14 days</h2>
    <p class="muted">Cards reviewed plus questions answered each day</p>
    <div class="days">${days.map((d, i) => `
      <div class="day" title="${dayKey(d.date)}: ${d.reviews} cards, ${d.answered} questions">
        <span class="col"><i style="height:${100 * d.n / max}%"></i></span>
        <small>${i === 13 ? 'today' : d.date.getDate()}</small>
      </div>`).join('')}
    </div>

    <h2>Chapters</h2>
    <p class="muted">A chapter is completed when every word is learned ("Got it" twice in a row in flashcards).</p>
    <div class="chart">${lessons.map(l => progressRow(`#/lesson/${l.id}`, `第${l.id}課 ${l.title}`, l.vocab)).join('')}</div>

    <h2>Kanji</h2>
    <div class="chart">${levels.map(lv => progressRow(`#/kanji/${lv.level}`, `${lv.level} kanji`, lv.kanji)).join('')}</div>

    ${exams.length ? `<h2>Recent exams</h2>
    <ul>${exams.slice(-5).reverse().map(e => `<li>${e.date}: ${e.total}/${e.max} · ${e.pass ? '✓ 合格 pass' : '✗ not yet'}</li>`).join('')}</ul>` : ''}`;
}

function renderChapters() {
  shell('Chapters').innerHTML = `<div class="grid">${lessons.map(l =>
    tile(`#/lesson/${l.id}`, `第${l.id}課`, l.title, l.vocab, 'words', ` · ${l.grammar.length} grammar points`)).join('')}</div>`;
}

function renderLevels() {
  shell('Kanji').innerHTML = `<div class="grid">${levels.map(lv =>
    tile(`#/kanji/${lv.level}`, `JLPT ${lv.level}`, `${lv.level} kanji`, lv.kanji, 'kanji')).join('')}</div>`;
}

function renderLesson(l, tab) {
  const tabs = { vocab: 'Vocabulary', cards: 'Flashcards', quiz: 'Quiz', grammar: 'Grammar' };
  if (!tabs[tab]) tab = 'vocab';
  const view = shell(`第${l.id}課 · ${l.title}`, `#/lesson/${l.id}`, tabs, tab);
  if (tab === 'vocab') renderVocab(view, l.vocab);
  if (tab === 'cards') renderCards(view, l.vocab);
  if (tab === 'grammar') renderGrammar(view, l);
  if (tab === 'quiz') startQuiz(view, LESSON_MIX, () => ({ sections: lessonSections(l), tips: lessonTips([l]) }));
}

function renderKanji(lv, tab) {
  const tabs = { list: 'Kanji list', cards: 'Flashcards', quiz: 'Quiz' };
  if (!tabs[tab]) tab = 'list';
  const view = shell(`JLPT ${lv.level} Kanji`, `#/kanji/${lv.level}`, tabs, tab);
  if (tab === 'list') renderKanjiList(view, lv.kanji);
  if (tab === 'cards') renderCards(view, lv.kanji);
  if (tab === 'quiz') startQuiz(view, KANJI_MIX, () => ({ sections: kanjiSections(lv.kanji), tips: kanjiTips(lv) }));
}

function renderQuizPage() {
  const view = shell('Quiz');
  startQuiz(view, LESSON_MIX, () => {
    const ls = pickedLessons();
    if (!ls.length) return alert('Choose at least one chapter.');
    return { sections: lessonSections(merge(ls)), tips: lessonTips(ls) };
  }, picker(lessonItems()));
}

function renderCardsPage() {
  const view = shell('Flashcards');
  const items = [
    ...lessons.map(l => [String(l.id), `第${l.id}課 ${l.title}`, l.vocab]),
    ...levels.map(lv => [lv.level, `${lv.level} kanji`, lv.kanji]),
  ];
  view.innerHTML = `${picker(items.map(([v, label, cards]) => [v, `${label} <small class="muted">${dueWords(cards).length} due</small>`]))}
    <button class="btn primary wide">Start reviewing</button>`;
  view.querySelector('.btn').onclick = () => {
    const cards = items.filter(([v]) => chosen.has(v)).flatMap(i => i[2]);
    if (!cards.length) return alert('Choose at least one chapter.');
    renderCards(view, cards);
  };
}

function renderVocab(view, words) {
  view.innerHTML = `<table class="vocab">${words.map(w => `
    <tr><td>${say(w.kana)}</td><td class="kana">${w.kana}</td><td>${w.kanji}</td><td>${w.en}</td></tr>`).join('')}
  </table>`;
}

function renderKanjiList(view, ks) {
  view.innerHTML = `<div class="kanji-grid">${ks.map(k => `
    <article class="kanji">
      <div class="char">${k.char}</div>
      <div>
        <strong>${k.meaning}</strong>
        <div><small class="muted">音</small> ${k.on || '—'}　<small class="muted">訓</small> ${k.kun || '—'}</div>
        <ul>${k.examples.map(([w, r, en]) => `<li>${say(r)} ${w} <small class="muted">${r} · ${en}</small></li>`).join('')}</ul>
      </div>
    </article>`).join('')}
  </div>`;
}

function renderCards(view, words) {
  let deck = shuffle(dueWords(words)), done = 0;
  if (!deck.length) {
    view.innerHTML = `<p class="empty">All caught up! 🎉 Nothing is due right now.</p>
      <button class="btn wide">Practice all ${words.length} cards anyway</button>`;
    view.querySelector('button').onclick = () => { deck = shuffle([...words]); next(); };
    return;
  }
  next();

  function next() {
    const w = deck[0];
    if (!w) {
      view.innerHTML = `<p class="empty">Session done: ${done} reviews. お疲れさまでした！</p>`;
      return;
    }
    const back = w.reading ?? w.kanji;
    view.innerHTML = `
      <p class="muted">${deck.length} left · Again = see it again soon, Got it = see it in a few days</p>
      <div class="card">
        <div class="big">${w.front ?? w.kana}</div>
        <div class="back" hidden>${back ? `<div class="big-ish">${back}</div>` : ''}<div>${w.en}</div></div>
      </div>
      <button class="btn primary wide flip">Show answer</button>
      <div class="actions" hidden>
        <button class="btn again">Again</button>
        <button class="btn primary good">Got it</button>
      </div>`;
    view.querySelector('.flip').onclick = e => {
      e.target.remove();
      view.querySelector('.back').hidden = view.querySelector('.actions').hidden = false;
      view.querySelector('.good').focus();
      speak(w.say ?? w.kana);
    };
    view.querySelector('.again').onclick = () => grade(false);
    view.querySelector('.good').onclick = () => grade(true);
    view.querySelector('.flip').focus();
  }

  function grade(ok) {
    const w = deck.shift();
    progress[w.id] = review(progress[w.id], ok);
    save();
    track('reviews');
    done++;
    if (!ok) deck.push(w);
    next();
  }
}

// Share of every quiz each section gets, in percent.
const LESSON_MIX = { Vocabulary: 35, Grammar: 35, 'Kanji reading': 15, Listening: 15 };
const KANJI_MIX = { Meaning: 30, Words: 30, Readings: 20, Recall: 20 };

function lessonSections(l) {
  const v = l.vocab, withKanji = v.filter(w => w.kanji), examples = l.grammar.flatMap(g => g.examples);
  const opts = (w, f, pool = v) => quizOptions(w[f], pool.map(x => x[f]));
  return {
    Vocabulary: v.flatMap(w => [
      { id: w.id, ask: 'What does this mean?', prompt: w.kana, answer: w.en, choices: opts(w, 'en') },
      { id: w.id, ask: 'Which word is it?', prompt: w.en, answer: w.kana, choices: opts(w, 'kana') },
    ]),
    'Kanji reading': withKanji.map(w =>
      ({ id: w.id, ask: 'How do you read this?', prompt: w.kanji, answer: w.kana, choices: opts(w, 'kana', withKanji) })),
    Listening: window.speechSynthesis ? v.map(w =>
      ({ id: w.id, ask: 'Listen: what does it mean?', prompt: '', say: w.kana, answer: w.en, choices: opts(w, 'en') })) : [],
    Grammar: [
      ...l.quiz.map(([sentence, answer, wrong, en]) =>
        ({ ask: 'Fill in the blank', prompt: sentence.replaceAll('＿', '＿＿'), answer, choices: [answer, ...wrong], note: en })),
      ...examples.map(([jp, en]) =>
        ({ ask: 'What does this sentence mean?', prompt: jp, answer: en, choices: quizOptions(en, examples.map(e => e[1])) })),
    ],
  };
}

function kanjiSections(ks) {
  const words = ks.flatMap(k => k.examples.map(([w, r, en]) => ({ id: k.id, w, r, en })));
  const reading = (f, label) => ks.filter(k => k[f]).map(k => ({
    id: k.id, ask: `What is the ${label} reading?`, prompt: k.char, answer: k[f],
    choices: quizOptions(k[f], ks.filter(x => x[f]).map(x => x[f])),
  }));
  return {
    Meaning: ks.map(k => ({ id: k.id, ask: 'What does this kanji mean?', prompt: k.char, answer: k.meaning, choices: quizOptions(k.meaning, ks.map(x => x.meaning)) })),
    Words: words.map(x => ({ id: x.id, ask: 'How do you read this word?', prompt: x.w, answer: x.r, choices: quizOptions(x.r, words.map(y => y.r)), note: x.en })),
    Readings: [...reading('on', '音 (on)'), ...reading('kun', '訓 (kun)')],
    Recall: ks.map(k => ({ id: k.id, ask: 'Which kanji means this?', prompt: k.meaning, answer: k.char, choices: quizOptions(k.char, ks.map(x => x.char)) })),
  };
}

const lessonTips = ls => {
  const at = tab => ls.length === 1 ? `#/lesson/${ls[0].id}/${tab}` : tab === 'cards' ? '#/cards' : '#/chapters';
  return {
    Vocabulary: `do the <a href="${at('cards')}">flashcards</a> every day and say each word out loud.`,
    'Kanji reading': `go through the <a href="${at('vocab')}">vocabulary list</a>, cover the kana and read the kanji.`,
    Listening: `play each word in the <a href="${at('vocab')}">vocabulary list</a> and say what it means before you look.`,
    Grammar: `re-read the <a href="${at('grammar')}">grammar notes</a> and write one sentence of your own for each pattern.`,
  };
};

const kanjiTips = lv => ({
  Meaning: `do the <a href="#/kanji/${lv.level}/cards">kanji flashcards</a> daily and say the meaning before you flip.`,
  Words: `learn kanji through words: read the example words in the <a href="#/kanji/${lv.level}/list">kanji list</a> aloud.`,
  Readings: `say the 音 and 訓 readings out loud for each kanji in the <a href="#/kanji/${lv.level}/list">kanji list</a>.`,
  Recall: `write each kanji by hand 5 times while saying its meaning, then test yourself from the meaning.`,
});

// build() returns { sections, tips } when Start is pressed (so a chapter picker in `extra` is read then).
function startQuiz(view, mix, build, extra = '') {
  view.innerHTML = `${extra}
    <label class="setup">How many questions?
      <select>${[10, 25, 50, 75, 100, 200].map(n => `<option>${n}</option>`).join('')}</select>
    </label>
    <p class="muted">Mix: ${Object.entries(mix).map(([k, v]) => `${k} ${v}%`).join(' · ')}. Questions are random every time.</p>
    <button class="btn primary wide start">Start quiz</button>`;
  view.querySelector('.start').onclick = () => {
    const quiz = build();
    if (!quiz) return;
    for (const [k, qs] of Object.entries(quiz.sections)) qs.forEach(q => q.section = k);
    runQuiz(view, pickWeighted(quiz.sections, mix, +view.querySelector('select').value),
      results => renderResults(view, results, quiz.tips, () => startQuiz(view, mix, build, extra)));
  };
}

// One multiple-choice question: shows it, marks the right answer once picked, then calls onAnswer.
function ask(view, q, header, footer, onAnswer) {
  view.innerHTML = `
    <p class="muted">${header}</p>
    <div class="card">
      ${q.prompt ? `<div class="${q.prompt.length > 12 ? 'mid' : 'big'}">${q.prompt}</div>` : ''}
      ${q.say ? `<button class="say big" data-say="${q.say}" aria-label="Play again">🔊</button>` : ''}
      ${q.note ? `<p class="muted" hidden>${q.note}</p>` : ''}
    </div>
    <div class="options">${shuffle([...q.choices]).map(o => `<button class="btn opt">${o}</button>`).join('')}</div>
    ${footer}`;
  if (q.say) speak(q.say);
  const opts = view.querySelectorAll('.opt');
  opts.forEach(b => b.onclick = () => {
    const ok = b.textContent === q.answer;
    track('answered', ok);
    opts.forEach(x => { x.disabled = true; if (x.textContent === q.answer) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    const note = view.querySelector('.card p');
    if (note) note.hidden = false;
    onAnswer(ok, b.textContent, !!note);
  });
}

function runQuiz(view, qs, done) {
  let i = 0;
  const results = [];
  next();

  function next() {
    if (i === qs.length) return done(results);
    const q = qs[i++];
    ask(view, q, `Question ${i} of ${qs.length} · ${q.section} · ${q.ask}`,
      '<button class="btn link finish">End quiz and see results</button>', (ok, picked, note) => {
        results.push({ q, ok, picked });
        setTimeout(next, ok ? 700 : note ? 2500 : 1800);
      });
    view.querySelector('.finish').onclick = () => done(results);
  }
}

// Practice: no count and no score report. It runs until you leave, and missed items come back a few turns later.
function practiceQueue(items) {
  let queue = [];
  return {
    next: () => (queue.length ? queue : (queue = shuffle([...items]))).shift(),
    again: item => queue.splice(3, 0, item),
  };
}

function drill(view, qs) {
  const queue = practiceQueue(qs);
  let right = 0, wrong = 0;
  next();

  function next() {
    const q = queue.next();
    ask(view, q, `Practice · ✓ ${right}　✗ ${wrong} · ${q.ask}`, '<button class="btn primary wide next" hidden>Next</button>', ok => {
      if (ok) { right++; return setTimeout(next, 700); }
      wrong++;
      queue.again(q);
      const b = view.querySelector('.next');
      b.hidden = false;
      b.onclick = next;
      b.focus();
    });
  }
}

function renderResults(view, results, tips, again, header = '') {
  const by = {};
  results.forEach(r => { const s = by[r.q.section] ||= { ok: 0, n: 0 }; s.n++; s.ok += r.ok; });
  const rows = Object.entries(by).map(([k, s]) => ({ k, ...s, pct: Math.round(100 * s.ok / s.n) }));
  const weak = rows.filter(r => r.pct < 80).sort((a, b) => a.pct - b.pct);
  const missed = [...new Map(results.filter(r => !r.ok).map(r => [r.q, r])).values()];
  // Missed words go back to the start of the flashcard schedule so they come up in today's review.
  missed.forEach(r => { if (r.q.id) progress[r.q.id] = review(progress[r.q.id], false); });
  save();
  view.innerHTML = `
    <p class="score">${results.filter(r => r.ok).length} / ${results.length}</p>
    ${header}
    ${rows.length ? `<h3>Score by section</h3>
    <div class="chart">${rows.map(r => `
      <div class="row" title="${r.k}: ${r.ok} of ${r.n} correct">
        <span>${r.pct < 80 ? '⚠ ' : ''}${r.k}</span>
        <span class="track"><i style="width:${r.pct}%"></i></span>
        <span>${r.pct}% <small class="muted">${r.ok}/${r.n}</small></span>
      </div>`).join('')}
    </div>
    <h3>What to brush up</h3>
    ${weak.length
      ? `<ul>${weak.map(r => `<li>⚠ <strong>${r.k}</strong> (${r.pct}%): ${tips[r.k]}</li>`).join('')}</ul>`
      : '<p>✓ Every section is at 80% or higher. You\'re ready to move on!</p>'}` : ''}
    ${missed.length ? `<h3>Questions you missed</h3>
    <p class="muted">The missed words have been added to your flashcard reviews.</p>
    <ul class="missed">${missed.map(r => `
      <li>${r.q.prompt || say(r.q.say) + ' ' + r.q.say} → <strong>${r.q.answer}</strong> <small class="muted">(you chose ${r.picked})</small></li>`).join('')}
    </ul>` : ''}
    <button class="btn primary wide again">${header ? 'New exam' : 'New quiz'}</button>`;
  view.querySelector('.again').onclick = again;
}

// JLPT N5-style exam: もんだい sections with Japanese instructions, numbered choices, no feedback until you submit.
const LISTENING = '聴解 (listening)';
const EXAM = [
  { name: '漢字読み (kanji reading)', n: 7, instr: '＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    make: ({ k }) => k.map(w => ({ id: w.id, prompt: `<u>${w.kanji}</u>`, answer: w.kana, choices: quizOptions(w.kana, k.map(x => x.kana)) })) },
  { name: '表記 (writing)', n: 5, instr: '＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    make: ({ k }) => k.map(w => ({ id: w.id, prompt: `<u>${w.kana}</u>`, answer: w.kanji, choices: quizOptions(w.kanji, k.map(x => x.kanji)) })) },
  { name: '文法 (grammar)', n: 9, instr: '（　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    make: ({ quiz }) => quiz.map(([s, answer, wrong]) => ({ prompt: s.replaceAll('＿', '（　）'), answer, choices: [answer, ...wrong] })) },
  { name: '並べ替え (sentence order)', n: 4, instr: '★ に 入る ものは どれですか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    make: ({ sentences }) => {
      const qs = sentences.map(starQuestion).filter(Boolean);
      const withContext = qs.filter(q => q.prompt !== '＿＿ ＿＿ ★ ＿＿。'); // real ★ questions show part of the sentence
      return withContext.length >= 4 ? withContext : qs;
    } },
  { name: LISTENING, n: 5, instr: '🔊 を おして ことばを きいて ください。1・2・3・4から いちばん いい ものを 一つ えらんで ください。',
    make: ({ v }) => window.speechSynthesis ? v.map(w => ({ id: w.id, prompt: '', say: w.kana, answer: w.kana, choices: quizOptions(w.kana, v.map(x => x.kana)) })) : [] },
];
const EXAM_TIPS = {
  '漢字読み (kanji reading)': 'read the kanji column of each <a href="#/chapters">chapter\'s vocabulary list</a> with the kana covered, and do the <a href="#/kanji">kanji</a> Words quiz.',
  '表記 (writing)': 'practise going from reading to kanji: do the <a href="#/kanji">kanji</a> Recall quiz and write words by hand.',
  '文法 (grammar)': 're-read the grammar notes in each <a href="#/chapters">chapter</a>, then do a <a href="#/quiz">quiz</a> on the same chapters.',
  '並べ替え (sentence order)': 'read the grammar example sentences aloud, then rebuild them from memory, paying attention to where particles go.',
  [LISTENING]: 'play each word in the vocabulary lists and repeat it; the <a href="#/quiz">quiz</a> has a Listening section too.',
};

function renderExamPage() {
  const view = shell('Exam');
  view.innerHTML = `
    <p>A practice test in the JLPT N5 style: questions grouped by もんだい with Japanese instructions,
      four numbered choices, a time limit, and no answers shown until you submit.</p>
    ${picker(lessonItems())}
    <ul class="muted">${EXAM.map(s => `<li>${s.name}: ${s.n} questions</li>`).join('')}</ul>
    <button class="btn primary wide">Start exam</button>`;
  view.querySelector('.btn').onclick = () => {
    const ls = pickedLessons();
    if (!ls.length) return alert('Choose at least one chapter.');
    runExam(view, ls);
  };
}

function runExam(view, ls) {
  const v = ls.flatMap(l => l.vocab), quiz = ls.flatMap(l => l.quiz);
  const pool = {
    v, quiz, k: v.filter(w => w.kanji && !/[～\[\] ？]/.test(w.kanji)), // single words only, like the real test
    sentences: [...ls.flatMap(l => l.grammar.flatMap(g => g.examples.map(e => e[0]))), ...quiz.map(([s, a]) => s.replaceAll('＿', a))],
  };
  const parts = EXAM.map(s => ({ ...s, qs: shuffle(s.make(pool)).slice(0, s.n) })).filter(p => p.qs.length);
  parts.forEach(p => p.qs.forEach(q => { q.section = p.name; q.choices = shuffle([...q.choices]); }));
  const qs = parts.flatMap(p => p.qs);
  let left = qs.length * 60; // about the real exam's pace of a minute per question
  view.innerHTML = `
    <div class="exam-bar"><span>残り時間 <b class="timer"></b></span><button class="btn primary submit">提出する (Submit)</button></div>
    ${parts.map((p, i) => `
      <section class="mondai">
        <h3>もんだい${i + 1} · ${p.name}</h3>
        <p class="instr">${p.instr}</p>
        ${p.qs.map(q => { const n = qs.indexOf(q); return `
          <fieldset class="q">
            <legend>${n + 1}. ${q.prompt || say(q.say)}</legend>
            ${q.choices.map((c, j) => `<label><input type="radio" name="q${n}" value="${j}"> ${j + 1}　${c}</label>`).join('')}
          </fieldset>`; }).join('')}
      </section>`).join('')}
    <button class="btn primary wide submit">提出する (Submit)</button>`;
  const tick = () => {
    view.querySelector('.timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left-- <= 0) submit(true);
  };
  tick();
  timer = setInterval(tick, 1000);
  view.querySelectorAll('.submit').forEach(b => b.onclick = () => submit(false));

  function submit(timeUp) {
    const picked = qs.map((q, i) => view.querySelector(`input[name="q${i}"]:checked`)?.value);
    const blank = picked.filter(p => p == null).length;
    if (!timeUp && blank && !confirm(`${blank} question(s) unanswered. Submit anyway?`)) return;
    clearInterval(timer);
    const results = qs.map((q, i) => ({ q, ok: q.choices[picked[i]] === q.answer, picked: q.choices[picked[i]] ?? '(no answer)' }));
    results.forEach(r => track('answered', r.ok));
    const ratio = rs => rs.length ? rs.filter(r => r.ok).length / rs.length : null;
    const s = jlptScore(ratio(results.filter(r => r.q.section !== LISTENING)), ratio(results.filter(r => r.q.section === LISTENING)));
    exams.push({ date: dayKey(), total: s.total, max: s.max, pass: s.pass });
    store('jlpt-exams', exams);
    window.scrollTo(0, 0);
    renderResults(view, results, EXAM_TIPS, renderExamPage, `
      <div class="jlpt">
        <b>${s.pass ? '合格 Pass' : '不合格 Not yet'}${timeUp ? ' · time is up' : ''}</b>
        言語知識 (language knowledge) ${s.lang}/120${s.listen == null ? '' : ` · 聴解 (listening) ${s.listen}/60`} · 合計 ${s.total}/${s.max}
        <small class="muted">JLPT N5 pass mark: 80/180 total, at least 38 for language knowledge and 19 for listening.
          This is a practice estimate; the real exam scales scores differently and also has reading passages.</small>
      </div>`);
  }
}

// Hiragana in gojūon order with romaji (ぢ/づ left out: they sound like じ/ず). Katakana is the same letters shifted by 0x60 in Unicode.
const HIRAGANA = ('あa いi うu えe おo かka きki くku けke こko さsa しshi すsu せse そso たta ちchi つtsu てte とto ' +
  'なna にni ぬnu ねne のno はha ひhi ふfu へhe ほho まma みmi むmu めme もmo やya ゆyu よyo らra りri るru れre ろro ' +
  'わwa をwo んn がga ぎgi ぐgu げge ごgo ざza じji ずzu ぜze ぞzo だda でde どdo ばba びbi ぶbu べbe ぼbo ぱpa ぴpi ぷpu ぺpe ぽpo')
  .split(' ').map(s => [s[0], s.slice(1)]);
const KATAKANA = HIRAGANA.map(([k, r]) => [String.fromCharCode(k.charCodeAt(0) + 0x60), r]);

function renderPractice(tab) {
  const tabs = { hiragana: 'Hiragana', katakana: 'Katakana', kanji: 'Kanji', grammar: 'Grammar', sentences: 'Sentence building' };
  if (!tabs[tab]) tab = 'hiragana';
  const view = shell('Practice', '#/practice', tabs, tab);
  const start = (pickerHtml, intro, begin) => {
    view.innerHTML = `${pickerHtml}<p class="muted">${intro}</p><button class="btn primary wide">Start practice</button>`;
    view.querySelector('.btn').onclick = begin;
  };
  const need = list => list.length ? list : alert('Choose at least one.');

  if (tab === 'hiragana' || tab === 'katakana') return renderKana(view, tab === 'hiragana' ? HIRAGANA : KATAKANA);
  if (tab === 'kanji') return start(picker(levels.map(lv => [lv.level, `${lv.level} kanji`]), 'Levels'),
    'Meanings, readings, example words and recall, mixed together.', () => {
      const lvs = need(levels.filter(lv => chosen.has(lv.level)));
      if (lvs) drill(view, Object.values(kanjiSections(lvs.flatMap(lv => lv.kanji))).flat());
    });
  if (tab === 'grammar') return start(picker(lessonItems()),
    'Fill-in-the-blank particles and phrases, and the meaning of grammar example sentences.', () => {
      const ls = need(pickedLessons());
      if (ls) drill(view, lessonSections(merge(ls)).Grammar);
    });
  start(picker(lessonItems()),
    'You see the meaning in English. Tap the Japanese pieces in the right order to build the sentence. Tap a placed piece to take it back.', () => {
      const ls = need(pickedLessons());
      if (!ls) return;
      const all = ls.flatMap(l => [...l.grammar.flatMap(g => g.examples), ...l.quiz.map(([s, a, , en]) => [s.replaceAll('＿', a), en])])
        .filter(([jp]) => !/…|＝|→/.test(jp) && !/。./.test(jp.trim())) // skip dialogues, sums and conjugation drills
        .map(([jp, en]) => ({ jp: jp.replace(/（[^）]*）/g, '').trim(), en, parts: pieces(jp) }))
        .filter(s => s.parts.length >= 3);
      buildSentences(view, [...new Map(all.map(s => [s.jp, s])).values()]);
    });
}

function renderKana(view, kana) {
  const qs = [
    ...kana.map(([k, r]) => ({ ask: 'How do you read this?', prompt: k, answer: r, choices: quizOptions(r, kana.map(x => x[1])) })),
    ...kana.map(([k, r]) => ({ ask: 'Which character is this?', prompt: r, answer: k, choices: quizOptions(k, kana.map(x => x[0])) })),
    ...(window.speechSynthesis ? kana.map(([k]) =>
      ({ ask: 'Listen: which character is it?', prompt: '', say: k, answer: k, choices: quizOptions(k, kana.map(x => x[0])) })) : []),
  ];
  view.innerHTML = `
    <p class="muted">Tap a character to hear it. When you're ready, practise reading, writing and listening mixed together.</p>
    <button class="btn primary wide">Start practice</button>
    <div class="kana-grid">${kana.map(([k, r]) =>
      `<button class="kana-tile" data-say="${k}" aria-label="${k} (${r})"><span>${k}</span><small>${r}</small></button>`).join('')}</div>`;
  view.querySelector('.btn').onclick = () => drill(view, qs);
}

function buildSentences(view, sentences) {
  if (!sentences.length) return view.innerHTML = '<p class="empty">No sentences in these chapters yet.</p>';
  const queue = practiceQueue(sentences);
  let right = 0, wrong = 0;
  next();

  function next() {
    const s = queue.next(), answer = s.parts.join(' ');
    const bank = shuffle(s.parts.map((t, id) => ({ t, id }))), built = [];
    if (bank.map(p => p.t).join(' ') === answer) bank.push(bank.shift()); // never start already solved
    let checked = false;
    view.innerHTML = `
      <p class="muted">Practice · ✓ ${right}　✗ ${wrong} · Build the sentence</p>
      <div class="card"><div class="mid">${s.en}</div></div>
      <div class="built" aria-live="polite"></div>
      <div class="bank"></div>
      <p class="verdict" hidden></p>
      <button class="btn primary wide check" disabled>Check</button>`;
    const draw = () => {
      const chips = list => list.map(p => `<button class="btn piece" data-id="${p.id}">${p.t}</button>`).join('');
      view.querySelector('.built').innerHTML = chips(built) || '<span class="muted">Tap the pieces below in order</span>';
      view.querySelector('.bank').innerHTML = chips(bank);
      view.querySelector('.check').disabled = bank.length > 0;
    };
    const move = (from, to) => e => {
      const b = e.target.closest('.piece');
      if (!b || checked) return;
      to.push(...from.splice(from.findIndex(p => p.id === +b.dataset.id), 1));
      draw();
    };
    view.querySelector('.bank').onclick = move(bank, built);
    view.querySelector('.built').onclick = move(built, bank);
    view.querySelector('.check').onclick = e => {
      if (checked) return next();
      checked = true;
      const ok = built.map(p => p.t).join(' ') === answer;
      track('answered', ok);
      ok ? right++ : (wrong++, queue.again(s));
      view.querySelector('.built').classList.add(ok ? 'right' : 'wrong');
      const v = view.querySelector('.verdict');
      v.hidden = false;
      v.innerHTML = `${ok ? '✓ 正解！' : '✗ Correct order:'} <span class="kana">${s.jp}</span> ${say(s.jp)}`;
      e.target.textContent = 'Next';
      speak(s.jp);
    };
    draw();
  }
}

function renderGrammar(view, l) {
  view.innerHTML = l.grammar.map(g => `
    <article class="grammar">
      <h3>${g.pattern}</h3>
      <p>${g.note}</p>
      <ul>${g.examples.map(([jp, en]) => `<li>${say(jp)} <span class="kana">${jp}</span><br><small class="muted">${en}</small></li>`).join('')}</ul>
    </article>`).join('');
}

route();
