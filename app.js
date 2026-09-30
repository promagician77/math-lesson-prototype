// Lesson player. Reads a lesson file and builds each screen from its step type.
// Step types: say, move, picture, bond, quiz, results.

const NOTES = {
  picker: ['Picking a lesson', 'Children start on a short list of lessons. One is playable here; the other two show the structure you described. I kept it to three big choices so a six-year-old can pick without help.'],
  intro: ['Every instruction is spoken', "At six, most children can't read instructions reliably yet, so audio isn't an extra. Each line is shown and spoken, and the speaker button repeats it. The voice is the browser's built-in one; for the real program I'd use a recorded or high-quality AI voice."],
  concrete: ['Hands first', "Children move counters themselves before seeing any numbers. Dragging is hard for small hands, so a tap works too. The top frame won't take more than 10, so the rule is learned by doing it, not by being told. The blue counters have a ring, so they stay different even for colorblind children."],
  'concrete-q': ['Questions right after the action', "The question checks exactly what they just did. A wrong answer gets a hint that points at the counters, not a red cross. A second wrong answer shows the answer and explains it, so nobody gets stuck on a screen."],
  pictorial: ['Then a picture', "The same idea again, but as a picture they can't touch. It's the bridge between moving things and working with numbers. The counter moves only after they've answered, so they predict first and check after."],
  abstract: ['Then just numbers', 'Now there are only numbers, plus a number bond showing how 6 splits into 3 and 3. Hands, then pictures, then numbers is a well-established order for early math, because each step leans on the one before.'],
  quiz: ['The end quiz', 'It mixes typed answers and choices, so it checks the idea and not a button pattern. Each question allows one hint before showing the answer. Stars only count first tries, so the score actually means something.'],
  results: ['Results for the child, and for a grown-up', "The child sees stars and what they did. A parent or teacher gets one plain sentence about what to practise. It's all worked out from the lesson file, so new lessons get this for free."],
};

const $ = (id) => document.getElementById(id);
const stage = $('stage');
let index = null, lesson = null, step = -1, soundOn = true, quiz = null;

// ---------- voice ----------
function speak(text) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\+/g, ' plus ').replace(/=/g, ' equals '));
  u.rate = 0.92; u.pitch = 1.08; u.lang = 'en-US';
  speechSynthesis.speak(u);
}
$('sound').addEventListener('click', () => {
  soundOn = !soundOn;
  $('sound').innerHTML = soundOn ? '&#128266;' : '&#128263;';
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
  if (!soundOn && 'speechSynthesis' in window) speechSynthesis.cancel();
});
$('home').addEventListener('click', () => showPicker());

