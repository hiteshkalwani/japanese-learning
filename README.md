# JLPT Study App · みんなの日本語

A lightweight web app for studying for the JLPT, following the *Minna no Nihongo* textbook.
It has vocabulary with audio, grammar notes, spaced-repetition flashcards, a kanji section by
JLPT level, and quizzes that show you what to brush up.

No frameworks, no build step, no dependencies: plain HTML, CSS and JavaScript.

## Features

**Lessons** (Minna no Nihongo 第1–25課, all of N5)

| Tab | What it does |
|---|---|
| Vocabulary | Word list in kana and kanji with English meanings and 🔊 pronunciation |
| Flashcards | Spaced repetition: *Again* repeats the card in this session, *Got it* moves it out to 1 → 3 → 7 → 14 → 30 days |
| Quiz | 10–200 questions mixed from Vocabulary, Grammar, Kanji reading and Listening |
| Grammar | Each sentence pattern with a short explanation and example sentences you can play |

**Kanji** (JLPT N5 so far)

| Tab | What it does |
|---|---|
| Kanji list | Every kanji with its meaning, 音 (on) and 訓 (kun) readings, and example words. Tap a kanji to watch its stroke order |
| Flashcards | Same spaced-repetition schedule as the vocabulary |
| Quiz | 10–200 questions mixed from Meaning, Words, Readings and Recall |

**Quiz results:** each quiz ends with your score, a bar chart of your score per section, a
"what to brush up" list for any section under 80%, and the questions you missed. Missed items are
added to that day's flashcard reviews.

**Navbar:** Dashboard · Chapters · Practice · Quiz · Flashcards · Kanji · Exam

| Page | What it does |
|---|---|
| Dashboard | Today's reviews and questions, your day streak, chapters completed, a 14-day activity chart, progress bars for each chapter and kanji level, and recent exam scores |
| Chapters | All lessons; open one for its Vocabulary, Flashcards, Quiz and Grammar tabs |
| Practice | Drills for learning, one skill at a time: Hiragana, Katakana, Kanji, Grammar and Sentence building (see below) |
| Quiz | Revision quiz from the chapters you tick |
| Flashcards | Review due cards from the chapters and kanji levels you tick |
| Kanji | Kanji by JLPT level |
| Exam | JLPT N5-style practice test from the chapters you tick (see below) |

**Practice vs. Quiz:** a quiz is a test, with a set number of questions, a score and a results
chart. Practice is for learning: it runs until you leave, with no score report, only instant
right/wrong feedback and a running ✓/✗ tally. Anything you miss comes back a few questions later.

| Practice tab | What you do |
|---|---|
| Hiragana / Katakana | Tap the chart to hear each character, then drill reading (kana → romaji), writing (romaji → kana) and listening |
| Kanji | Meanings, readings, example words and recall, for the levels you tick |
| Grammar | Fill-in-the-blank particles and phrases, and sentence meanings, from the chapters you tick |
| Sentence building | See the English meaning, then tap the jumbled Japanese pieces in the right order |

A chapter counts as **completed** when every word is learned, which means "Got it" twice in a row
in flashcards.

**Exam** (JLPT N5 style): questions are grouped into もんだい with the real test's Japanese
instructions, four numbered choices, a time limit (a minute per question), and no answers until
you submit. The sections are 漢字読み (kanji reading, 7), 表記 (writing, 5), 文法 (grammar, 9),
並べ替え ★ (sentence order, 4) and 聴解 (listening, 5). Scores use the JLPT scale: language
knowledge out of 120 (at least 38) plus listening out of 60 (at least 19), with 80/180 to pass. It's a
practice estimate: the real exam scales scores differently and also has reading passages.

Progress is saved in your browser (`localStorage`), so there's no account or server. It stays
in the browser you used and is separate for each address (the file vs. `localhost`).

## Getting started

### Option 1: open the file

Double-click `index.html`. That's it.

### Option 2: Docker

```sh
docker compose up -d --build    # start, then open http://localhost:8505
docker compose down             # stop
```

To use a different port, run `PORT=9000 docker compose up -d --build`.

