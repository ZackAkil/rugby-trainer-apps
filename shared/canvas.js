import { solveTwoBoneIK } from './math.js';
import { PITCH_DEFAULT } from './physics.js';

export function drawPitchBase(ctx, pitch = PITCH_DEFAULT, tryZoneLabel = 'TRY ZONE') {
  const { WIDTH, HEIGHT, TRY_LINE_Y } = pitch;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

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

  ctx.beginPath();
  ctx.moveTo(0, TRY_LINE_Y);
  ctx.lineTo(WIDTH, TRY_LINE_Y);
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (tryZoneLabel) {
    ctx.fillStyle = '#64748b';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tryZoneLabel, WIDTH / 2, TRY_LINE_Y / 2 + 4);
  }
}

export function drawHorizontalLine(ctx, y, width, label = '', strokeColor = '#cbd5e1', labelColor = '#94a3b8') {
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.restore();

  if (label) {
    ctx.fillStyle = labelColor;
    ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(label, width - 12, y - 6);
  }
}

export function drawPlayerTriangle(ctx, x, y, angle, fillColor, strokeColor, label, subLabel = '') {
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

  if (subLabel) {
    ctx.fillStyle = '#64748b';
    ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(subLabel, x, y + 45);
  }
}

export function drawRugbyBall(ctx, x, y, angle) {
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

export function drawPlayerIKArms(ctx, player, targetX, targetY, handSpread = 6, L1 = 15, L2 = 15) {
  const leftShoulder = { x: player.x - 11, y: player.y + 2 };
  const rightShoulder = { x: player.x + 11, y: player.y + 2 };

  const leftIK = solveTwoBoneIK(leftShoulder.x, leftShoulder.y, targetX - handSpread, targetY, L1, L2, -1);
  const rightIK = solveTwoBoneIK(rightShoulder.x, rightShoulder.y, targetX + handSpread, targetY, L1, L2, 1);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  [
    { s: leftShoulder, ik: leftIK },
    { s: rightShoulder, ik: rightIK },
  ].forEach(({ s, ik }) => {
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(ik.ex, ik.ey);
    ctx.lineTo(ik.hx, ik.hy);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ik.ex, ik.ey, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(ik.hx, ik.hy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

export function drawRippedArmsEffect(ctx, player, rippedArms) {
  const leftShoulder = { x: player.x - 11, y: player.y + 2 };
  const rightShoulder = { x: player.x + 11, y: player.y + 2 };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Empty popped-off shoulder sockets on the player
  [leftShoulder, rightShoulder].forEach((s) => {
    ctx.fillStyle = '#fef2f2';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Detached ragdoll arms clinging to the ball
  [rippedArms.left, rippedArms.right].forEach((arm) => {
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(arm.sx, arm.sy);
    ctx.lineTo(arm.ex, arm.ey);
    ctx.lineTo(arm.hx, arm.hy);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(arm.sx, arm.sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arm.ex, arm.ey, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(arm.hx, arm.hy, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

export function drawCountdownBadge(ctx, number, centerX, centerY, boxSize = 68) {
  const bx = centerX - boxSize / 2;
  const by = centerY - boxSize / 2;

  ctx.save();
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(bx + 4, by + 4, boxSize, boxSize);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0a0a0a';
  ctx.lineWidth = 2.5;
  ctx.fillRect(bx, by, boxSize, boxSize);
  ctx.strokeRect(bx, by, boxSize, boxSize);

  ctx.fillStyle = '#0a0a0a';
  ctx.font = '800 32px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), centerX, by + boxSize / 2 + 2);
  ctx.restore();
}

export function drawSwipeVector(ctx, originX, originY, dx, dy, color, scale = 0.85, maxDist = 225) {
  const d = Math.hypot(dx, dy);
  if (d <= 8) return;

  const clampedDist = Math.min(d, maxDist);
  const angle = Math.atan2(dy, dx);
  const endX = originX + Math.cos(angle) * (clampedDist * scale);
  const endY = originY + Math.sin(angle) * (clampedDist * scale);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.translate(endX, endY);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