// ---------- helpers ----------
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const PIP = '<svg class="pip" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="36" rx="24" ry="22" fill="#F2B233"/><ellipse cx="32" cy="40" rx="15" ry="12" fill="#FBD98A"/><circle cx="24" cy="30" r="6" fill="#fff"/><circle cx="40" cy="30" r="6" fill="#fff"/><circle cx="25" cy="31" r="3" fill="#222"/><circle cx="41" cy="31" r="3" fill="#222"/><path d="M28 40q4 4 8 0" stroke="#7A5200" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M22 14l4 8M42 14l-4 8" stroke="#C88F16" stroke-width="3" stroke-linecap="round"/></svg>';
function say(text, { speakNow = true } = {}) {
  const box = el('div', 'say', `${PIP}<p></p>`);
  box.querySelector('p').textContent = text;
  const b = el('button', 'replay', '&#128264;'); b.setAttribute('aria-label', 'Hear it again');
  b.addEventListener('click', () => speak(text));
  box.append(b);
  if (speakNow) speak(text);
  return box;
}
function note(key) { const [t, b] = NOTES[key]; $('note-title').textContent = t; $('note-body').textContent = b; }
function dots() {
  const n = lesson ? lesson.steps.length : 0;
  $('dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('');
}
function nextButton(label = 'Next') {
  const b = el('button', 'go', label);
  b.addEventListener('click', () => goTo(step + 1));
  return b;
}

// ---------- questions ----------
// Two tries: a wrong answer gives the hint, a second shows the answer.
function ask(q, container, { kind = q.choices ? 'choice' : 'input', onDone, noteOnAsk } = {}) {
  let wrong = 0, finished = false;
  const fb = el('p', 'feedback'); fb.setAttribute('aria-live', 'polite');
  const record = { text: q.label || q.text, firstTry: false, hinted: false, revealed: false };
  if (noteOnAsk) note(noteOnAsk);

  function settle(correct, controls) {
    finished = true;
    record.firstTry = correct && wrong === 0;
    record.revealed = !correct;
    fb.className = 'feedback good';
    fb.textContent = (correct ? (wrong ? 'Yes, you got it! ' : 'Yes! ') : 'Here it is: ') + q.explain;
    speak(fb.textContent);
    controls?.forEach((c) => (c.disabled = true));
    onDone?.(record);
  }
  function miss(controls) {
    wrong++;
    if (wrong === 1) { record.hinted = true; fb.className = 'feedback hint'; fb.textContent = 'Nearly! ' + q.hint; speak(fb.textContent); return; }
    settle(false, controls);
  }

  if (kind === 'choice') {
    const row = el('div', 'choices');
    const btns = q.choices.map((c) => {
      const b = el('button', 'choice', String(c)); b.setAttribute('aria-label', `Answer ${c}`);
      b.addEventListener('click', () => {
        if (finished) return;
        if (c === q.answer) { b.classList.add('right'); settle(true, btns); }
        else { b.classList.add('tried'); b.disabled = true; miss(btns); if (finished) btns.find((x) => x.textContent === String(q.answer)).classList.add('reveal'); }
      });
      return b;
    });
    row.append(...btns);
    container.append(row, fb);
  } else {
    let value = '';
    const line = el('div', 'qline');
    const box = el('span', 'answerbox', '&nbsp;'); box.setAttribute('aria-label', 'Your answer');
    if (/^\d+\s*\+\s*\d+$/.test(q.text)) line.append(el('span', 'eq', `${q.text} =`), box);
    else line.append(box);
    const pad = el('div', 'pad');
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '\u232B'];
    const all = [];
    keys.forEach((k) => {
      const b = el('button', '', k); b.setAttribute('aria-label', k === '\u232B' ? 'Delete' : k);
      b.addEventListener('click', () => {
        if (finished) return;
        value = k === '\u232B' ? value.slice(0, -1) : (value + k).slice(0, 2);
        box.textContent = value || '\u00A0';
      });
      pad.append(b); all.push(b);
    });
    const check = el('button', 'wide', 'Check');
    check.addEventListener('click', () => {
      if (finished || !value) return;
      if (Number(value) === q.answer) settle(true, [...all, check]);
      else { value = ''; box.textContent = '\u00A0'; box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); miss([...all, check]); if (finished) box.textContent = String(q.answer); }
    });
    pad.append(check); all.push(check);
    container.append(line, pad, fb);
  }
  return record;
}

// ---------- ten frames ----------
function frame(reds, blues, { id } = {}) {
  const f = el('div', 'frame'); if (id) f.id = id;
  for (let i = 0; i < 10; i++) {
    const c = el('div', 'cell');
    if (i < reds) c.append(el('span', 'chip red'));
    else if (i < reds + blues) c.append(el('span', 'chip blue'));
    f.append(c);
  }
  return f;
}

// ---------- screens ----------
function showPicker() {
  step = -1; quiz = null; dots(); note('picker');
  stage.innerHTML = '';
  stage.append(say('Pick a lesson to start.'));
  const grid = el('div', 'picker');
  index.lessons.forEach((l, i) => {
    const b = el('button', 'lesson', `<span class="n">${i + 1}</span><b></b><span></span>`);
    b.querySelector('b').textContent = l.title;
    b.querySelector('span:last-child').textContent = l.playable ? l.blurb : 'In the full program';
    if (!l.playable) b.disabled = true;
    else b.addEventListener('click', async () => { lesson = await (await fetch(`/lessons/${l.file}`)).json(); goTo(0); });
    grid.append(b);
  });
  stage.append(grid);
}

