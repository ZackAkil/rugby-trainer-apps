import {
  drawPitchBase,
  drawHorizontalLine,
  drawPlayerTriangle,
  drawRugbyBall,
  drawPlayerIKArms,
  drawCountdownBadge,
} from '../shared/canvas.js';
import { PITCH } from './simulation.js';

export function renderPitch(ctx, state, input = {}) {
  drawPitchBase(ctx, PITCH, '');

  // Label bottom try zone behind defender
  ctx.fillStyle = '#64748b';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEFEND TRY ZONE', PITCH.WIDTH / 2, PITCH.TRY_LINE_Y + (PITCH.HEIGHT - PITCH.TRY_LINE_Y) / 2 + 4);

  const { attacker, defender } = state;

  // Static defensive line where the defender starts
  drawHorizontalLine(ctx, defender.startY, PITCH.WIDTH, 'DEFENSIVE LINE', '#cbd5e1', '#94a3b8');

  // Missed-tag marker if player sprinted past at high relative speed
  if (state.missedSwipePos) {
    const { x, y } = state.missedSwipePos;
    ctx.save();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#dc2626';
    ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MISSED TAG (TOO FAST)', x, y - 28);
    ctx.restore();
  }

  // Subtle pointer target indicator when dragging/holding
  if (state.status === 'RUNNING' && input.pointerActive && input.targetX !== null && input.targetY !== null) {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(input.targetX, input.targetY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Attacker + ball (running down from top)
  const ballX = attacker.x + Math.cos(attacker.angle) * 16;
  const ballY = attacker.y + Math.sin(attacker.angle) * 16;
  drawPlayerTriangle(ctx, attacker.x, attacker.y, attacker.angle, '#2563eb', '#0a0a0a', 'ATTACKER');
  drawRugbyBall(ctx, ballX, ballY, attacker.angle + 0.35);

  // Defender IK arms (reach toward attacker when closing in, ready stance otherwise)
  const dist = Math.hypot(attacker.x - defender.x, attacker.y - defender.y);
  if (dist <= PITCH.ARM_REACH_RADIUS) {
    drawPlayerIKArms(ctx, defender, attacker.x, attacker.y, 7, 16, 16);
  } else {
    const readyX = defender.x + Math.cos(defender.angle) * 18;
    const readyY = defender.y + Math.sin(defender.angle) * 18;
    drawPlayerIKArms(ctx, defender, readyX, readyY, 8, 15, 15);
  }

  // Defender triangle (at bottom pressing up)
  let speedTag = '';
  if (state.status === 'RUNNING') {
    if (state.tagCooldownTicks > 0) speedTag = 'MISSED!';
    else if (defender.vy > 0.6) speedTag = 'PACING';
    else if (defender.speed > 2.8) speedTag = 'PRESS';
    else if (defender.speed > 0.5) speedTag = 'STUTTER';
    else speedTag = 'SET';
  }
  drawPlayerTriangle(ctx, defender.x, defender.y, defender.angle, '#ef4444', '#0a0a0a', 'YOU', speedTag);

  // Tag flash ring & flying tag ribbon on successful tag
  if (state.status === 'TAG_ANIM' || state.status === 'TAGGED') {
    ctx.save();
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(attacker.x, attacker.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (state.rippedTag) {
      const t = state.rippedTag;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 2;
      ctx.fillRect(-13, -4, 26, 8);
      ctx.strokeRect(-13, -4, 26, 8);
      ctx.restore();
    }
  }

  if (state.status === 'COUNTDOWN') {
    drawCountdownBadge(ctx, state.countdownStep, PITCH.WIDTH / 2, PITCH.HEIGHT / 2);
  }
}
