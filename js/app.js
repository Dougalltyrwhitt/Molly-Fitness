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
  state.periodOverrides = state.periodOverrides || []; // [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD' }]
  state.personalBests = state.personalBests || {}; // { runKm, sleepScore, steps }
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
  const key = dateKey(d);
  const inOverride = state.periodOverrides.some((o) => key >= o.start && key <= o.end);
  if (inOverride) return true;
  const dom = d.getDate();
  const { periodStartDay, periodEndDay } = state.settings;
  return dom >= periodStartDay && dom <= periodEndDay;
}

function formatShortDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

// One special greeting notification per day, based on what time she first opens the app.
function maybeShowGreetingNotification() {
  const today = dateKey(new Date());
  if (state.lastGreetingShown === today) return;
  const hour = new Date().getHours();
  let msg;
  if (hour < 11) msg = GREETING_MESSAGES.morning;
  else if (hour < 18) msg = GREETING_MESSAGES.midday;
  else msg = GREETING_MESSAGES.night;
  state.lastGreetingShown = today;
  saveState();
  setTimeout(() => showToast(msg), 500);
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
  let isPB = false;
  if (km > (state.personalBests.runKm || 0)) {
    state.personalBests.runKm = km;
    isPB = true;
  }
  saveState();
  return isPB;
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
    const isPB = saveRun(dateKeyStr, km, isNaN(minutes) ? null : minutes);
    showToast(isPB ? `🏆 New personal best! Longest run yet: ${km}km — incredible, tiger!` : pickEncouragement());
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
      const settingScore = state.sleep[key] !== score;
      if (settingScore) {
        state.sleep[key] = score;
        if (score > (state.personalBests.sleepScore || 0)) {
          state.personalBests.sleepScore = score;
          showToast('🏆 New personal best sleep score! Look at you go.');
        }
      } else {
        delete state.sleep[key];
      }
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

stepsInputEl.addEventListener('change', () => {
  const val = parseInt(stepsInputEl.value, 10);
  if (!isNaN(val) && val > (state.personalBests.steps || 0)) {
    state.personalBests.steps = val;
    saveState();
    showToast('🏆 New personal best step count! Go tiger!');
  }
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

// ---------- rewards ----------

function anyRunLoggedInWeek(monday) {
  const sunday = addDays(monday, 6);
  return Object.keys(state.runs).some((k) => {
    const rd = new Date(k + 'T00:00:00');
    return rd >= monday && rd <= sunday;
  });
}

const REWARD_THRESHOLD = 0.75; // earn beard plucks at 75%+ of a week's required tasks

// A week earns the reward once at least REWARD_THRESHOLD of its required
// (non-optional) check tasks are done, skipping days that are period days.
// Weeks made entirely of period days don't count — there was nothing to do.
function weekEarnsReward(monday) {
  let total = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (isPeriodDay(d)) continue;
    const tasks = WEEKLY_PLAN[d.getDay()] || [];
    for (const t of tasks) {
      if (t.kind !== 'check' || t.optional) continue;
      total++;
      if (t.id === 'casual-run') {
        if (anyRunLoggedInWeek(monday)) done++;
      } else if (isDone(d, t.id)) {
        done++;
      }
    }
  }
  return total > 0 && done / total >= REWARD_THRESHOLD;
}

function countRewardWeeks() {
  const startMonday = weekRangeFor(startOfDay(new Date(state.settings.programStart))).monday;
  const thisMonday = weekRangeFor(startOfDay(new Date())).monday;
  let count = 0;
  let cursor = startMonday;
  while (cursor < thisMonday) {
    if (weekEarnsReward(cursor)) count++;
    cursor = addDays(cursor, 7);
  }
  return count;
}

function currentWeekProgress() {
  const today = startOfDay(new Date());
  const { monday } = weekRangeFor(today);
  const daysSoFar = (today.getDay() + 6) % 7; // Mon=0 .. Sun=6
  let total = 0;
  let done = 0;
  for (let i = 0; i <= daysSoFar; i++) {
    const d = addDays(monday, i);
    if (isPeriodDay(d)) continue;
    const tasks = WEEKLY_PLAN[d.getDay()] || [];
    tasks.forEach((t) => {
      if (t.kind !== 'check' || t.optional) return;
      total++;
      if (t.id === 'casual-run') {
        if (anyRunLoggedInWeek(monday)) done++;
      } else if (isDone(d, t.id)) done++;
    });
  }
  return { done, total };
}

function totalMassageCount() {
  return Object.keys(state.completed).filter((k) => k.endsWith('|massage-thu')).length;
}

// ---------- progress charts ----------

function renderBarChart(container, items, opts) {
  opts = opts || {};
  container.innerHTML = '';
  const max = opts.max || Math.max(1, ...items.map((i) => i.value || 0));
  const chart = document.createElement('div');
  chart.className = 'bar-chart';
  items.forEach((item) => {
    const col = document.createElement('div');
    col.className = 'bar-col';

    const valueLabel = document.createElement('div');
    valueLabel.className = 'bar-value';
    valueLabel.textContent = item.value ? (opts.formatValue ? opts.formatValue(item.value) : item.value) : '';
    col.appendChild(valueLabel);

    const bar = document.createElement('div');
    bar.className = 'bar';
    const pct = item.value ? Math.max(4, Math.round((item.value / max) * 100)) : 2;
    bar.style.height = pct + '%';
    if (opts.barColor) bar.style.background = opts.barColor(item.value);
    col.appendChild(bar);

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = item.label;
    col.appendChild(label);

    chart.appendChild(col);
  });
  container.appendChild(chart);
}

function last14Days() {
  const today = startOfDay(new Date());
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
  return days;
}

function renderProgress() {
  // Runs
  const runs = Object.keys(state.runs)
    .map((k) => Object.assign({ dateKey: k, date: new Date(k + 'T00:00:00') }, state.runs[k]))
    .sort((a, b) => a.date - b.date)
    .slice(-8);
  const runChartEl = document.getElementById('run-chart');
  const runListEl = document.getElementById('run-log-list');
  if (runs.length === 0) {
    runChartEl.innerHTML = '<div class="fine-print">No runs logged yet — once you log one, it\'ll show up here.</div>';
    runListEl.innerHTML = '';
  } else {
    renderBarChart(runChartEl, runs.map((r) => ({
      label: r.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: r.km,
    })), { formatValue: (v) => v + 'km' });
    runListEl.innerHTML = '';
    runs.slice().reverse().forEach((r) => {
      const row = document.createElement('div');
      row.className = 'run-log-row';
      row.textContent = `${r.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — ${r.km}km${r.minutes ? ' in ' + r.minutes + ' min' : ''}`;
      runListEl.appendChild(row);
    });
  }

  // Sleep
  const sleepChartEl = document.getElementById('sleep-chart');
  renderBarChart(sleepChartEl, last14Days().map((d) => ({
    label: d.getDate(),
    value: state.sleep[dateKey(d)] || 0,
  })), {
    max: 5,
    barColor: (v) => (v >= 4 ? 'var(--green)' : v >= 3 ? 'var(--yellow-deep)' : 'var(--pink)'),
  });

  // Steps
  const stepsChartEl = document.getElementById('steps-chart');
  const goal = state.settings.stepGoal;
  renderBarChart(stepsChartEl, last14Days().map((d) => ({
    label: d.getDate(),
    value: state.steps[dateKey(d)] || 0,
  })), {
    max: Math.max(goal, ...Object.values(state.steps)),
    formatValue: (v) => (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : v),
    barColor: (v) => (v >= goal ? 'var(--green)' : 'var(--yellow-deep)'),
  });

  // Massages
  const massageCountEl = document.getElementById('massage-count');
  massageCountEl.textContent = `${totalMassageCount()} logged so far 💆‍♀️`;
  const massageDotsEl = document.getElementById('massage-dots');
  massageDotsEl.innerHTML = '';
  const thisMonday = weekRangeFor(startOfDay(new Date())).monday;
  for (let i = 7; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i);
    const sunday = addDays(monday, 6);
    let had = false;
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d);
      if (day > startOfDay(new Date())) break;
      if (state.completed[taskKey(day, 'massage-thu')]) had = true;
    }
    const dot = document.createElement('div');
    dot.className = 'massage-dot' + (had ? ' filled' : '');
    dot.title = `${formatShortDate(dateKey(monday))} – ${formatShortDate(dateKey(sunday))}`;
    massageDotsEl.appendChild(dot);
  }

  // Rewards
  const rewardWeeks = countRewardWeeks();
  document.getElementById('beard-plucks-count').textContent = rewardWeeks * 5;
  document.getElementById('perfect-weeks-count').textContent = rewardWeeks;
  const { done, total } = currentWeekProgress();
  document.getElementById('week-progress-label').textContent = total ? `${done}/${total} tasks done this week so far` : 'Nothing required yet this week';
  const wpct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('week-progress-fill').style.width = wpct + '%';
}

