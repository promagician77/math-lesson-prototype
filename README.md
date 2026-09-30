# math-lesson-prototype

One playable kids' math lesson ("Make 10 to add", ages 6-7) with the full loop:
pick a lesson -> learn by moving counters -> answer questions along the way -> end quiz -> results.

It follows concrete -> pictorial -> abstract: children move counters, then reason from a picture, then work with numbers only.

## Run
```bash
npm test     # validates every lesson file (answers in choices, sums correct, hints present)
npm start    # http://localhost:3000
```

## How lessons work
A lesson is a JSON file in `lessons/`. The player (`app.js`) builds screens from step types:

| Step type | What the child does |
|---|---|
| `say` | Listens to an instruction |
| `move` | Moves counters between two ten frames (tap or drag), then answers a question |
| `picture` | Answers questions about a picture, then sees it change |
| `bond` | Splits a number to make 10, answers on a number pad |
| `quiz` | Mixed typed and multiple-choice questions |
| `results` | Stars for first tries, a review, and a note for grown-ups |

Every question gets one hint after a wrong answer, then shows and explains the answer. Instructions are spoken with the browser's text-to-speech as a placeholder for a real voice.

Deploy: `npm run deploy`, or import the repo in Vercel with the "Other" preset and no build command.
