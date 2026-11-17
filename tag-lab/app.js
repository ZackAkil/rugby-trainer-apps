import {
  initMuteButton,
  createCooldownController,
  toCanvasCoords,
  renderRepChips,
  renderBreakdownList,
  renderSummaryBoxes,
  startFixedLoop,
} from '../shared/ui.js';
import {
  unlockAudio,
  playCountdownTick,
  playCatchSlow,
  playTag,
  playError,
} from '../shared/audio.js';
import {
  PITCH,
  createRoutineDeck,
  createScenario,
  stepSimulation,
} from './simulation.js';
import { renderPitch } from './renderer.js';

const TOTAL_REPS = 10;
const REP_END_COOLDOWN_MS = 650;

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
const resultBreakdown = document.getElementById('result-breakdown');
const resultList = document.getElementById('result-list');
const resultTip = document.getElementById('result-tip');
const resultHint = document.getElementById('result-hint');
const resultRestartBtn = document.getElementById('result-restart-btn');
const actionBtn = document.getElementById('action-btn');
const resetBtn = document.getElementById('reset-btn');
const pointsEl = document.getElementById('score-points');
const repsEl = document.getElementById('score-reps');
initMuteButton(document.getElementById('mute-btn'));

let stats = createInitialStats();
let state = createScenario(stats.deck[0]);
const keysDown = new Set();
const pointer = { active: false, x: null, y: null };

const { isLocked, setCooldown } = createCooldownController(syncButtonsDisabled);

function createInitialStats() {
  return {
    points: 0,
    tags: 0,
    misses: 0,
    whiffs: 0,
    reps: 0,
    totalRelSpeed: 0,
    history: [],
    deck: createRoutineDeck(),
  };
}

function syncButtonsDisabled() {
  const coolingDown = isLocked();
  const inPlay = state.status === 'COUNTDOWN' || state.status === 'RUNNING' || state.status === 'TAG_ANIM';
  const routineDone = state.status !== 'READY' && stats.reps >= TOTAL_REPS;

  actionBtn.disabled = coolingDown || inPlay || routineDone;
  resultRestartBtn.disabled = coolingDown;
  welcomeStartBtn.disabled = coolingDown;
}

function getMovementInput() {
  let moveX = 0;
  let moveY = 0;
  if (keysDown.has('ArrowLeft') || keysDown.has('KeyA')) moveX -= 1;
  if (keysDown.has('ArrowRight') || keysDown.has('KeyD')) moveX += 1;
  if (keysDown.has('ArrowUp') || keysDown.has('KeyW')) moveY -= 1;
  if (keysDown.has('ArrowDown') || keysDown.has('KeyS')) moveY += 1;

  return {
    moveX,
    moveY,
    pointerActive: pointer.active,
    targetX: pointer.x,
    targetY: pointer.y,
  };
}

