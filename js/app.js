// Happy Tiger — all app logic. No frameworks, no build step, just a
// small static PWA that lives happily on a home screen.

const STORAGE_KEY = 'happyTigerState.v1';

const DEFAULT_SETTINGS = {
  periodStartDay: 12, // day-of-month
  periodEndDay: 16, // day-of-month, inclusive
  recoveryEvery: 3, // every N weeks is a recovery week
  runStartKm: 3,
  runIncrementKm: 0.5,
  runCapKm: 8,
  stepGoal: 8000,
  programStart: null, // ISO date string, set on first load
};

function loadState() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    raw = null;
  }
  const state = raw || {};
  state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
  state.completed = state.completed || {}; // "YYYY-MM-DD|taskId" -> true
  state.sleep = state.sleep || {}; // "YYYY-MM-DD" -> 1-5
  state.steps = state.steps || {}; // "YYYY-MM-DD" -> number
  state.wellness = state.wellness || {}; // "YYYY-Www" -> { reading:bool, swim:bool }
  state.runs = state.runs || {}; // "YYYY-MM-DD" -> { km:number, minutes:number|null }
  if (!state.settings.programStart) {
    state.settings.programStart = dateKey(new Date());
  }
  return state;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
saveState();

// ---------- date helpers ----------

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

// ISO-ish week key, good enough for "reset weekly" purposes.
function weekKey(d) {
  const c = startOfDay(d);
  const day = (c.getDay() + 6) % 7; // Mon = 0
  const monday = addDays(c, -day);
  return dateKey(monday);
}

function isPeriodDay(d) {
  const dom = d.getDate();
  const { periodStartDay, periodEndDay } = state.settings;
  return dom >= periodStartDay && dom <= periodEndDay;
}

function weekNumberFor(d) {
  const start = startOfDay(new Date(state.settings.programStart));
  const target = startOfDay(d);
  const diffDays = Math.round((target - start) / 86400000);
  return Math.max(0, Math.floor(diffDays / 7));
}

function isRecoveryWeek(weekNumber) {
  const n = state.settings.recoveryEvery;
  return weekNumber > 0 && weekNumber % n === 0;
}

function computeRunGoalKm(weekNumber) {
  const { runStartKm, runIncrementKm, runCapKm } = state.settings;
  let km = runStartKm;
  for (let w = 1; w <= weekNumber; w++) {
    if (isRecoveryWeek(w)) continue; // recovery weeks don't add distance
    km += runIncrementKm;
  }
  return Math.min(km, runCapKm);
}

function runGoalText(d) {
  const wn = weekNumberFor(d);
  if (isRecoveryWeek(wn)) {
    return 'Recovery week 🌤️ — totally optional, maybe an easy 2km stroll or just skip it.';
  }
  const km = computeRunGoalKm(wn);
  return `Slow & casual, no watch-checking required. Distance goal: ~${km}km — enjoy it, that's the whole point.`;
}

// ---------- rendering ----------

const greetingEl = document.getElementById('greeting');
const dateLabelEl = document.getElementById('date-label');
const recoveryBannerEl = document.getElementById('recovery-banner');
const taskListEl = document.getElementById('task-list');
const toastEl = document.getElementById('toast');

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning, tiger 🌅';
  if (h < 17) return 'Afternoon, tiger ☀️';
  return 'Evening, tiger 🌙';
}