// ---------- settings ----------

const periodStartInput = document.getElementById('period-start-input');
const periodEndInput = document.getElementById('period-end-input');
const recoveryEveryInput = document.getElementById('recovery-every-input');
const runStartInput = document.getElementById('run-start-input');
const stepGoalInput = document.getElementById('step-goal-input');
const resetBtn = document.getElementById('reset-btn');

const overrideStartInput = document.getElementById('period-override-start');
const overrideEndInput = document.getElementById('period-override-end');
const overrideAddBtn = document.getElementById('period-override-add-btn');
const overrideListEl = document.getElementById('period-override-list');

function renderPeriodOverrides() {
  overrideListEl.innerHTML = '';
  state.periodOverrides
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .forEach((o) => {
      const row = document.createElement('div');
      row.className = 'override-row';
      const text = document.createElement('span');
      text.textContent = o.start === o.end ? formatShortDate(o.start) : `${formatShortDate(o.start)} – ${formatShortDate(o.end)}`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'link-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        state.periodOverrides = state.periodOverrides.filter((x) => x !== o);
        saveState();
        renderPeriodOverrides();
        renderToday();
        renderWeek();
      });
      row.appendChild(text);
      row.appendChild(removeBtn);
      overrideListEl.appendChild(row);
    });
}

overrideAddBtn.addEventListener('click', () => {
  const start = overrideStartInput.value;
  if (!start) return;
  const end = overrideEndInput.value && overrideEndInput.value >= start ? overrideEndInput.value : start;
  state.periodOverrides.push({ start, end });
  saveState();
  overrideStartInput.value = '';
  overrideEndInput.value = '';
  renderPeriodOverrides();
  renderToday();
  renderWeek();
});

function renderSettings() {
  periodStartInput.value = state.settings.periodStartDay;
  periodEndInput.value = state.settings.periodEndDay;
  recoveryEveryInput.value = state.settings.recoveryEvery;
  runStartInput.value = state.settings.runStartKm;
  stepGoalInput.value = state.settings.stepGoal;
  renderPeriodOverrides();
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
  progress: document.getElementById('panel-progress'),
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
    if (btn.dataset.tab === 'progress') renderProgress();
    if (btn.dataset.tab === 'wellness') renderWellness();
    if (btn.dataset.tab === 'settings') renderSettings();
  });
});

function renderAll() {
  renderToday();
  renderWeek();
  renderProgress();
  renderWellness();
  renderSettings();
}

renderAll();
maybeShowGreetingNotification();

// ---------- service worker ----------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