function updateUI() {
  repsEl.textContent = stats.reps;
  pointsEl.textContent = stats.points;

  renderRepChips(
    repHistoryEl,
    TOTAL_REPS,
    stats.history,
    stats.reps,
    state.status === 'COUNTDOWN' || state.status === 'RUNNING' || state.status === 'TAG_ANIM',
    (item) => {
      if (item.outcome === 'MISSED') {
        return {
          cls: 'error',
          tag: item.whiffedTooFast ? 'MISS' : 'TRY',
          title: `${item.pattern}: ${item.whiffedTooFast ? 'Missed Tag (Too Fast)' : 'Try Conceded'}`,
        };
      }
      const cls = item.score >= 8 ? 'try' : item.score >= 5 ? 'tackle' : 'error';
      return { cls, tag: `${item.score}`, title: `${item.pattern}: ${item.score}/10` };
    }
  );

  if (state.status === 'READY') {
    statusBanner.className = 'banner neutral';
    statusBanner.textContent = `Rep ${stats.reps + 1}/${TOTAL_REPS} — Press START or SPACE`;
    actionBtn.textContent = stats.reps === 0 ? 'Start Routine' : 'Next Rep (SPACE)';
  } else if (state.status === 'COUNTDOWN') {
    statusBanner.className = 'banner neutral';
    statusBanner.textContent = `Get ready to press... (${state.countdownStep})`;
  } else if (state.status === 'RUNNING') {
    if (state.missedSwipePos) {
      statusBanner.className = 'banner error';
      statusBanner.textContent = 'MISSED TAG (TOO FAST!) — Attacker broke through!';
    } else {
      statusBanner.className = 'banner active';
      statusBanner.textContent = 'Press up fast, stutter-step, then move WITH attacker!';
    }
  } else if (state.status === 'TAG_ANIM') {
    statusBanner.className = 'banner success';
    statusBanner.textContent = 'TAG!';
  } else if (state.status === 'TAGGED') {
    const s = state.tagInfo.score;
    statusBanner.className = s >= 7 ? 'banner success' : 'banner neutral';
    statusBanner.textContent = `TAG MADE — ${s}/10 (${state.pattern.label})`;
  } else if (state.status === 'MISSED') {
    statusBanner.className = 'banner error';
    statusBanner.textContent = state.tagInfo.whiffedTooFast
      ? `MISSED TAG & TRY CONCEDED — 0/10`
      : `TRY CONCEDED — 0/10 (${state.pattern.label})`;
  }

  syncButtonsDisabled();
}

function getRoutineTip() {
  if (stats.whiffs > 0) {
    return 'Tip: Never sprint past to swipe the tag—press up, brake early, and drift back WITH the attacker so your relative speed drops.';
  }
  if (stats.misses > 2) {
    return 'Tip: Press straight up on GO, then stutter-step before the attacker steps so you can mirror laterally.';
  }
  const avgRel = stats.tags > 0 ? stats.totalRelSpeed / stats.tags : 0;
  if (avgRel > 3.2) {
    return 'Tip: Start drifting backward with the ball carrier just before contact to lower relative speed and earn 4/4 on Stutter & Pace.';
  }
  if (stats.points >= 80) {
    return 'Tip: Textbook tag defense—fast press, controlled stutter-step, and pace-matched tags.';
  }
  return 'Tip: Close space fast on the whistle, then match the ball carrier’s speed and direction.';
}

function showResultOverlay() {
  const isRoutineComplete = stats.reps >= TOTAL_REPS;
  resultOverlay.classList.remove('hidden');

  if (isRoutineComplete) {
    resultTitle.textContent = `ROUTINE: ${stats.points}/100`;
    resultTitle.className = `result-title ${stats.points >= 75 ? 'try' : stats.points >= 50 ? 'tackle' : 'error'}`;
    resultDetail.textContent = `${stats.tags} tags • ${stats.whiffs} missed tags • ${stats.misses - stats.whiffs} beaten`;

    const eliteCount = stats.history.filter((h) => h.score >= 8).length;
    const solidCount = stats.history.filter((h) => h.score >= 5 && h.score < 8).length;
    renderSummaryBoxes(resultList, [
      { cls: 'try', count: eliteCount, label: 'Elite (8-10)' },
      { cls: 'tackle', count: solidCount, label: 'Solid (5-7)' },
      { cls: 'error', count: stats.misses, label: 'Tries Conceded' },
    ]);
    resultList.classList.remove('hidden');
    resultBreakdown.classList.add('hidden');
    resultTip.textContent = getRoutineTip();
    resultTip.classList.remove('hidden');
    resultHint.classList.add('hidden');
    resultRestartBtn.classList.remove('hidden');
  } else {
    const info = state.tagInfo;
    if (state.outcome === 'TAGGED') {
      resultTitle.textContent = `TAGGED +${info.score}/10`;
    } else {
      resultTitle.textContent = info.whiffedTooFast ? 'MISSED TAG 0/10' : 'TRY CONCEDED 0/10';
    }
    resultTitle.className = `result-title ${info.score >= 8 ? 'try' : info.score >= 4 ? 'tackle' : 'error'}`;
    resultDetail.textContent = `Attacker: ${state.pattern.label}`;
    renderBreakdownList(resultBreakdown, info.breakdown);
    resultList.classList.add('hidden');
    resultTip.classList.add('hidden');
    resultHint.classList.remove('hidden');
    resultRestartBtn.classList.add('hidden');
  }
}