function renderHeader(today) {
  greetingEl.textContent = greetingForNow();
  dateLabelEl.textContent = today.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function taskKey(d, id) {
  return `${dateKey(d)}|${id}`;
}

function isDone(d, id) {
  return !!state.completed[taskKey(d, id)];
}

function toggleTask(d, id) {
  const key = taskKey(d, id);
  const nowDone = !state.completed[key];
  if (nowDone) {
    state.completed[key] = true;
  } else {
    delete state.completed[key];
  }
  saveState();
  if (nowDone) showToast(pickEncouragement());
}

function pickEncouragement() {
  return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
}

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

function taskCard(d, task) {
  const wrap = document.createElement('div');
  wrap.className = 'card task' + (task.kind === 'info' ? ' info' : '');

  const icon = document.createElement('div');
  icon.className = 'task-icon';
  icon.textContent = task.icon;
  wrap.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'task-body';
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;
  if (task.optional) {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = 'optional';
    title.appendChild(pill);
  }
  const subtitle = document.createElement('div');
  subtitle.className = 'task-subtitle';
  subtitle.textContent = task.subtitle;
  body.appendChild(title);
  body.appendChild(subtitle);
  wrap.appendChild(body);

  if (task.kind === 'check') {
    const btn = document.createElement('button');
    btn.className = 'check-btn';
    const done = isDone(d, task.id);
    btn.classList.toggle('done', done);
    btn.setAttribute('aria-label', done ? 'Mark not done' : 'Mark done');
    btn.textContent = done ? '✓' : '';
    btn.addEventListener('click', () => {
      toggleTask(d, task.id);
      renderToday();
    });
    wrap.appendChild(btn);
  }

  return wrap;
}

// ---------- run logging (any day, not just the scheduled one) ----------

function weekRangeFor(d) {
  const start = startOfDay(d);
  const day = (start.getDay() + 6) % 7; // Mon = 0
  const monday = addDays(start, -day);
  const sunday = addDays(monday, 6);
  return { monday, sunday };
}

function runsInWeekOf(d) {
  const { monday, sunday } = weekRangeFor(d);
  const results = [];
  Object.keys(state.runs).forEach((key) => {
    const rd = new Date(key + 'T00:00:00');
    if (rd >= monday && rd <= sunday) {
      results.push(Object.assign({ dateKey: key, date: rd }, state.runs[key]));
    }
  });
  results.sort((a, b) => a.date - b.date);
  return results;
}

function saveRun(dateKeyStr, km, minutes) {
  state.runs[dateKeyStr] = { km, minutes: minutes || null };
  saveState();
}

function runLogForm(dateKeyStr, onSaved) {
  const wrap = document.createElement('div');
  wrap.className = 'run-form';

  const row = document.createElement('div');
  row.className = 'run-form-row';

  const kmLabel = document.createElement('label');
  kmLabel.textContent = 'Distance (km)';
  const kmInput = document.createElement('input');
  kmInput.type = 'number';
  kmInput.min = '0';
  kmInput.step = '0.1';
  kmInput.inputMode = 'decimal';
  kmLabel.appendChild(kmInput);

  const minLabel = document.createElement('label');
  minLabel.textContent = 'Time (min)';
  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.min = '0';
  minInput.step = '1';
  minInput.inputMode = 'numeric';
  minLabel.appendChild(minInput);

  row.appendChild(kmLabel);
  row.appendChild(minLabel);
  wrap.appendChild(row);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'run-save-btn';
  saveBtn.textContent = 'Log it';
  saveBtn.addEventListener('click', () => {
    const km = parseFloat(kmInput.value);
    if (isNaN(km) || km <= 0) {
      kmInput.focus();
      return;
    }
    const minutes = parseInt(minInput.value, 10);
    saveRun(dateKeyStr, km, isNaN(minutes) ? null : minutes);
    showToast(pickEncouragement());
    onSaved();
  });
  wrap.appendChild(saveBtn);

  return wrap;
}

function casualRunCard(d) {
  const wrap = document.createElement('div');
  wrap.className = 'card task task-run';

  const head = document.createElement('div');
  head.className = 'task';
  const icon = document.createElement('div');
  icon.className = 'task-icon';
  icon.textContent = '👟';
  head.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'task-body';
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = 'Easy run';
  body.appendChild(title);
  const subtitle = document.createElement('div');
  subtitle.className = 'task-subtitle';
  body.appendChild(subtitle);
  head.appendChild(body);
  wrap.appendChild(head);

  const todayKey = dateKey(d);
  const ownRun = state.runs[todayKey];
  const otherRuns = runsInWeekOf(d).filter((r) => r.dateKey !== todayKey);

  if (ownRun) {
    subtitle.textContent = `Logged: ${ownRun.km}km${ownRun.minutes ? ' in ' + ownRun.minutes + ' min' : ''}. Nice one, tiger 🎉`;
  } else if (otherRuns.length > 0) {
    const r = otherRuns[otherRuns.length - 1];
    subtitle.textContent = `You already had a great run this week — ${r.km}km on ${WEEKDAY_NAMES[r.date.getDay()]}. Today can just be a bonus rest, unless you fancy another 🐯`;
    const extraBtn = document.createElement('button');
    extraBtn.className = 'link-btn';
    extraBtn.textContent = 'Log another run today anyway';
    extraBtn.addEventListener('click', () => {
      extraBtn.remove();
      wrap.appendChild(runLogForm(todayKey, renderToday));
    });
    wrap.appendChild(extraBtn);
  } else {
    subtitle.textContent = runGoalText(d);
    wrap.appendChild(runLogForm(todayKey, renderToday));
  }

  return wrap;
}

function renderExtraRunCard(d) {
  const container = document.getElementById('extra-run-card');
  container.innerHTML = '';

  // Saturday's scheduled run already has its own logging UI.
  if (d.getDay() === 6) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const heading = document.createElement('div');
  heading.className = 'card-heading';
  heading.textContent = '🏃 Log a run today';
  container.appendChild(heading);

  const key = dateKey(d);
  const existing = state.runs[key];

  if (existing) {
    const p = document.createElement('div');
    p.className = 'task-subtitle';
    p.textContent = `Logged: ${existing.km}km${existing.minutes ? ' in ' + existing.minutes + ' min' : ''} 🎉`;
    container.appendChild(p);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'link-btn';
    removeBtn.textContent = 'Remove log';
    removeBtn.addEventListener('click', () => {
      delete state.runs[key];
      saveState();
      renderToday();
    });
    container.appendChild(removeBtn);
  } else {
    const note = document.createElement('div');
    note.className = 'fine-print';
    note.textContent = "Ran on a different day than planned? Log it here and Saturday's run will know about it.";
    container.appendChild(note);
    container.appendChild(runLogForm(key, renderToday));
  }
}

function renderToday() {
  const today = new Date();
  renderHeader(today);
  taskListEl.innerHTML = '';

  if (isPeriodDay(today)) {
    recoveryBannerEl.classList.add('hidden');
    document.getElementById('extra-run-card').classList.add('hidden');
    const card = document.createElement('div');
    card.className = 'card period-card';
    card.textContent = PERIOD_MESSAGES[Math.floor(Math.random() * PERIOD_MESSAGES.length)];
    taskListEl.appendChild(card);
    renderSleepAndSteps(today);
    return;
  }

  const wn = weekNumberFor(today);
  if (isRecoveryWeek(wn)) {
    recoveryBannerEl.textContent = "🌤️ Recovery week — everything's a notch easier. Go gentle on yourself.";
    recoveryBannerEl.classList.remove('hidden');
  } else {
    recoveryBannerEl.classList.add('hidden');
  }

  const tasks = WEEKLY_PLAN[today.getDay()] || [];
  tasks.forEach((t) => {
    taskListEl.appendChild(t.id === 'casual-run' ? casualRunCard(today) : taskCard(today, t));
  });

  renderExtraRunCard(today);
  renderSleepAndSteps(today);
}

// ---------- sleep + steps ----------

const sleepRowEl = document.getElementById('sleep-row');
const stepsInputEl = document.getElementById('steps-input');
const stepsBarEl = document.getElementById('steps-bar');

const SLEEP_FACES = ['😫', '😐', '🙂', '😃', '🤩'];

function renderSleepAndSteps(today) {
  const key = dateKey(today);
  sleepRowEl.innerHTML = '';
  SLEEP_FACES.forEach((face, i) => {
    const score = i + 1;
    const btn = document.createElement('button');
    btn.className = 'sleep-face';
    btn.textContent = face;
    btn.classList.toggle('selected', state.sleep[key] === score);
    btn.addEventListener('click', () => {
      state.sleep[key] = state.sleep[key] === score ? undefined : score;
      if (!state.sleep[key]) delete state.sleep[key];
      saveState();
      renderSleepAndSteps(today);
    });
    sleepRowEl.appendChild(btn);
  });

  stepsInputEl.value = state.steps[key] || '';
  const pct = Math.min(100, Math.round(((state.steps[key] || 0) / state.settings.stepGoal) * 100));
  stepsBarEl.style.width = pct + '%';
}

stepsInputEl.addEventListener('input', () => {
  const today = new Date();
  const key = dateKey(today);
  const val = parseInt(stepsInputEl.value, 10);
  if (!isNaN(val) && val >= 0) {
    state.steps[key] = val;
  } else {
    delete state.steps[key];
  }
  saveState();
  const pct = Math.min(100, Math.round(((state.steps[key] || 0) / state.settings.stepGoal) * 100));
  stepsBarEl.style.width = pct + '%';
});

// ---------- week view ----------

const weekGridEl = document.getElementById('week-grid');

function renderWeek() {
  weekGridEl.innerHTML = '';
  const today = startOfDay(new Date());
  const day = (today.getDay() + 6) % 7; // Mon=0
  const monday = addDays(today, -day);

  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const col = document.createElement('div');
    col.className = 'week-day' + (dateKey(d) === dateKey(today) ? ' is-today' : '');

    const heading = document.createElement('div');
    heading.className = 'week-day-heading';
    heading.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    col.appendChild(heading);

    if (isPeriodDay(d)) {
      const tag = document.createElement('div');
      tag.className = 'week-tag period';
      tag.textContent = 'Rest — period';
      col.appendChild(tag);
    } else {
      const wn = weekNumberFor(d);
      if (isRecoveryWeek(wn)) {
        const tag = document.createElement('div');
        tag.className = 'week-tag recovery';
        tag.textContent = 'Recovery week';
        col.appendChild(tag);
      }
      const tasks = WEEKLY_PLAN[d.getDay()] || [];
      tasks.forEach((t) => {
        const row = document.createElement('div');
        if (t.id === 'casual-run') {
          const key = dateKey(d);
          const ownRun = state.runs[key];
          const otherRuns = runsInWeekOf(d).filter((r) => r.dateKey !== key);
          if (ownRun) {
            row.className = 'week-task done';
            row.textContent = `👟 Logged ${ownRun.km}km`;
          } else if (otherRuns.length > 0) {
            row.className = 'week-task done';
            row.textContent = '🎉 Already ran this week';
          } else {
            row.className = 'week-task';
            row.textContent = `${t.icon} ${t.title}`;
          }
        } else {
          row.className = 'week-task' + (t.kind === 'check' && isDone(d, t.id) ? ' done' : '');
          row.textContent = `${t.icon} ${t.title}`;
        }
        col.appendChild(row);
      });
      if (d.getDay() !== 6 && state.runs[dateKey(d)]) {
        const row = document.createElement('div');
        row.className = 'week-task done';
        row.textContent = `🏃 Logged ${state.runs[dateKey(d)].km}km`;
        col.appendChild(row);
      }
    }

    weekGridEl.appendChild(col);
  }
}

