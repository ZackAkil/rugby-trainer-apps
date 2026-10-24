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

  // Attackers (Blue Isosceles Triangles with Black Stroke)
  drawPlayerTriangle(ctx, state.carrier.x, state.carrier.y, state.carrier.angle, '#2563eb', '#0a0a0a', 'A1');
  drawPlayerTriangle(ctx, state.support.x, state.support.y, state.support.angle, '#2563eb', '#0a0a0a', 'A2');

  // Defender (Red Isosceles Triangle with Black Stroke)
  drawPlayerTriangle(ctx, state.defender.x, state.defender.y, state.defender.angle, '#ef4444', '#0a0a0a', 'D1');

  // Ball
  const ballAngle = state.ball.inFlight
    ? Math.atan2(state.ball.vy, state.ball.vx)
    : -Math.PI / 2;
  const ballOffsetX = state.ball.inFlight ? 0 : 14;
  const ballOffsetY = state.ball.inFlight ? 0 : -8;
  drawRugbyBall(ctx, state.ball.x + ballOffsetX, state.ball.y + ballOffsetY, ballAngle);
}
