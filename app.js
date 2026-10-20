import { PITCH, createRoutineDeck, createScenario, triggerPass, stepSimulation } from './simulation.js';
import { renderPitch } from './renderer.js';

const TOTAL_REPS = 10;
const REP_END_COOLDOWN_MS = 650;
const ACTION_DEBOUNCE_MS = 350;

const POINTS = {
  TRY: 10,
  TACKLED: -2,
  FORWARD_PASS: -5,
  MISSED_PASS: -5,
  INTERCEPTED: -10,
};

const OUTCOME_META = {
  TRY: { tag: '+10', label: 'TRY', cls: 'try' },
  TACKLED: { tag: '-2', label: 'TKL', cls: 'tackle' },
  FORWARD_PASS: { tag: '-5', label: 'FWD', cls: 'error' },
  MISSED_PASS: { tag: '-5', label: 'OUT', cls: 'error' },
  INTERCEPTED: { tag: '-10', label: 'INT', cls: 'intercept' },
};

const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');
canvas.width = PITCH.WIDTH;
canvas.height = PITCH.HEIGHT;

const statusBanner = document.getElementById('status-banner');
const repHistoryEl = document.getElementById('rep-history');
const welcomeOverlay = document.getElementById('welcome-overlay');
const welcomeStartBtn = document.getElementById('welcome-start-btn');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultDetail = document.getElementById('result-detail');
const resultList = document.getElementById('result-list');
const resultTip = document.getElementById('result-tip');
const resultHint = document.getElementById('result-hint');
const resultRestartBtn = document.getElementById('result-restart-btn');
const actionBtn = document.getElementById('action-btn');
const resetBtn = document.getElementById('reset-btn');
const pointsEl = document.getElementById('score-points');
const repsEl = document.getElementById('score-reps');

let stats = createInitialStats();
let state = createScenario(stats.deck[0]);
let lastRepDelta = 0;
let lockedUntil = 0;
let cooldownTimer = null;

function createInitialStats() {
  return {
    points: 0,
    tries: 0,
    reps: 0,
    carrierTackled: 0,
    supportTackled: 0,
    intercepted: 0,
    history: [],
    deck: createRoutineDeck(),
  };
}

function setCooldown(ms) {
  lockedUntil = performance.now() + ms;
  actionBtn.disabled = true;
  resultRestartBtn.disabled = true;
  welcomeStartBtn.disabled = true;
  if (cooldownTimer) clearTimeout(cooldownTimer);
  cooldownTimer = setTimeout(() => {
    actionBtn.disabled = false;
    resultRestartBtn.disabled = false;
    welcomeStartBtn.disabled = false;
  }, ms);
}

function isLocked() {
  return performance.now() < lockedUntil;
}

function formatDelta(pts) {
  return pts > 0 ? `+${pts} PTS` : `${pts} PTS`;
}

function renderRepHistory() {
  repHistoryEl.innerHTML = '';
  for (let i = 0; i < TOTAL_REPS; i++) {
    const item = stats.history[i];
    const chip = document.createElement('div');

    if (item) {
      const meta = OUTCOME_META[item.status] || { tag: '0', label: 'END', cls: '' };
      chip.className = `rep-chip ${meta.cls}`;
      chip.title = `Rep ${i + 1}: ${item.reason}`;
      chip.innerHTML = `<span class="rep-num">#${i + 1}</span><span class="rep-tag">${meta.label}</span>`;
    } else {
      const isCurrent = i === stats.reps && state.status === 'RUNNING';
      chip.className = `rep-chip ${isCurrent ? 'active' : ''}`;
      chip.innerHTML = `<span class="rep-num">#${i + 1}</span><span class="rep-tag">&mdash;</span>`;
    }

    repHistoryEl.appendChild(chip);
  }
}

function renderFinalResultList() {
  const tackles = stats.carrierTackled + stats.supportTackled;
  resultList.innerHTML = `
    <div class="summary-box try">
      <span class="summary-count">${stats.tries}</span>
      <span class="summary-label">Tries (+10)</span>
    </div>
    <div class="summary-box tackle">
      <span class="summary-count">${tackles}</span>
      <span class="summary-label">Tackled (-2)</span>
    </div>
    <div class="summary-box intercept">
      <span class="summary-count">${stats.intercepted}</span>
      <span class="summary-label">Intercept (-10)</span>
    </div>
  `;
}

function getRoutineTip() {
  if (stats.intercepted > 0) {
    return 'Tip: If the defender jumps into the pass lane, keep the ball and run straight.';
  }
  if (stats.tries >= 9) {
    return 'Tip: Great timing. You read the defender cleanly all session.';
  }
  if (stats.carrierTackled >= stats.supportTackled && stats.carrierTackled > 0) {
    return 'Tip: You held the ball too long. Pass just before the defender reaches you.';
  }
  if (stats.supportTackled > 0) {
    return 'Tip: If the defender drifts to your support runner early, don’t pass—run it yourself.';
  }
  return 'Tip: Commit the defender first, then pass into space.';
}