// ---------- wellness ----------

const readingCheckEl = document.getElementById('reading-check');
const swimCheckEl = document.getElementById('swim-check');
const swimReminderEl = document.getElementById('swim-reminder');

function renderWellness() {
  const today = new Date();
  const wk = weekKey(today);
  const w = state.wellness[wk] || {};

  readingCheckEl.checked = !!w.reading;
  swimCheckEl.checked = !!w.swim;

  const dow = today.getDay(); // 0 Sun .. 6 Sat
  const lateInWeek = dow === 0 || dow >= 5; // Fri, Sat, Sun
  if (!w.swim && lateInWeek && !isPeriodDay(today)) {
    swimReminderEl.textContent = "Haven't had a swim this week — no pressure, but a dip could be nice before the week's out 🏊💛";
    swimReminderEl.classList.remove('hidden');
  } else {
    swimReminderEl.classList.add('hidden');
  }
}

function setWellness(field, val) {
  const wk = weekKey(new Date());
  state.wellness[wk] = Object.assign({}, state.wellness[wk], { [field]: val });
  saveState();
  renderWellness();
}

readingCheckEl.addEventListener('change', () => setWellness('reading', readingCheckEl.checked));
swimCheckEl.addEventListener('change', () => setWellness('swim', swimCheckEl.checked));

