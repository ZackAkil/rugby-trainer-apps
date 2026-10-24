import {
  drawPitchBase,
  drawHorizontalLine,
  drawPlayerTriangle,
  drawRugbyBall,
  drawPlayerIKArms,
  drawRippedArmsEffect,
  drawCountdownBadge,
  drawSwipeVector,
} from '../shared/canvas.js';
import { PITCH, TARGET_ZONES, GAIN_LINE_ZONES } from './simulation.js';

function drawGainLineZones(ctx, flatY, runner, state, alpha) {
  if (alpha <= 0.01) return;

  const pad = 42;
  const xMin =
    state.runnerSide === 1
      ? Math.min(state.ruckX + 46, runner.x - pad)
      : Math.max(16, runner.x - pad);
  const xMax =
    state.runnerSide === 1
      ? Math.min(PITCH.WIDTH - 16, runner.x + pad)
      : Math.max(state.ruckX - 46, runner.x + pad);
  const w = Math.max(70, xMax - xMin);

  ctx.save();
  ctx.globalAlpha = alpha;

  // 1. GREEN GAIN-LINE BAND (Flat right near the line: 0..25px below flatY)
  const gY = flatY;
  const gH = GAIN_LINE_ZONES.GREEN_MAX;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
  ctx.fillRect(xMin, gY, w, gH);

  // 2. YELLOW GAIN-LINE BAND (Slightly deep: 25..52px below flatY)
  const yY = flatY + GAIN_LINE_ZONES.GREEN_MAX;
  const yH = GAIN_LINE_ZONES.YELLOW_MAX - GAIN_LINE_ZONES.GREEN_MAX;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.fillRect(xMin, yY, w, yH);

  // 3. RED GAIN-LINE BAND (Way behind the line: 52..80px below flatY)
  const rY = flatY + GAIN_LINE_ZONES.YELLOW_MAX;
  const rH = GAIN_LINE_ZONES.RED_MAX - GAIN_LINE_ZONES.YELLOW_MAX;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
  ctx.fillRect(xMin, rY, w, rH);

  ctx.fillStyle = '#059669';
  ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAIN LINE TARGET', xMin + w / 2, flatY + 15);

  ctx.restore();
}

function drawRunnerHeatmap(ctx, runner, alpha) {
  if (alpha <= 0.01) return;

  const hw = TARGET_ZONES.HALF_WIDTH;
  const x = runner.x - hw;
  const w = hw * 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 1. GREEN ZONE (Boost / Sweet spot in front of the runner)
  const gY = runner.y + TARGET_ZONES.GREEN_TOP;
  const gH = TARGET_ZONES.GREEN_BOT - TARGET_ZONES.GREEN_TOP;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.fillRect(x, gY, w, gH);

  // 2. YELLOW ZONE (At body / slightly in front)
  const yY = runner.y + TARGET_ZONES.YELLOW_TOP;
  const yH = TARGET_ZONES.YELLOW_BOT - TARGET_ZONES.YELLOW_TOP;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.26)';
  ctx.fillRect(x, yY, w, yH);

  // 3. RED ZONE (Behind runner -> Slowdown / Stop)
  const rY = runner.y + TARGET_ZONES.RED_TOP;
  const rH = TARGET_ZONES.RED_BOT - TARGET_ZONES.RED_TOP;
  ctx.fillStyle = 'rgba(239, 68, 68, 0.24)';
  ctx.fillRect(x, rY, w, rH);

  ctx.restore();
}

function drawCatchEffect(ctx, runner, state) {
  if (state.armsRipped) {
    ctx.save();
    ctx.fillStyle = '#dc2626';
    ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MY ARMS!!', runner.x, runner.y - 34);
    ctx.restore();
    return;
  }

  if (!state.catchEffect || state.phase !== 'RUN_TO_TAG') return;

  ctx.save();
  if (state.catchEffect === 'BOOST') {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    [-10, 0, 10].forEach((offsetX, i) => {
      const len = i === 1 ? 30 : 22;
      ctx.beginPath();
      ctx.moveTo(runner.x + offsetX, runner.y + 18);
      ctx.lineTo(runner.x + offsetX, runner.y + 18 + len);
      ctx.stroke();
    });

    ctx.fillStyle = '#059669';
    ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOOST!', runner.x, runner.y - 34);
  } else if (state.catchEffect === 'SLOW') {
    ctx.fillStyle = '#d97706';
    ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SLOWED', runner.x, runner.y - 34);
  } else if (state.catchEffect === 'STOP') {
    ctx.fillStyle = '#dc2626';
    ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STOPPED!', runner.x, runner.y - 34);
  }
  ctx.restore();
}

