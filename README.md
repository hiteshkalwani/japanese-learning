# JLPT Study App · みんなの日本語

A lightweight web app for studying for the JLPT, following the *Minna no Nihongo* textbook.
It has vocabulary with audio, grammar notes, spaced-repetition flashcards, a kanji section by
JLPT level, and quizzes that show you what to brush up.

No frameworks, no build step, no dependencies: plain HTML, CSS and JavaScript.

## Features

**Lessons** (Minna no Nihongo 第1–3課 so far)

| Tab | What it does |
|---|---|
| Vocabulary | Word list in kana and kanji with English meanings and 🔊 pronunciation |
| Flashcards | Spaced repetition: *Again* repeats the card in this session, *Got it* moves it out to 1 → 3 → 7 → 14 → 30 days |
| Quiz | 10–200 questions mixed from Vocabulary, Grammar, Kanji reading and Listening |
| Grammar | Each sentence pattern with a short explanation and example sentences you can play |

**Kanji** (JLPT N5 so far)

| Tab | What it does |
|---|---|
| Kanji list | Every kanji with its meaning, 音 (on) and 訓 (kun) readings, and example words |
| Flashcards | Same spaced-repetition schedule as the vocabulary |
| Quiz | 10–200 questions mixed from Meaning, Words, Readings and Recall |

**Quiz results:** each quiz ends with your score, a bar chart of your score per section, a
"what to brush up" list for any section under 80%, and the questions you missed. Missed items are
added to that day's flashcard reviews.

**Home page:** your progress for each lesson and kanji level, plus *Review due cards*, which
collects due cards from everything in the app.

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
app.js            Views: home, lessons, kanji, flashcards, quizzes, results
srs.js            Spaced-repetition schedule and quiz helpers (random options, weighted picking)
style.css         Styles, with light and dark themes
lessons/          One file per Minna no Nihongo lesson
kanji/            One file per JLPT level
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

- [ ] Minna no Nihongo lessons 4–25 (rest of N5)
- [ ] Kanji N4, N3, N2, N1
- [ ] Lessons 26–50 (N4)

## Notes

- Audio uses your browser's built-in Japanese voice. If your browser can't speak, the
  Listening section is left out of quizzes.
- The vocabulary, grammar notes and quiz questions are written for this project. They follow the
  textbook's lesson structure but aren't copied from the book. There's no official JLPT kanji
  list, so the N5 list is the commonly used unofficial one.
