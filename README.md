# JLPT study app (みんなの日本語)

A small, dependency-free web app for studying for the JLPT, following *Minna no Nihongo*.

- **Lessons** (第1–3課): vocabulary with audio, grammar notes, spaced-repetition flashcards, and a quiz
- **Kanji** (N5): kanji list with readings and example words, flashcards, and a quiz
- **Quizzes**: choose 10–200 questions; a fixed mix of sections (vocabulary, grammar, kanji reading, listening) with random questions, and a results chart that shows what to brush up

Progress is saved in your browser (localStorage).

## Run

Open `index.html` in a browser, or:

```sh
docker compose up -d --build   # http://localhost:8080
```

## Add content

- **Lesson:** copy `lessons/lesson01.js` to `lessons/lessonNN.js`, edit it, and add a `<script>` tag in `index.html`.
- **Kanji level:** copy `kanji/n5.js` to `kanji/n4.js`, edit it, and add a `<script>` tag in `index.html`.

The data format is described at the top of each file. Then run the checks:

```sh
node test.js
```