Rebuild (`--build`) after you change any files, because the files are copied into the image.

## Project structure

```
index.html        Page shell; loads every script below
app.js            Pages: dashboard, chapters, quiz, flashcards, kanji, exam, results
srs.js            Logic: spaced repetition, quiz picking, streaks, ★ questions, JLPT scoring
style.css         Styles, with light and dark themes
lessons/          One file per Minna no Nihongo lesson
kanji/            One file per JLPT level, plus strokes.js (generated stroke order data)
scripts/          build-strokes.js: downloads stroke order from KanjiVG into kanji/strokes.js
test.js           Checks the data files and the scheduling/quiz logic
Dockerfile        nginx image that serves the app
compose.yaml      Runs the image on port 8505
```

## Adding content

The data files are plain JavaScript, so the app also works when opened straight from disk.
After any change, run `node test.js`. It catches missing `<script>` tags, duplicate entries and
badly formatted items.

### A new lesson

1. Copy `lessons/lesson01.js` to `lessons/lesson04.js` and change `id` and `title`.
2. Fill in the three lists:

   ```js
   vocab: [
     ['せんせい', '先生', 'teacher'],        // [kana, kanji ('' if none), english]
   ],
   grammar: [
     {
       pattern: 'N1 は N2 です',
       note: 'Short explanation.',
       examples: [['わたしは がくせいです。', 'I am a student.']],   // [japanese, english]
     },
   ],
   quiz: [
     // [sentence with ＿ for the blank, correct answer, [3 wrong answers], english]
     ['わたし＿ がくせいです。', 'は', ['も', 'の', 'か'], 'I am a student.'],
   ],
   ```

3. Add `<script src="lessons/lesson04.js"></script>` to `index.html`.

### A new kanji level

1. Copy `kanji/n5.js` to `kanji/n4.js` and set `level: 'N4'`.
2. Fill in the list:

   ```js
   // [kanji, meaning, on'yomi (katakana), kun'yomi (hiragana), [[word, reading, meaning], ...]]
   ['会', 'meet', 'カイ', 'あ(う)', [['会う', 'あう', 'to meet'], ['会社', 'かいしゃ', 'company']]],
   ```

   Use `''` for a reading the kanji doesn't have. Each example word must contain the kanji.
3. Add `<script src="kanji/n4.js"></script>` to `index.html`.
4. Run `node scripts/build-strokes.js` to add the new kanji's stroke order to `kanji/strokes.js`.
   `node test.js` fails until you do.

### Changing the quiz mix

The share of questions from each section is set at the top of the quiz code in `app.js`:

```js
const LESSON_MIX = { Vocabulary: 35, Grammar: 35, 'Kanji reading': 15, Listening: 15 };
const KANJI_MIX = { Meaning: 30, Words: 30, Readings: 20, Recall: 20 };
```

Questions within each section are random, and they only repeat once every question in that
section has been used.

## How to study with it

1. **Textbook first.** Read the lesson's conversation and sentence patterns in the book.
2. **Grammar tab, then Vocabulary tab** with audio on. Say every word out loud.
3. **Flashcards every day.** Even 10 minutes daily beats one long session a week.
4. **Quiz before moving on.** Aim for 80% or higher in every section, and follow the
   "what to brush up" tips for the rest.
5. **Write your own sentences** for each grammar pattern, about your own life.
6. **Kanji alongside the lessons.** Learn kanji through the example words, not on their own.

## Roadmap

- [x] Minna no Nihongo lessons 1–25 (N5)
- [ ] Kanji N4, N3, N2, N1
- [ ] Lessons 26–50 (N4)

## Notes

- Audio uses your browser's built-in Japanese voice. If your browser can't speak, the
  Listening section is left out of quizzes.
- The vocabulary, grammar notes and quiz questions are written for this project. They follow the
  textbook's lesson structure but aren't copied from the book. There's no official JLPT kanji
  list, so the N5 list is the commonly used unofficial one.
- Kanji stroke order comes from [KanjiVG](https://kanjivg.tagaini.net), © Ulrich Apel, under
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). `kanji/strokes.js` is derived
  from it and shared under the same license.