function hideOverlays() {
  welcomeOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startRep() {
  if (isLocked()) return;
  if (stats.reps >= TOTAL_REPS) {
    resetRoutine();
    return;
  }

  unlockAudio();
  hideOverlays();
  state = createScenario(stats.deck[stats.reps]);
  state.status = 'COUNTDOWN';
  playCountdownTick(false);
  updateUI();
}

function resetRoutine() {
  if (isLocked()) return;
  stats = createInitialStats();
  state = createScenario(stats.deck[0]);
  hideOverlays();
  updateUI();
}

function finishRep() {
  const info = state.tagInfo;
  stats.reps += 1;
  stats.points += info.score;
  if (state.outcome === 'TAGGED') {
    stats.tags += 1;
    stats.totalRelSpeed += info.relSpeed;
  } else {
    stats.misses += 1;
    if (info.whiffedTooFast) stats.whiffs += 1;
    playError();
  }

  stats.history.push({
    outcome: state.outcome,
    score: info.score,
    whiffedTooFast: Boolean(info.whiffedTooFast),
    pattern: state.pattern.label,
  });

  pointer.active = false;
  setCooldown(REP_END_COOLDOWN_MS);
  updateUI();
  showResultOverlay();
}

// Pointer / Touch steering
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlockAudio();
  if (state.status === 'READY' || state.status === 'TAGGED' || state.status === 'MISSED') {
    if (!welcomeOverlay.classList.contains('hidden')) return;
    if (stats.reps < TOTAL_REPS) startRep();
    return;
  }
  const coords = toCanvasCoords(canvas, e.clientX, e.clientY, PITCH);
  pointer.active = true;
  pointer.x = coords.x;
  pointer.y = coords.y;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active) return;
  const coords = toCanvasCoords(canvas, e.clientX, e.clientY, PITCH);
  pointer.x = coords.x;
  pointer.y = coords.y;
});

function clearPointer() {
  pointer.active = false;
}
canvas.addEventListener('pointerup', clearPointer);
canvas.addEventListener('pointercancel', clearPointer);

// Overlay & button clicks
welcomeStartBtn.addEventListener('click', () => startRep());
actionBtn.addEventListener('click', () => startRep());
resetBtn.addEventListener('click', () => resetRoutine());
resultRestartBtn.addEventListener('click', () => resetRoutine());
resultOverlay.addEventListener('click', (e) => {
  if (e.target === resultRestartBtn) return;
  if (stats.reps < TOTAL_REPS) startRep();
});

// Keyboard steering & shortcuts
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  keysDown.add(e.code);

  if (e.code === 'Space') {
    if (state.status === 'READY' || state.status === 'TAGGED' || state.status === 'MISSED') {
      if (stats.reps < TOTAL_REPS) startRep();
    }
  } else if (e.code === 'KeyR') {
    resetRoutine();
  }
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.code);
});

// Main loop (fixed 60Hz timestep across 60Hz/120Hz displays)
function step() {
  const input = getMovementInput();
  const events = stepSimulation(state, input);

  if (events.countdownTick === 'GO') {
    playCountdownTick(true);
    updateUI();
  } else if (events.countdownTick !== null) {
    playCountdownTick(false);
    updateUI();
  }

  if (events.missedSwipe) {
    playCatchSlow();
    updateUI();
  }

  if (events.tagMade) {
    playTag();
    updateUI();
  }

  if (events.outcome) {
    finishRep();
  }
}

updateUI();
startFixedLoop(step, () => renderPitch(ctx, state, getMovementInput()));
