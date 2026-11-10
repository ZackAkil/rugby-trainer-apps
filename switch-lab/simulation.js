import { clamp, shuffleDeck } from '../shared/math.js';
import { PITCH_DEFAULT, steerEntityWithInertia } from '../shared/physics.js';

export const PITCH = PITCH_DEFAULT;

export const SPEEDS = {
  CARRIER: 2.55,
  RUNNER_SUPPORT: 2.55,
  RUNNER_CUT: 3.35,
  RUNNER_BREAK: 3.4,
  DEFENDER: 2.85,
  POP_PASS: 6.4,
  WIDE_PASS: 8.2,
};

const SUPPORT_DEPTH = 85;

export const RADII = {
  TACKLE: 27,
  INTERCEPT: 22,
  CATCH: 22,
};

export const DEFENDER_TYPES = [
  { id: 'HARD_PRESS', label: 'Hard press on ball carrier' },
  { id: 'OUTSIDE_DRIFT', label: 'Hard drift with outside threat' },
  { id: 'PATIENT_HOLD', label: 'Hold square, late commit' },
  { id: 'SPY_SWITCH', label: 'Jump inside onto cut runner' },
];

const ROUTINE_DISTRIBUTION = [
  DEFENDER_TYPES[0],
  DEFENDER_TYPES[0],
  DEFENDER_TYPES[0],
  DEFENDER_TYPES[1],
  DEFENDER_TYPES[1],
  DEFENDER_TYPES[1],
  DEFENDER_TYPES[2],
  DEFENDER_TYPES[2],
  DEFENDER_TYPES[3],
  DEFENDER_TYPES[3],
];

const SIDE_DISTRIBUTION = [1, 1, 1, 1, 1, -1, -1, -1, -1, -1];

export function createRoutineDeck() {
  const types = shuffleDeck(ROUTINE_DISTRIBUTION);
  const sides = shuffleDeck(SIDE_DISTRIBUTION);
  return types.map((defenderType, i) => ({
    defenderType,
    side: sides[i],
  }));
}

export function createScenario(config = {}) {
  const defenderType =
    config.defenderType || DEFENDER_TYPES[Math.floor(Math.random() * DEFENDER_TYPES.length)];
  const side = config.side || (Math.random() < 0.5 ? 1 : -1);

  const jitterX = Math.random() * 32 - 16;
  const gap = 124 + (Math.random() * 20 - 10);
  const carrierX = PITCH.WIDTH / 2 - side * 85 + jitterX;
  const carrierY = 605;
  const runnerX = carrierX + side * gap;
  const runnerY = carrierY + SUPPORT_DEPTH;

  const carrierDriftAngle = Math.atan2(-2.34, side * 1.02);

  return {
    status: 'READY', // READY, RUNNING, TRY, TACKLED, INTERCEPTED, FORWARD_PASS, MISSED_PASS
    outcomeReason: '',
    defenderType,
    side, // 1: carrier drifts right & runner cuts left; -1: mirrored
    cutStarted: false,
    cutOrigin: null,
    cutDistY: null,
    carrier: {
      x: carrierX,
      y: carrierY,
      vx: side * 1.02,
      vy: -2.34,
      angle: carrierDriftAngle,
      hasBall: true,
    },
    runner: {
      x: runnerX,
      y: runnerY,
      vx: side * 0.35,
      vy: -2.34,
      angle: -Math.PI / 2,
      hasBall: false,
    },
    defender: {
      x: carrierX + side * (gap * 0.32),
      y: 180,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
    },
    ball: {
      x: carrierX,
      y: carrierY,
      vx: 0,
      vy: 0,
      inFlight: false,
      flightFrames: 0,
      passOriginY: null,
    },
  };
}

export function triggerCutLine(state) {
  if (state.status !== 'RUNNING' || state.cutStarted) return false;

  state.cutStarted = true;
  state.cutOrigin = { x: state.runner.x, y: state.runner.y };
  state.cutDistY = state.carrier.y - state.defender.y;
  return true;
}

export function triggerSwitchPass(state) {
  if (state.status !== 'RUNNING' || !state.cutStarted || !state.carrier.hasBall) return false;

  const { carrier, runner, ball } = state;
  carrier.hasBall = false;
  ball.inFlight = true;
  ball.flightFrames = 0;
  ball.passOriginY = carrier.y;

  const rawDist = Math.hypot(runner.x - carrier.x, runner.y - carrier.y);
  const passSpeed = rawDist < 110 ? SPEEDS.POP_PASS : SPEEDS.WIDE_PASS;

  let flightTime = Math.max(6, rawDist / passSpeed);
  const estX = runner.x + runner.vx * flightTime;
  const estY = runner.y + runner.vy * flightTime;
  flightTime = Math.max(6, Math.hypot(estX - carrier.x, estY - carrier.y) / passSpeed);

  const targetX = runner.x + runner.vx * flightTime;
  const targetY = runner.y + runner.vy * flightTime;

  ball.vx = (targetX - carrier.x) / flightTime;
  ball.vy = (targetY - carrier.y) / flightTime;
  return true;
}

