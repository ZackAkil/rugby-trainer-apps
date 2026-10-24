import { constrainBone } from './math.js';

export const PITCH_DEFAULT = {
  WIDTH: 600,
  HEIGHT: 750,
  TRY_LINE_Y: 80,
};

export function steerEntityWithInertia(entity, targetX, targetY, maxSpeed, accel, faceVelocity = true) {
  const dx = targetX - entity.x;
  const dy = targetY - entity.y;
  const d = Math.hypot(dx, dy);

  if (d > 1) {
    const desiredVx = (dx / d) * maxSpeed;
    const desiredVy = (dy / d) * maxSpeed;
    entity.vx += (desiredVx - entity.vx) * accel;
    entity.vy += (desiredVy - entity.vy) * accel;
    entity.x += entity.vx;
    entity.y += entity.vy;

    if (faceVelocity && Math.hypot(entity.vx, entity.vy) > 0.08) {
      entity.angle = Math.atan2(entity.vy, entity.vx);
    }
  }
}

export function stepBallFlight(ball, drag = 0.985) {
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= drag;
  ball.vy *= drag;
  ball.speed = Math.hypot(ball.vx, ball.vy);
  if (ball.spinRate) {
    ball.spinAngle = (ball.spinAngle || 0) + ball.spinRate;
  }
}

export function bounceBallInPitch(ball, pitch = PITCH_DEFAULT, margin = 22, restitution = 0.75) {
  if (ball.x < margin) {
    ball.x = margin;
    ball.vx = Math.abs(ball.vx) * restitution;
  } else if (ball.x > pitch.WIDTH - margin) {
    ball.x = pitch.WIDTH - margin;
    ball.vx = -Math.abs(ball.vx) * restitution;
  }

  if (ball.y < margin) {
    ball.y = margin;
    ball.vy = Math.abs(ball.vy) * restitution;
  } else if (ball.y > pitch.HEIGHT - margin) {
    ball.y = pitch.HEIGHT - margin;
    ball.vy = -Math.abs(ball.vy) * restitution;
  }
}

export function createRippedArmsState(runner, ball) {
  const lsx = runner.x - 11;
  const lsy = runner.y + 2;
  const rsx = runner.x + 11;
  const rsy = runner.y + 2;

  return {
    left: {
      hx: ball.x - 5,
      hy: ball.y,
      ex: (ball.x + lsx) * 0.5 - 6,
      ey: (ball.y + lsy) * 0.5,
      sx: lsx,
      sy: lsy,
      evx: runner.vx - ball.vx * 0.2,
      evy: runner.vy - 1.5,
      svx: -ball.vy * 0.35,
      svy: ball.vx * 0.35,
    },
    right: {
      hx: ball.x + 5,
      hy: ball.y,
      ex: (ball.x + rsx) * 0.5 + 6,
      ey: (ball.y + rsy) * 0.5,
      sx: rsx,
      sy: rsy,
      evx: runner.vx - ball.vx * 0.2,
      evy: runner.vy + 1.5,
      svx: ball.vy * 0.35,
      svy: -ball.vx * 0.35,
    },
  };
}

export function stepRippedArmsPhysics(rippedArms, ball, tick = 0, L1 = 15, L2 = 15) {
  if (!rippedArms) return;

  [
    { arm: rippedArms.left, offsetAngle: -1.35, phase: 0 },
    { arm: rippedArms.right, offsetAngle: 1.35, phase: 2.2 },
  ].forEach(({ arm, offsetAngle, phase }) => {
    const gripAngle = (ball.spinAngle || 0) + offsetAngle;
    arm.hx = ball.x + Math.cos(gripAngle) * 6;
    arm.hy = ball.y + Math.sin(gripAngle) * 6;

    const prevEx = arm.ex;
    const prevEy = arm.ey;
    const prevSx = arm.sx;
    const prevSy = arm.sy;

    const perpAngle = Math.atan2(ball.vy, ball.vx) + Math.PI / 2;
    const whip = Math.sin(tick * 0.55 + phase) * 1.65;

    arm.ex += arm.evx + Math.cos(perpAngle) * whip * 0.5;
    arm.ey += arm.evy + Math.sin(perpAngle) * whip * 0.5;
    arm.sx += arm.svx + Math.cos(perpAngle) * whip;
    arm.sy += arm.svy + Math.sin(perpAngle) * whip;

    const ePos = constrainBone(arm.hx, arm.hy, arm.ex, arm.ey, L2);
    arm.ex = ePos.x;
    arm.ey = ePos.y;

    const sPos = constrainBone(arm.ex, arm.ey, arm.sx, arm.sy, L1);
    arm.sx = sPos.x;
    arm.sy = sPos.y;

    arm.evx = (arm.ex - prevEx) * 0.88;
    arm.evy = (arm.ey - prevEy) * 0.88;
    arm.svx = (arm.sx - prevSx) * 0.9;
    arm.svy = (arm.sy - prevSy) * 0.9;
  });
}