function updateUI() {
  pointsEl.textContent = stats.points;
  repsEl.textContent = stats.reps;
  renderRepHistory();

  if (state.status === 'READY') {
    statusBanner.textContent = '10-Rep Routine — Try +10 | Tackle -2 | Intercept -10';
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Start Routine';
  } else if (state.status === 'RUNNING') {
    statusBanner.textContent = state.carrier.hasBall
      ? `Rep ${stats.reps + 1}/${TOTAL_REPS} — Read the defender: TAP / SPACE to pass`
      : `Rep ${stats.reps + 1}/${TOTAL_REPS} — Ball released...`;
    statusBanner.className = 'banner running';
    welcomeOverlay.className = 'result-overlay hidden';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Pass Ball';
  } else if (stats.reps >= TOTAL_REPS) {
    const isStrong = stats.points >= 60;
    statusBanner.textContent = `Routine Complete (${state.status.replace('_', ' ')}: ${formatDelta(lastRepDelta)})`;
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay hidden';
    resultTitle.textContent = `FINAL SCORE: ${stats.points} PTS`;
    resultDetail.textContent = '10-Rep Totals';
    renderFinalResultList();
    resultList.className = 'result-list';
    resultTip.textContent = getRoutineTip();
    resultTip.className = 'result-tip';
    resultHint.className = 'result-hint hidden';
    resultRestartBtn.className = 'result-restart-btn';
    resultOverlay.className = `result-overlay ${isStrong ? 'success' : 'fail'}`;
    actionBtn.textContent = 'Routine Complete';
    actionBtn.disabled = true;
  } else {
    const isSuccess = state.status === 'TRY';
    statusBanner.textContent = `Rep ${stats.reps}/${TOTAL_REPS} complete`;
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay hidden';
    resultTitle.textContent = `${state.status.replace('_', ' ')} (${formatDelta(lastRepDelta)})`;
    resultDetail.textContent = state.outcomeReason;
    resultList.className = 'result-list hidden';
    resultTip.className = 'result-tip hidden';
    resultHint.textContent = `Tap or press SPACE for Rep ${stats.reps + 1}/${TOTAL_REPS}`;
    resultHint.className = 'result-hint';
    resultRestartBtn.className = 'result-restart-btn hidden';
    resultOverlay.className = `result-overlay ${isSuccess ? 'success' : 'fail'}`;
    actionBtn.textContent = `Next Rep (${stats.reps + 1}/${TOTAL_REPS})`;
  }
}

function handlePrimaryAction() {
  if (isLocked()) return;

  if (state.status === 'READY') {
    state.status = 'RUNNING';
    setCooldown(ACTION_DEBOUNCE_MS);
    updateUI();
  } else if (state.status === 'RUNNING') {
    if (state.carrier.hasBall) {
      triggerPass(state);
      setCooldown(ACTION_DEBOUNCE_MS);
      updateUI();
    }
  } else if (stats.reps < TOTAL_REPS) {
    state = createScenario(stats.deck[stats.reps]);
    state.status = 'RUNNING';
    setCooldown(ACTION_DEBOUNCE_MS);
    updateUI();
  }
}

function startNewRoutine() {
  if (isLocked()) return;
  stats = createInitialStats();
  state = createScenario(stats.deck[0]);
  state.status = 'RUNNING';
  setCooldown(ACTION_DEBOUNCE_MS);
  updateUI();
}

function resetRoutine() {
  if (isLocked()) return;
  stats = createInitialStats();
  state = createScenario(stats.deck[0]);
  setCooldown(ACTION_DEBOUNCE_MS);
  updateUI();
}

actionBtn.addEventListener('click', handlePrimaryAction);
resetBtn.addEventListener('click', resetRoutine);
welcomeStartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  handlePrimaryAction();
});
resultRestartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startNewRoutine();
});
canvas.parentElement.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  e.preventDefault();
  if (stats.reps >= TOTAL_REPS && state.status !== 'RUNNING') return;
  handlePrimaryAction();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (stats.reps >= TOTAL_REPS && state.status !== 'RUNNING') return;
    handlePrimaryAction();
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    resetRoutine();
  }
});

function loop() {
  const prevStatus = state.status;
  stepSimulation(state);

  if (prevStatus === 'RUNNING' && state.status !== 'RUNNING') {
    stats.reps += 1;
    lastRepDelta = POINTS[state.status] ?? 0;
    stats.points += lastRepDelta;
    stats.history.push({
      status: state.status,
      reason: state.outcomeReason,
      delta: lastRepDelta,
    });

    if (state.status === 'TRY') {
      stats.tries += 1;
    } else if (state.status === 'TACKLED') {
      if (state.outcomeReason.startsWith('Carrier')) {
        stats.carrierTackled += 1;
      } else {
        stats.supportTackled += 1;
      }
    } else if (state.status === 'INTERCEPTED') {
      stats.intercepted += 1;
    }

    setCooldown(REP_END_COOLDOWN_MS);
    updateUI();
  }

  renderPitch(ctx, state);
  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);
