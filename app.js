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

const app = document.getElementById('app');
const STORE = 'jlpt-progress';
let progress = {};
try { progress = JSON.parse(localStorage.getItem(STORE)) || {}; } catch {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch {} };

const dueWords = words => words.filter(w => isDue(progress[w.id]));
const knownCount = words => words.filter(w => progress[w.id]?.box >= 1).length;
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
  if (b) speak(b.dataset.say);
});

function route() {
  const [, view, id, tab] = location.hash.split('/');
  const lesson = view === 'lesson' && lessons.find(l => String(l.id) === id);
  const level = view === 'kanji' && levels.find(lv => lv.level === id);
  if (lesson) return renderLesson(lesson, tab);
  if (level) return renderKanji(level, tab);
  if (view === 'review') return renderCards(shell('Review due cards', '', {}, ''), allCards());
  renderHome();
}
window.addEventListener('hashchange', route);

function renderHome() {
  const all = allCards();
  const tile = (href, num, title, items, unit, extra = '') => `
    <a class="lesson" href="${href}">
      <span class="num">${num}</span>
      <strong>${title}</strong>
      <small class="muted">${items.length} ${unit}${extra} · ${dueWords(items).length} due</small>
      <span class="bar"><i style="width:${100 * knownCount(items) / items.length}%"></i></span>
    </a>`;
  app.innerHTML = `
    <h1>みんなの日本語 · JLPT N5</h1>
    <p class="muted">${knownCount(all)} / ${all.length} cards known · ${dueWords(all).length} due today</p>
    <a class="btn primary" href="#/review">Review due cards</a>
    <h2>Lessons</h2>
    <div class="grid">${lessons.map(l =>
      tile(`#/lesson/${l.id}`, `第${l.id}課`, l.title, l.vocab, 'words', ` · ${l.grammar.length} grammar points`)).join('')}
    </div>
    <h2>Kanji</h2>
    <div class="grid">${levels.map(lv =>
      tile(`#/kanji/${lv.level}`, `JLPT ${lv.level}`, `${lv.level} kanji`, lv.kanji, 'kanji')).join('')}
    </div>`;
}

// Shared page shell: back link, title, tab bar. Returns the element the active tab renders into.
function shell(title, base, tabs, tab) {
  app.innerHTML = `
    <a href="#/">← Home</a>
    <h1>${title}</h1>
    <nav class="tabs">${Object.entries(tabs).map(([k, v]) =>
      `<a href="${base}/${k}" class="${k === tab ? 'active' : ''}">${v}</a>`).join('')}
    </nav>
    <section id="view"></section>`;
  return document.getElementById('view');
}

function renderLesson(l, tab) {
  const tabs = { vocab: 'Vocabulary', cards: 'Flashcards', quiz: 'Quiz', grammar: 'Grammar' };
  if (!tabs[tab]) tab = 'vocab';
  const view = shell(`第${l.id}課 · ${l.title}`, `#/lesson/${l.id}`, tabs, tab);
  if (tab === 'vocab') renderVocab(view, l.vocab);
  if (tab === 'cards') renderCards(view, l.vocab);
  if (tab === 'grammar') renderGrammar(view, l);
  if (tab === 'quiz') startQuiz(view, lessonSections(l), LESSON_MIX, lessonTips(l));
}