function updateCarrier(state) {
  const { carrier, defender, side } = state;

  if (!carrier.hasBall) {
    const decoyVx = side * 0.55;
    const decoyVy = -1.75;
    steerEntityWithInertia(
      carrier,
      carrier.x + decoyVx * 30,
      carrier.y + decoyVy * 30,
      Math.hypot(decoyVx, decoyVy),
      0.14,
      true
    );
    return;
  }

  const outsideLimit = side === 1 ? PITCH.WIDTH - 95 : 95;
  const roomOutside = (outsideLimit - carrier.x) * side;
  let driftRatio = clamp(roomOutside / 65, 0, 1) * 0.4;

  let targetSpeed = SPEEDS.CARRIER;
  const defenderBitInside =
    state.cutStarted && (carrier.x - defender.x) * side > 42 && carrier.y - defender.y < 165;

  if (defenderBitInside || carrier.y < defender.y - 10) {
    driftRatio *= 0.25;
    targetSpeed = SPEEDS.CARRIER * 1.14;
  }

  const targetVx = side * targetSpeed * driftRatio;
  const targetVy = -targetSpeed * Math.sqrt(Math.max(0.1, 1 - driftRatio * driftRatio));

  steerEntityWithInertia(
    carrier,
    carrier.x + targetVx * 30,
    carrier.y + targetVy * 30,
    targetSpeed,
    0.16,
    true
  );
}

function updateRunner(state) {
  const { carrier, runner, ball, side } = state;

  // Hold exact running line while ball is in flight so lead pass lands cleanly
  if (ball.inFlight) {
    runner.x += runner.vx;
    runner.y += runner.vy;
    if (Math.hypot(runner.vx, runner.vy) > 0.08) {
      runner.angle = Math.atan2(runner.vy, runner.vx);
    }
    return;
  }

  const insideLimit = side === 1 ? 65 : PITCH.WIDTH - 65;
  const outsideLimit = side === 1 ? PITCH.WIDTH - 55 : 55;

  if (runner.hasBall) {
    const insideRoom = (runner.x - insideLimit) * side;
    const lateralRatio = clamp(insideRoom / 70, 0, 1) * 0.14;
    const targetVx = -side * SPEEDS.RUNNER_BREAK * lateralRatio;
    const targetVy = -SPEEDS.RUNNER_BREAK * 0.99;
    steerEntityWithInertia(
      runner,
      runner.x + targetVx * 30,
      runner.y + targetVy * 30,
      SPEEDS.RUNNER_BREAK,
      0.18,
      true
    );
    return;
  }

  if (!state.cutStarted) {
    const outsideRoom = (outsideLimit - runner.x) * side;
    const holdWidthVx = side * clamp(outsideRoom / 50, 0, 1) * 0.38;
    const desiredY = carrier.y + SUPPORT_DEPTH;
    const depthCorrection = clamp((desiredY - runner.y) * 0.12, -0.45, 0.45);
    const targetVy = -2.34 + depthCorrection;
    steerEntityWithInertia(
      runner,
      runner.x + holdWidthVx * 30,
      runner.y + targetVy * 30,
      SPEEDS.RUNNER_SUPPORT,
      0.18,
      true
    );
    return;
  }

  // Running the cut line
  const insideRoom = (runner.x - insideLimit) * side;
  const crossedDist = (carrier.x - runner.x) * side;
  const stillCuttingAcross = crossedDist < 75 && insideRoom > 60;

  let targetVx;
  let targetVy;
  if (stillCuttingAcross) {
    targetVx = -side * 1.98;
    targetVy = -2.7;
  } else {
    const gentleAngle = clamp(insideRoom / 60, 0, 1) * 0.15;
    targetVx = -side * SPEEDS.RUNNER_CUT * gentleAngle;
    targetVy = -SPEEDS.RUNNER_CUT * 0.99;
  }

  steerEntityWithInertia(
    runner,
    runner.x + targetVx * 30,
    runner.y + targetVy * 30,
    SPEEDS.RUNNER_CUT,
    0.22,
    true
  );
}

