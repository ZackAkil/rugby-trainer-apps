export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function lerpAngle(current, target, factor) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

export function shuffleDeck(items) {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function constrainBone(ax, ay, bx, by, len) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy) || 0.001;
  return {
    x: ax + (dx / d) * len,
    y: ay + (dy / d) * len,
  };
}

export function solveTwoBoneIK(sx, sy, tx, ty, L1, L2, bendSign) {
  const dx = tx - sx;
  const dy = ty - sy;
  const rawDist = Math.hypot(dx, dy);
  const maxReach = L1 + L2 - 0.5;
  const d = clamp(rawDist, Math.abs(L1 - L2) + 0.5, maxReach);

  const baseAngle = Math.atan2(dy, dx);
  const cosAngle1 = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const angle1 = Math.acos(clamp(cosAngle1, -1, 1));
  const elbowAngle = baseAngle + bendSign * angle1;

  const ex = sx + Math.cos(elbowAngle) * L1;
  const ey = sy + Math.sin(elbowAngle) * L1;

  const hx = rawDist > maxReach ? sx + (dx / rawDist) * maxReach : tx;
  const hy = rawDist > maxReach ? sy + (dy / rawDist) * maxReach : ty;

  return { ex, ey, hx, hy };
}
