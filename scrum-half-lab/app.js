import {
  initMuteButton,
  createCooldownController,
  toCanvasCoords,
  renderRepChips,
  renderBreakdownList,
  renderSummaryBoxes,
} from '../shared/ui.js';
import {
  unlockAudio,
  playCountdownTick,
  playWindup,
  playPass,
  playCatchBoost,
  playCatchNormal,
  playCatchSlow,
  playArmsRipped,
  playTag,
  playTry,
  playError,
} from '../shared/audio.js';
import {
  PITCH,
  createInitialGame,
  setupNextPlay,
  triggerPassWindup,
  launchSwipePass,
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

let state = createInitialGame();
let stats = createInitialStats();

const dragState = {
  active: false,
  startX: 0,
  startY: 0,
  currX: 0,
  currY: 0,
};

const { isLocked, setCooldown } = createCooldownController(syncButtonsDisabled);

function createInitialStats() {
  return {
    points: 0,
    reps: 0,
    perfects: 0,
    goodPasses: 0,
    zeroes: 0,
    forwardPasses: 0,
    history: [],
  };
}

function getScoreTierClass(score) {
  if (score >= 8) return 'try';
  if (score >= 4) return 'tackle';
  return 'intercept';
}

function syncButtonsDisabled() {
  const coolingDown = isLocked();
  const inPlay =
    state.phase === 'FORMING_RUCK' ||
    state.phase === 'COUNTDOWN' ||
    state.phase === 'PASS_WINDOW' ||
    state.phase === 'BALL_FLIGHT' ||
    state.phase === 'RUN_TO_TAG';
  const routineDone = state.phase === 'REP_END' && stats.reps >= TOTAL_REPS;

  actionBtn.disabled = coolingDown || inPlay || routineDone;
  resultRestartBtn.disabled = coolingDown;
  welcomeStartBtn.disabled = coolingDown;
}

function getRoutineTip() {
  if (stats.forwardPasses > 0) {
    return 'Tip: Aim slightly behind the dashed flat line so the runner catches the ball flat without a forward pass.';
  }
  if (stats.zeroes >= 3) {
    return 'Tip: Watch the runner’s speed early and release the swipe before they cross the flat line.';
  }
  if (stats.points >= 85) {
    return 'Tip: Crisp service. You matched pass weight and lead angle to every runner speed.';
  }
  return 'Tip: Swipe slightly earlier for fast runners and aim just below the flat pass line.';
}

function updateUI() {
  pointsEl.textContent = `${stats.points}/100`;
  repsEl.textContent = stats.reps;

  renderRepChips(
    repHistoryEl,
    TOTAL_REPS,
    stats.history,
    stats.reps,
    state.phase !== 'READY' && state.phase !== 'REP_END',
    (item, idx) => ({
      cls: getScoreTierClass(item.score),
      tag: `${item.score}/10`,
      title: `Rep ${idx + 1}: ${item.reason}`,
    })
  );

  if (state.phase === 'READY') {
    statusBanner.textContent = '10-Rep Routine — Swipe to aim & power your pass';
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Start Routine';
  } else if (state.phase === 'FORMING_RUCK') {
    statusBanner.textContent = `Rep ${stats.reps + 1}/${TOTAL_REPS} — Setting ruck...`;
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay hidden';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Setting Ruck...';
  } else if (state.phase === 'COUNTDOWN') {
    statusBanner.textContent = `Rep ${stats.reps + 1}/${TOTAL_REPS} — Spot the runner & get ready...`;
    statusBanner.className = 'banner neutral';
    welcomeOverlay.className = 'result-overlay hidden';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Get Ready...';
  } else if (state.phase === 'PASS_WINDOW') {
    statusBanner.textContent = `Rep ${stats.reps + 1}/${TOTAL_REPS} — Swipe on pitch to pass to the runner`;
    statusBanner.className = 'banner running';
    welcomeOverlay.className = 'result-overlay hidden';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Swipe Pitch to Pass';
  } else if (state.phase === 'BALL_FLIGHT' || state.phase === 'RUN_TO_TAG') {
    statusBanner.textContent = `Rep ${stats.reps + 1}/${TOTAL_REPS} — Ball released...`;
    statusBanner.className = 'banner running';
    welcomeOverlay.className = 'result-overlay hidden';
    resultOverlay.className = 'result-overlay hidden';
    actionBtn.textContent = 'Ball Released';
  } else if (state.phase === 'REP_END') {
    welcomeOverlay.className = 'result-overlay hidden';
    renderBreakdownList(resultBreakdown, state.lastRepBreakdown);

    if (stats.reps >= TOTAL_REPS) {
      const isStrong = stats.points >= 70;
      statusBanner.textContent = `Routine Complete (${state.lastRepLabel}: ${state.lastRepScore}/10)`;
      statusBanner.className = 'banner neutral';
      resultTitle.textContent = `SCORE: ${stats.points} / 100`;
      resultDetail.textContent = `Rep 10: ${state.lastRepLabel} (${state.lastRepScore}/10)`;
      renderSummaryBoxes(resultList, [
        { cls: 'try', count: stats.perfects, label: 'Crisp (8-10)' },
        { cls: 'tackle', count: stats.goodPasses, label: 'Playable (1-7)' },
        { cls: 'intercept', count: stats.zeroes, label: 'Missed (0)' },
      ]);
      resultList.className = 'result-list';
      resultTip.textContent = getRoutineTip();
      resultTip.className = 'result-tip';
      resultHint.className = 'result-hint hidden';
      resultRestartBtn.className = 'result-restart-btn';
      resultOverlay.className = `result-overlay ${isStrong ? 'success' : 'fail'}`;
      actionBtn.textContent = 'Routine Complete';
    } else {
      const isSuccess = state.lastRepScore >= 7;
      statusBanner.textContent = `Rep ${stats.reps}/${TOTAL_REPS} complete`;
      statusBanner.className = 'banner neutral';
      resultTitle.textContent = `${state.lastRepLabel} (${state.lastRepScore}/10)`;
      resultDetail.textContent = '';
      resultList.className = 'result-list hidden';
      resultTip.textContent = '';
      resultTip.className = 'result-tip hidden';
      resultHint.textContent = `Tap or press SPACE for Rep ${stats.reps + 1}/${TOTAL_REPS}`;
      resultHint.className = 'result-hint';
      resultRestartBtn.className = 'result-restart-btn hidden';
      resultOverlay.className = `result-overlay ${isSuccess ? 'success' : 'fail'}`;
      actionBtn.textContent = `Next Rep (${stats.reps + 1}/${TOTAL_REPS})`;
    }
  }

  syncButtonsDisabled();
}

function advanceFlow() {
  if (isLocked()) return;

  if (state.phase === 'READY') {
    setupNextPlay(state, true);
    setCooldown(300);
    updateUI();
  } else if (state.phase === 'REP_END' && stats.reps < TOTAL_REPS) {
    setupNextPlay(state, false);
    setCooldown(300);
    updateUI();
  }
}

function startNewRoutine() {
  if (isLocked()) return;
  stats = createInitialStats();
  state = createInitialGame();
  setupNextPlay(state, true);
  setCooldown(300);
  updateUI();
}

function resetRoutine() {
  if (isLocked()) return;
  stats = createInitialStats();
  state = createInitialGame();
  setCooldown(300);
  updateUI();
}

const canvasWrapper = canvas.parentElement;

canvasWrapper.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.target.closest('button')) return;
  e.preventDefault();

  if (state.phase === 'PASS_WINDOW' || state.phase === 'COUNTDOWN') {
    const pt = toCanvasCoords(canvas, e.clientX, e.clientY, PITCH);
    dragState.active = true;
    dragState.pointerId = e.pointerId;
    dragState.startX = pt.x;
    dragState.startY = pt.y;
    dragState.currX = pt.x;
    dragState.currY = pt.y;
    if (canvasWrapper.setPointerCapture) {
      try {
        canvasWrapper.setPointerCapture(e.pointerId);
      } catch (_) {
        // Ignore if pointer capture is unsupported on synthetic events
      }
    }
    triggerPassWindup(state);
    playWindup();
  } else if (state.phase === 'REP_END' && stats.reps < TOTAL_REPS) {
    advanceFlow();
  } else if (state.phase === 'READY') {
    advanceFlow();
  }
});