function renderKanji(lv, tab) {
  const tabs = { list: 'Kanji list', cards: 'Flashcards', quiz: 'Quiz' };
  if (!tabs[tab]) tab = 'list';
  const view = shell(`JLPT ${lv.level} Kanji`, `#/kanji/${lv.level}`, tabs, tab);
  if (tab === 'list') renderKanjiList(view, lv.kanji);
  if (tab === 'cards') renderCards(view, lv.kanji);
  if (tab === 'quiz') startQuiz(view, kanjiSections(lv.kanji), KANJI_MIX, kanjiTips(lv));
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

const lessonTips = l => ({
  Vocabulary: `do the <a href="#/lesson/${l.id}/cards">flashcards</a> every day and say each word out loud.`,
  'Kanji reading': `go through the <a href="#/lesson/${l.id}/vocab">vocabulary list</a>, cover the kana and read the kanji.`,
  Listening: `play each word in the <a href="#/lesson/${l.id}/vocab">vocabulary list</a> and say what it means before you look.`,
  Grammar: `re-read the <a href="#/lesson/${l.id}/grammar">grammar notes</a> and write one sentence of your own for each pattern.`,
});

const kanjiTips = lv => ({
  Meaning: `do the <a href="#/kanji/${lv.level}/cards">kanji flashcards</a> daily and say the meaning before you flip.`,
  Words: `learn kanji through words: read the example words in the <a href="#/kanji/${lv.level}/list">kanji list</a> aloud.`,
  Readings: `say the 音 and 訓 readings out loud for each kanji in the <a href="#/kanji/${lv.level}/list">kanji list</a>.`,
  Recall: `write each kanji by hand 5 times while saying its meaning, then test yourself from the meaning.`,
});

function startQuiz(view, sections, mix, tips) {
  for (const [k, qs] of Object.entries(sections)) qs.forEach(q => q.section = k);
  const names = Object.keys(mix).filter(k => sections[k]?.length);
  const total = names.reduce((n, k) => n + sections[k].length, 0);
  view.innerHTML = `
    <label class="setup">How many questions?
      <select>${[10, 25, 50, 75, 100, 200].map(n => `<option>${n}</option>`).join('')}</select>
    </label>
    <p class="muted">Mix: ${names.map(k => `${k} ${mix[k]}%`).join(' · ')}.<br>
      Questions are picked at random from ${total}. Big quizzes repeat some.</p>
    <button class="btn primary wide">Start quiz</button>`;
  view.querySelector('button').onclick = () => runQuiz(view, pickWeighted(sections, mix, +view.querySelector('select').value),
    results => renderResults(view, results, tips, () => startQuiz(view, sections, mix, tips)));
}

function runQuiz(view, qs, done) {
  let i = 0;
  const results = [];
  next();

  function next() {
    if (i === qs.length) return done(results);
    const q = qs[i++];
    view.innerHTML = `
      <p class="muted">Question ${i} of ${qs.length} · ${q.section} · ${q.ask}</p>
      <div class="card">
        ${q.prompt ? `<div class="${q.prompt.length > 12 ? 'mid' : 'big'}">${q.prompt}</div>` : ''}
        ${q.say ? `<button class="say big" data-say="${q.say}" aria-label="Play again">🔊</button>` : ''}
        ${q.note ? `<p class="muted" hidden>${q.note}</p>` : ''}
      </div>
      <div class="options">${shuffle([...q.choices]).map(o => `<button class="btn opt">${o}</button>`).join('')}</div>
      <button class="btn link finish">End quiz and see results</button>`;
    if (q.say) speak(q.say);
    view.querySelector('.finish').onclick = () => done(results);
    const opts = view.querySelectorAll('.opt');
    opts.forEach(b => b.onclick = () => {
      const ok = b.textContent === q.answer;
      results.push({ q, ok, picked: b.textContent });
      opts.forEach(x => { x.disabled = true; if (x.textContent === q.answer) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const note = view.querySelector('.card p');
      if (note) note.hidden = false;
      setTimeout(next, ok ? 700 : note ? 2500 : 1800);
    });
  }
}

function renderResults(view, results, tips, again) {
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
    <p class="muted">The missed items have been added to your flashcard reviews.</p>
    <ul class="missed">${missed.map(r => `
      <li>${r.q.prompt || '🔊 ' + r.q.say} → <strong>${r.q.answer}</strong> <small class="muted">(you chose ${r.picked})</small></li>`).join('')}
    </ul>` : ''}
    <button class="btn primary wide">New quiz</button>`;
  view.querySelector('.btn.primary').onclick = again;
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