function goTo(i) {
  step = i; dots();
  const s = lesson.steps[i];
  stage.innerHTML = '';
  ({ say: renderSay, move: renderMove, picture: renderPicture, bond: renderBond, quiz: renderQuiz, results: renderResults })[s.type](s);
}

function renderSay(s) {
  note(s.id);
  stage.append(say(s.text), el('p', 'big', '8 + 5'), nextButton(s.button));
}

function renderMove(s) {
  note('concrete');
  let top = s.a, bottom = s.b;
  stage.append(say(s.text));
  const wrap = el('div', 'frames');
  const area = el('div', 'qarea', '<p class="feedback">Fill it up to 10.</p>');
  const split = el('div', 'split'); split.append(wrap, area);
  stage.append(split);

  function draw() {
    wrap.innerHTML = '';
    const tf = el('div', 'frame' + (top === 10 ? ' glow' : '')); tf.id = 'topframe';
    for (let i = 0; i < 10; i++) {
      const c = el('div', 'cell');
      if (i < s.a) c.append(el('span', 'chip red'));
      else if (i < top) c.append(el('span', 'chip blue'));
      tf.append(c);
    }
    const bf = el('div', 'frame');
    for (let i = 0; i < 10; i++) {
      const c = el('div', 'cell');
      if (i < bottom) {
        const chip = el('button', 'chip blue' + (top < 10 ? ' movable' : ''));
        chip.setAttribute('aria-label', 'Blue counter. Tap to move it up.');
        enableMove(chip, tf);
        c.append(chip);
      }
      bf.append(c);
    }
    wrap.append(tf, bf);
  }

  function moveOne() {
    if (top >= 10) { $('topframe').classList.remove('shake'); void $('topframe').offsetWidth; $('topframe').classList.add('shake'); speak(s.full); return; }
    top++; bottom--; draw();
    if (top === 10) {
      speak(s.full);
      note('concrete-q');
      area.innerHTML = '';
      area.append(say(s.question.text, { speakNow: false }));
      setTimeout(() => speak(s.question.text), 1400);
      ask(s.question, area, {
        onDone: () => {
          area.append(el('p', 'eq', `${s.a} + ${s.b} = <span class="ten">10</span> + ${s.a + s.b - 10} = ${s.a + s.b}`), nextButton());
        },
      });
    }
  }

  // Tap to move, or drag onto the top frame. A short press counts as a tap.
  function enableMove(chip, tf) {
    chip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      let ghost = null, over = false;
      chip.setPointerCapture(e.pointerId);
      const moveH = (ev) => {
        const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
        if (!ghost && d > 8) { ghost = el('div', 'ghost'); document.body.append(ghost); chip.classList.add('dragging'); }
        if (ghost) {
          ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
          const r = $('topframe').getBoundingClientRect();
          over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
          $('topframe').classList.toggle('drop', over);
        }
      };
      const upH = () => {
        chip.removeEventListener('pointermove', moveH); chip.removeEventListener('pointerup', upH); chip.removeEventListener('pointercancel', upH);
        if (ghost) { ghost.remove(); chip.classList.remove('dragging'); $('topframe')?.classList.remove('drop'); if (over) moveOne(); }
        else moveOne();
      };
      chip.addEventListener('pointermove', moveH); chip.addEventListener('pointerup', upH); chip.addEventListener('pointercancel', upH);
    });
  }
  draw();
}