window.addEventListener('pointermove', (e) => {
  if (!dragState.active) return;
  if (dragState.pointerId !== undefined && e.pointerId !== dragState.pointerId) return;
  const pt = toCanvasCoords(canvas, e.clientX, e.clientY, PITCH);
  dragState.currX = pt.x;
  dragState.currY = pt.y;
});

function finishDrag(e) {
  if (!dragState.active) return;
  if (e && dragState.pointerId !== undefined && e.pointerId !== dragState.pointerId) return;
  dragState.active = false;
  dragState.pointerId = undefined;

  if (state.phase === 'PASS_WINDOW') {
    const dx = dragState.currX - dragState.startX;
    const dy = dragState.currY - dragState.startY;
    if (launchSwipePass(state, dx, dy)) {
      const powerRatio = Math.min(1, Math.max(0, (state.ball.launchSpeed - 2.5) / 11.7));
      playPass(powerRatio);
      updateUI();
    }
  } else if (state.phase === 'COUNTDOWN') {
    state.passWindupStarted = false;
  }
}

window.addEventListener('pointerup', finishDrag);
window.addEventListener('pointercancel', finishDrag);

actionBtn.addEventListener('click', () => {
  unlockAudio();
  advanceFlow();
});
resetBtn.addEventListener('click', () => {
  unlockAudio();
  resetRoutine();
});
welcomeStartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
  advanceFlow();
});
resultRestartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
  startNewRoutine();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  unlockAudio();
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.phase === 'REP_END' && stats.reps < TOTAL_REPS) {
      advanceFlow();
    } else if (state.phase === 'READY') {
      advanceFlow();
    }
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    resetRoutine();
  }
});