// ---------- settings ----------

const periodStartInput = document.getElementById('period-start-input');
const periodEndInput = document.getElementById('period-end-input');
const recoveryEveryInput = document.getElementById('recovery-every-input');
const runStartInput = document.getElementById('run-start-input');
const stepGoalInput = document.getElementById('step-goal-input');
const resetBtn = document.getElementById('reset-btn');

function renderSettings() {
  periodStartInput.value = state.settings.periodStartDay;
  periodEndInput.value = state.settings.periodEndDay;
  recoveryEveryInput.value = state.settings.recoveryEvery;
  runStartInput.value = state.settings.runStartKm;
  stepGoalInput.value = state.settings.stepGoal;
}

function bindSettingNumber(input, key, min, max) {
  input.addEventListener('change', () => {
    let v = parseFloat(input.value);
    if (isNaN(v)) v = DEFAULT_SETTINGS[key];
    v = Math.min(max, Math.max(min, v));
    state.settings[key] = v;
    saveState();
    renderSettings();
    renderToday();
    renderWeek();
  });
}

bindSettingNumber(periodStartInput, 'periodStartDay', 1, 31);
bindSettingNumber(periodEndInput, 'periodEndDay', 1, 31);
bindSettingNumber(recoveryEveryInput, 'recoveryEvery', 2, 6);
bindSettingNumber(runStartInput, 'runStartKm', 1, 20);
bindSettingNumber(stepGoalInput, 'stepGoal', 1000, 30000);

resetBtn.addEventListener('click', () => {
  if (confirm('Reset all Happy Tiger data on this device? This clears completed tasks, sleep, steps and wellness logs.')) {
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    saveState();
    renderAll();
  }
});

// ---------- tabs ----------

const tabs = document.querySelectorAll('.tab-btn');
const panels = {
  today: document.getElementById('panel-today'),
  week: document.getElementById('panel-week'),
  wellness: document.getElementById('panel-wellness'),
  settings: document.getElementById('panel-settings'),
};

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(panels).forEach((p) => p.classList.add('hidden'));
    panels[btn.dataset.tab].classList.remove('hidden');
    if (btn.dataset.tab === 'week') renderWeek();
    if (btn.dataset.tab === 'wellness') renderWellness();
    if (btn.dataset.tab === 'settings') renderSettings();
  });
});

function renderAll() {
  renderToday();
  renderWeek();
  renderWellness();
  renderSettings();
}

renderAll();

// ---------- service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