function renderPicture(s) {
  note('pictorial');
  const q1 = s.questions[0], q2 = s.questions[1];
  const wrap = el('div', 'frames');
  wrap.append(frame(s.a, 0), frame(0, s.b));
  const area = el('div', 'qarea');
  const split = el('div', 'split'); split.append(wrap, area);
  stage.append(say(`Here is ${s.a} + ${s.b}. ${q1.text}`), split);
  ask(q1, area, {
    onDone: () => setTimeout(() => {
      wrap.innerHTML = '';
      const tf = frame(s.a, 10 - s.a); tf.classList.add('glow');
      wrap.append(tf, frame(0, s.b - (10 - s.a)));
      tf.querySelectorAll('.chip.blue').forEach((c) => c.classList.add('flash'));
      area.innerHTML = '';
      area.append(say(q2.text));
      ask(q2, area, { onDone: () => area.append(nextButton()) });
    }, 1600),
  });
}

function renderBond(s) {
  note('abstract');
  const row = el('div', 'qline');
  const bond = el('div', 'bond',
    `<div class="ball whole top">${s.b}</div><div class="ball pair">${s.split[0]}</div><div class="ball">${s.split[1]}</div>`);
  row.append(el('span', 'eq', `${s.a} +`), bond);
  const area = el('div', 'qarea');
  stage.append(say(s.text), row, el('p', 'eq', `${s.a} + <span class="ten">${s.split[0]}</span> = <span class="ten">10</span>`), area);
  setTimeout(() => { area.append(say(s.question.text, { speakNow: false })); ask({ ...s.question, text: `${s.a} + ${s.b}` }, area, { kind: 'input', onDone: () => area.append(nextButton('Quiz time!')) }); }, 300);
}

function renderQuiz(s) {
  note('quiz');
  if (!quiz) quiz = { i: 0, records: [] };
  const q = s.questions[quiz.i];
  stage.append(el('p', 'feedback', `Quiz: ${quiz.i + 1} of ${s.questions.length}`));
  const area = el('div', 'qarea');
  if (q.kind === 'choice') area.append(say(q.text));
  else { area.append(say(`What is ${q.text}?`)); }
  stage.append(area);
  ask(q, area, {
    kind: q.kind,
    onDone: (rec) => {
      quiz.records[quiz.i] = rec;
      const last = quiz.i === s.questions.length - 1;
      const b = el('button', 'go', last ? 'See my stars' : 'Next question');
      b.addEventListener('click', () => { if (last) goTo(step + 1); else { quiz.i++; stage.innerHTML = ''; renderQuiz(s); } });
      area.append(b);
    },
  });
}

function renderResults() {
  note('results');
  const recs = quiz ? quiz.records : [];
  const stars = recs.filter((r) => r.firstTry).length;
  stage.append(say(stars === recs.length ? 'Wow, every one on the first try! You can make 10 like a pro.' : `You earned ${stars} star${stars === 1 ? '' : 's'}! Making 10 gets easier every time.`));
  stage.append(el('p', 'stars', recs.map((r) => `<span class="${r.firstTry ? 'on' : 'off'}">&#9733;</span>`).join('')));
  const list = el('ul', 'review');
  recs.forEach((r) => {
    const how = r.firstTry ? ['&#9733;', 'first try'] : r.revealed ? ['&#8594;', 'we worked it out together'] : ['&#128161;', 'after a hint'];
    const li = el('li', '', `<i>${how[0]}</i><span></span>`);
    li.querySelector('span').textContent = `${r.text} - ${how[1]}`;
    list.append(li);
  });
  stage.append(list);
  const needHelp = recs.filter((r) => !r.firstTry).map((r) => r.text);
  const list2 = needHelp.length > 1 ? needHelp.slice(0, -1).join(', ') + ' and ' + needHelp.at(-1) : needHelp[0];
  stage.append(el('p', 'grownup', needHelp.length
    ? `For grown-ups: worth another go on ${list2}. Making 10 with real objects or fingers first usually helps.`
    : 'For grown-ups: every answer on the first try. Ready for the next lesson.'));
  const row = el('div', 'choices');
  const again = el('button', 'go', 'Play again'); again.addEventListener('click', () => { quiz = null; goTo(0); });
  const home = el('button', 'go soft', 'Lessons'); home.addEventListener('click', showPicker);
  row.append(again, home);
  stage.append(row);
}

// ---------- start ----------
index = await (await fetch('/lessons/index.json')).json();
showPicker();
