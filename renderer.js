import { PITCH } from './simulation.js';

function drawIsoscelesTriangle(ctx, x, y, angle, fillColor, strokeColor, label) {
  const tip = { x: 28, y: 0 };
  const topBack = { x: -16, y: -14 };
  const botBack = { x: -16, y: 14 };
  const cornerRadius = 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo((tip.x + topBack.x) / 2, (tip.y + topBack.y) / 2);
  ctx.arcTo(topBack.x, topBack.y, botBack.x, botBack.y, cornerRadius);
  ctx.arcTo(botBack.x, botBack.y, tip.x, tip.y, cornerRadius);
  ctx.arcTo(tip.x, tip.y, topBack.x, topBack.y, cornerRadius);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
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
  for (let x = 40; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Try line
  ctx.beginPath();
  ctx.moveTo(0, TRY_LINE_Y);
  ctx.lineTo(WIDTH, TRY_LINE_Y);
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
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
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
