import {
  drawPitchBase,
  drawHorizontalLine,
  drawPlayerTriangle,
  drawRugbyBall,
} from '../shared/canvas.js';
import { PITCH } from './simulation.js';

export function renderPitch(ctx, state) {
  const { WIDTH } = PITCH;

  drawPitchBase(ctx, PITCH, 'TRY ZONE');

  [260, 480].forEach((y) => {
    drawHorizontalLine(ctx, y, WIDTH, '', '#94a3b8');
  });

  if (state.cutStarted && state.cutOrigin) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(state.cutOrigin.x, state.cutOrigin.y);
    ctx.lineTo(state.runner.x, state.runner.y);
    ctx.stroke();
    ctx.restore();
  }

  // Attackers (Blue Isosceles Triangles with Black Stroke, no arms)
  drawPlayerTriangle(ctx, state.carrier.x, state.carrier.y, state.carrier.angle, '#2563eb', '#0a0a0a', 'A1');
  drawPlayerTriangle(ctx, state.runner.x, state.runner.y, state.runner.angle, '#2563eb', '#0a0a0a', 'A2');

  // Defender (Red Isosceles Triangle with Black Stroke, no arms)
  drawPlayerTriangle(ctx, state.defender.x, state.defender.y, state.defender.angle, '#ef4444', '#0a0a0a', 'D1');

  // Ball
  if (state.ball.inFlight) {
    const ballAngle = Math.atan2(state.ball.vy, state.ball.vx);
    drawRugbyBall(ctx, state.ball.x, state.ball.y, ballAngle);
  } else {
    const holder = state.carrier.hasBall ? state.carrier : state.runner;
    const hipSide = state.carrier.hasBall ? -state.side : state.side;
    const fwdX = Math.cos(holder.angle) * 11;
    const fwdY = Math.sin(holder.angle) * 11;
    const sideX = Math.cos(holder.angle + (Math.PI / 2) * hipSide) * 9;
    const sideY = Math.sin(holder.angle + (Math.PI / 2) * hipSide) * 9;
    drawRugbyBall(ctx, holder.x + fwdX + sideX, holder.y + fwdY + sideY, holder.angle);
  }
}
