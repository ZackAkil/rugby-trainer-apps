import { PITCH } from './simulation.js';

function drawIsoscelesTriangle(ctx, x, y, angle, fillColor, strokeColor, label) {
  const tipLength = 28;
  const backLength = 16;
  const halfWidth = 14;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(tipLength, 0);
  ctx.lineTo(-backLength, -halfWidth);
  ctx.lineTo(-backLength, halfWidth);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.restore();

  if (label) {
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 34);
  }
}

function drawBall(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.ellipse(0, 0, 9.5, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0a0a0a';
  ctx.stroke();
  ctx.restore();
}

export function renderPitch(ctx, state) {
  const { WIDTH, HEIGHT, TRY_LINE_Y } = PITCH;

  // Lab white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle calibration grid
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let x = 20; x < WIDTH - 20; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(WIDTH - 20, y);
    ctx.stroke();
  }

  // Side touchlines
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 0, WIDTH - 40, HEIGHT);

  // Try line
  ctx.beginPath();
  ctx.moveTo(20, TRY_LINE_Y);
  ctx.lineTo(WIDTH - 20, TRY_LINE_Y);
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dashed reference lines
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  [260, 480].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(WIDTH - 20, y);
    ctx.stroke();
  });
  ctx.restore();

  // Try zone label
  ctx.fillStyle = '#64748b';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TRY ZONE', WIDTH / 2, TRY_LINE_Y / 2 + 4);

  // Attackers (Blue Isosceles Triangles with Black Stroke)
  drawIsoscelesTriangle(ctx, state.carrier.x, state.carrier.y, state.carrier.angle, '#2563eb', '#0a0a0a', 'A1');
  drawIsoscelesTriangle(ctx, state.support.x, state.support.y, state.support.angle, '#2563eb', '#0a0a0a', 'A2');

  // Defender (Red Isosceles Triangle with Black Stroke)
  drawIsoscelesTriangle(ctx, state.defender.x, state.defender.y, state.defender.angle, '#ef4444', '#0a0a0a', 'D1');

  // Ball
  const ballAngle = state.ball.inFlight
    ? Math.atan2(state.ball.vy, state.ball.vx)
    : -Math.PI / 2;
  const ballOffsetX = state.ball.inFlight ? 0 : 14;
  const ballOffsetY = state.ball.inFlight ? 0 : -8;
  drawBall(ctx, state.ball.x + ballOffsetX, state.ball.y + ballOffsetY, ballAngle);
}
