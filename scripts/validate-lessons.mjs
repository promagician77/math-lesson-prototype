// Checks every lesson file before it ships. Content mistakes in a kids' lesson
// (an answer that isn't among the choices, a sum that's wrong) are easy to make
// and embarrassing to find in front of a child.
import { readFile } from 'node:fs/promises';

const dir = new URL('../lessons/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', dir), 'utf8'));
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

function checkQuestion(where, q) {
  if (!q.text) fail(where, 'missing text');
  if (!q.hint) fail(where, 'missing hint (a wrong answer must lead somewhere)');
  if (!q.explain) fail(where, 'missing explanation');
  if (q.choices && !q.choices.includes(q.answer)) fail(where, `answer ${q.answer} is not one of the choices`);
  if (q.choices && new Set(q.choices).size !== q.choices.length) fail(where, 'duplicate choices');
  const sum = /^(\d+)\s*\+\s*(\d+)$/.exec(q.text.trim());
  if (sum && Number(sum[1]) + Number(sum[2]) !== q.answer) fail(where, `"${q.text}" should equal ${Number(sum[1]) + Number(sum[2])}, not ${q.answer}`);
}

for (const entry of index.lessons.filter((l) => l.playable)) {
  const lesson = JSON.parse(await readFile(new URL(entry.file, dir), 'utf8'));
  const ids = new Set();
  lesson.steps.forEach((s, i) => {
    const where = `${entry.file} step ${i + 1} (${s.id})`;
    if (ids.has(s.id)) fail(where, 'duplicate step id');
    ids.add(s.id);
    if (s.type === 'move') {
      if (!(s.a < 10 && s.b < 10 && s.a + s.b > 10)) fail(where, 'move step needs two one-digit numbers that pass 10');
      checkQuestion(where, s.question);
      if (s.question.answer !== s.a + s.b - 10) fail(where, `left-over count should be ${s.a + s.b - 10}`);
    }
    if (s.type === 'picture') s.questions.forEach((q, j) => checkQuestion(`${where} q${j + 1}`, q));
    if (s.type === 'bond') {
      if (s.split[0] + s.split[1] !== s.b) fail(where, `split ${s.split} doesn't add up to ${s.b}`);
      if (s.a + s.split[0] !== 10) fail(where, `${s.a} + ${s.split[0]} doesn't make 10`);
      checkQuestion(where, { ...s.question, text: `${s.a} + ${s.b}` });
    }
    if (s.type === 'quiz') s.questions.forEach((q, j) => {
      checkQuestion(`${where} q${j + 1}`, q);
      if (!q.label) fail(`${where} q${j + 1}`, 'missing short label for the results screen');
    });
  });
  if (lesson.steps.at(-1)?.type !== 'results') fail(entry.file, 'last step should be results');
}

if (problems.length) { console.log(problems.map((p) => '  x ' + p).join('\n')); process.exit(1); }
console.log(`Lessons OK (${index.lessons.filter((l) => l.playable).length} playable, ${index.lessons.length} listed)`);