function loop() {
  const prevPhase = state.phase;
  const prevCountdown = state.countdownNumber;
  const prevArmsRipped = state.armsRipped;

  stepSimulation(state);

  if (state.phase === 'COUNTDOWN' && prevPhase !== 'COUNTDOWN') {
    playCountdownTick(false);
  } else if (state.phase === 'COUNTDOWN' && state.countdownNumber !== prevCountdown) {
    playCountdownTick(false);
  } else if (prevPhase === 'COUNTDOWN' && state.phase === 'PASS_WINDOW') {
    playCountdownTick(true);
  }

  if (!prevArmsRipped && state.armsRipped) {
    playArmsRipped();
  }

  if (prevPhase !== state.phase) {
    if (state.phase === 'RUN_TO_TAG') {
      if (state.catchEffect === 'BOOST') playCatchBoost();
      else if (state.catchEffect === 'STRIDE') playCatchNormal();
      else playCatchSlow();
    } else if (state.phase === 'REP_END') {
      if (prevPhase === 'RUN_TO_TAG') {
        if (state.lastRepLabel.includes('TRY')) playTry();
        else playTag();
      } else if (!state.armsRipped) {
        playError();
      }

      stats.reps += 1;
      stats.points += state.lastRepScore;
      stats.history.push({
        score: state.lastRepScore,
        label: state.lastRepLabel,
        reason: state.lastRepReason,
      });

      if (state.lastRepScore >= 8) stats.perfects += 1;
      else if (state.lastRepScore >= 1) stats.goodPasses += 1;
      else stats.zeroes += 1;

      if (state.lastRepLabel === 'FORWARD PASS') {
        stats.forwardPasses += 1;
      }

      setCooldown(REP_END_COOLDOWN_MS);
    }
    updateUI();
  }

  renderPitch(ctx, state, dragState);
  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);