function updateDefender(state) {
  const { carrier, runner, defender, ball, defenderType, side } = state;
  const distY = carrier.y - defender.y;

  let targetX = carrier.x;
  let targetY = carrier.y;
  let speedMult = 0.88;
  let accel = 0.14;

  if (ball.inFlight) {
    targetX = runner.x + runner.vx * 6;
    targetY = runner.y - 16;
    speedMult = 1.0;
    accel = 0.085;
  } else if (runner.hasBall) {
    targetX = runner.x;
    targetY = runner.y - 12;
    speedMult = 1.02;
    accel = 0.095;
  } else {
    switch (defenderType.id) {
      case 'HARD_PRESS':
        targetX = carrier.x + side * 6;
        targetY = carrier.y + 16;
        speedMult = distY > 310 ? 0.76 : 1.0;
        accel = 0.15;
        break;

      case 'OUTSIDE_DRIFT':
        if (distY > 140) {
          targetX = carrier.x + side * 34;
          targetY = carrier.y - 28;
          speedMult = 0.85;
          accel = 0.14;
        } else {
          targetX = carrier.x + side * 8;
          targetY = carrier.y + 16;
          speedMult = 0.96;
          accel = 0.15;
        }
        break;

      case 'PATIENT_HOLD':
        if (distY > 175) {
          targetX = carrier.x + side * 14;
          targetY = defender.y + 18;
          speedMult = 0.42;
          accel = 0.12;
        } else {
          targetX = carrier.x + side * 6;
          targetY = carrier.y + 18;
          speedMult = 1.02;
          accel = 0.17;
        }
        break;

      case 'SPY_SWITCH':
        if (state.cutStarted && state.cutDistY > 75 && distY < 295) {
          const clearedInside = (carrier.x - defender.x) * side > 28;
          targetX = clearedInside ? runner.x - side * 18 : carrier.x - side * 70;
          targetY = clearedInside ? runner.y - 10 : Math.min(defender.y + 24, carrier.y - 52);
          speedMult = 1.0;
          accel = 0.18;
        } else {
          targetX = carrier.x + side * 12;
          targetY = carrier.y + 12;
          speedMult = 0.84;
          accel = 0.14;
        }
        break;
    }
  }

  steerEntityWithInertia(defender, targetX, targetY, SPEEDS.DEFENDER * speedMult, accel, true);
}

export function stepSimulation(state) {
  if (state.status !== 'RUNNING') return;

  const { carrier, runner, defender, ball } = state;

  updateCarrier(state);
  updateRunner(state);
  updateDefender(state);

  if (carrier.hasBall) {
    ball.x = carrier.x;
    ball.y = carrier.y;
  } else if (runner.hasBall) {
    ball.x = runner.x;
    ball.y = runner.y;
  } else if (ball.inFlight) {
    ball.flightFrames += 1;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (Math.hypot(ball.x - defender.x, ball.y - defender.y) <= RADII.INTERCEPT) {
      state.status = 'INTERCEPTED';
      state.outcomeReason = `Switch pass intercepted (${state.defenderType.label})`;
      ball.inFlight = false;
      return;
    }

    const distToRunner = Math.hypot(ball.x - runner.x, ball.y - runner.y);
    if (distToRunner <= RADII.CATCH && (ball.flightFrames >= 3 || distToRunner <= 9)) {
      ball.inFlight = false;
      runner.hasBall = true;

      if (runner.y < ball.passOriginY - 8) {
        state.status = 'FORWARD_PASS';
        state.outcomeReason = 'Forward pass — switch runner overran carrier';
        return;
      }
    }

    if (
      ball.x < 6 ||
      ball.x > PITCH.WIDTH - 6 ||
      ball.y < 6 ||
      ball.y > PITCH.HEIGHT - 6 ||
      ball.flightFrames > 95
    ) {
      state.status = 'MISSED_PASS';
      state.outcomeReason = 'Switch pass missed runner';
      ball.inFlight = false;
      return;
    }
  }

  const holder = carrier.hasBall ? carrier : runner.hasBall ? runner : null;
  if (holder) {
    if (Math.hypot(holder.x - defender.x, holder.y - defender.y) <= RADII.TACKLE) {
      state.status = 'TACKLED';
      const who = holder === carrier ? 'Carrier tackled' : 'Switch runner tackled';
      state.outcomeReason = `${who} (${state.defenderType.label})`;
      return;
    }

    if (holder.y <= PITCH.TRY_LINE_Y) {
      state.status = 'TRY';
      const scorer = holder === carrier ? 'Carrier scored' : 'Switch runner scored';
      state.outcomeReason = `${scorer} (${state.defenderType.label})`;
      return;
    }
  }
}