function drawRunnerArms(ctx, runner, state) {
  const { ball } = state;

  if (state.armsRipped && state.rippedArms) {
    drawRippedArmsEffect(ctx, runner, state.rippedArms);
    return;
  }

  let targetX = runner.x;
  let targetY = runner.y - 18;
  let handSpread = 6;

  if (state.phase === 'BALL_FLIGHT') {
    const dist = Math.hypot(ball.x - runner.x, ball.y - runner.y);
    if (dist < 150) {
      const reachWeight = Math.min(1, (150 - dist) / 95);
      const leadBallX = ball.x + ball.vx * 2;
      const leadBallY = ball.y + ball.vy * 2;
      targetX = targetX + (leadBallX - targetX) * reachWeight;
      targetY = targetY + (leadBallY - targetY) * reachWeight;
      handSpread = 5;
    }
  } else if (state.phase === 'RUN_TO_TAG' || (state.phase === 'REP_END' && ball.holderId === runner.id)) {
    targetX = ball.x;
    targetY = ball.y;
    handSpread = 5;
  }

  drawPlayerIKArms(ctx, runner, targetX, targetY, handSpread);
}

export function renderPitch(ctx, state, dragState) {
  const { WIDTH } = PITCH;

  drawPitchBase(ctx, PITCH, 'TRY ZONE (+2 BONUS)');

  const sh = state.attackers.find((a) => a.role === 'SCRUM_HALF');
  const flatY = state.ball.inFlight ? state.ball.originY : sh ? sh.y - 8 : state.ruckY + 18;
  drawHorizontalLine(ctx, flatY, WIDTH, 'FLAT PASS LINE');

  // Target indicators: visible during COUNTDOWN, then fade out as runner starts running
  const runner = state.attackers.find((a) => a.role === 'RUNNER');
  if (runner && (state.phase === 'COUNTDOWN' || state.phase === 'PASS_WINDOW' || state.phase === 'BALL_FLIGHT')) {
    const fadeFrames = 26;
    const guideAlpha =
      state.phase === 'COUNTDOWN'
        ? 1.0
        : Math.max(0, 1 - (state.runElapsedFrames || 0) / fadeFrames);

    if (guideAlpha > 0) {
      drawGainLineZones(ctx, flatY, runner, state, guideAlpha);
      drawRunnerHeatmap(ctx, runner, guideAlpha);
    }
  }

  // Swipe aim & power vector arrow
  if (
    dragState &&
    dragState.active &&
    (state.phase === 'PASS_WINDOW' || state.phase === 'COUNTDOWN') &&
    sh
  ) {
    const dx = dragState.currX - dragState.startX;
    const dy = dragState.currY - dragState.startY;
    const dist = Math.hypot(dx, dy);
    const speed = Math.max(2.5, Math.min(14.2, dist * 0.064));

    let vectorColor = '#2563eb';
    if (speed < 4.5) vectorColor = '#f59e0b';
    else if (speed >= 10.4) vectorColor = '#ef4444';

    drawSwipeVector(ctx, state.ball.x, state.ball.y, dx, dy, vectorColor);
  }

  // Defenders (Red)
  state.defenders.forEach((d) => {
    const sub = d.role === 'MARKER' ? 'TAG' : '';
    drawPlayerTriangle(ctx, d.x, d.y, d.angle, '#ef4444', '#0a0a0a', d.id, sub);
  });

  // Attackers (Blue)
  state.attackers.forEach((a) => {
    let sub = '';
    if (a.role === 'SCRUM_HALF') sub = '9 (YOU)';
    else if (a.role === 'TAGGED') sub = 'RUCK';
    else if (a.role === 'RUNNER') sub = 'LINE';
    drawPlayerTriangle(ctx, a.x, a.y, a.angle, '#2563eb', '#0a0a0a', a.id, sub);
  });

  // Ball
  const ballAngle = state.armsRipped
    ? state.ball.spinAngle || 0
    : state.ball.inFlight
    ? Math.atan2(state.ball.vy, state.ball.vx)
    : -Math.PI / 2;
  drawRugbyBall(ctx, state.ball.x, state.ball.y, ballAngle);

  if (runner) {
    drawRunnerArms(ctx, runner, state);
    drawCatchEffect(ctx, runner, state);
  }

  if (state.phase === 'COUNTDOWN') {
    drawCountdownBadge(ctx, state.countdownNumber, WIDTH / 2, state.ruckY - 125);
  }
}
