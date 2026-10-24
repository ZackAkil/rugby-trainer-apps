import { shuffleDeck } from '../shared/math.js';
import { PITCH_DEFAULT, steerEntityWithInertia } from '../shared/physics.js';

export const PITCH = PITCH_DEFAULT;

export const SPEEDS = {
  ATTACKER: 2.8,
  DEFENDER: 3.1,
  BALL: 8.5,
};

export const RADII = {
  PLAYER: 20,
  TACKLE: 28,
  INTERCEPT: 22,
  CATCH: 22,
};

export const DEFENDER_TYPES = [
  { id: 'COMMIT_CARRIER', label: 'Hard press on ball carrier' },
  { id: 'DRIFT_SUPPORT', label: 'Early drift to support runner' },
  { id: 'SOFT_SHOW', label: 'Fake drift, late bite on carrier' },
  { id: 'BAIT_PASS', label: 'Press carrier, jump pass lane' },
];

// Fixed 10-rep distribution (3x Commit, 3x Drift, 2x Soft Show, 2x Bait Pass)
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

export function createRoutineDeck() {
  return shuffleDeck(ROUTINE_DISTRIBUTION);
}

export function createScenario(defenderType) {
  const type = defenderType || DEFENDER_TYPES[Math.floor(Math.random() * DEFENDER_TYPES.length)];
  const startX = 240 + (Math.random() * 60 - 30);
  const gap = 110 + (Math.random() * 30 - 15);

  return {
    status: 'READY', // READY, RUNNING, TRY, TACKLED, INTERCEPTED, FORWARD_PASS, MISSED_PASS
    outcomeReason: '',
    defenderType: type,
    carrier: {
      x: startX,
      y: 620,
      vx: 0,
      vy: -SPEEDS.ATTACKER,
      angle: -Math.PI / 2,
      hasBall: true,
    },
    support: {
      x: startX + gap,
      y: 655,
      vx: 0,
      vy: -SPEEDS.ATTACKER,
      angle: -Math.PI / 2,
      hasBall: false,
    },
    defender: {
      x: startX + gap * 0.45,
      y: 260,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      committedTo: null,
    },
    ball: {
      x: startX,
      y: 620,
      vx: 0,
      vy: 0,
      inFlight: false,
      passOriginY: null,
    },
  };
}

export function triggerPass(state) {
  if (state.status !== 'RUNNING' || !state.carrier.hasBall) return;

  state.carrier.hasBall = false;
  state.ball.inFlight = true;
  state.ball.passOriginY = state.carrier.y;

  const dx = state.support.x - state.carrier.x;
  const lateralSpeed = SPEEDS.BALL * 0.92;
  const flightTime = Math.abs(dx) / lateralSpeed;

  const targetX = state.support.x + state.support.vx * flightTime;
  const targetY = state.support.y + state.support.vy * flightTime;

  const passDx = targetX - state.carrier.x;
  const passDy = targetY - state.carrier.y;

  state.ball.vx = passDx / flightTime;
  state.ball.vy = passDy / flightTime;
}

function updateDefender(state) {
  const { carrier, support, defender, ball, defenderType } = state;
  const distY = carrier.y - defender.y;

  let targetX = carrier.x;
  let targetY = carrier.y;
  let speedMultiplier = 0.85;
  let accel = 0.14;

  if (ball.inFlight) {
    targetX = support.x;
    targetY = support.y - 25;
    speedMultiplier = 1.0;
    accel = 0.08;
  } else if (support.hasBall) {
    targetX = support.x;
    targetY = support.y - 20;
    speedMultiplier = 1.02;
    accel = 0.09;
  } else {
    switch (defenderType.id) {
      case 'COMMIT_CARRIER':
        targetX = carrier.x;
        targetY = carrier.y + 20;
        speedMultiplier = 0.95;
        accel = 0.16;
        break;

      case 'DRIFT_SUPPORT':
        if (distY < 260) {
          targetX = support.x - 5;
          targetY = support.y - 10;
          speedMultiplier = 0.95;
          accel = 0.15;
        } else {
          targetX = (carrier.x + support.x) * 0.5;
          targetY = carrier.y - 80;
          speedMultiplier = 0.6;
        }
        break;

      case 'SOFT_SHOW':
        if (distY > 140) {
          targetX = support.x - 15;
          targetY = carrier.y - 40;
          speedMultiplier = 0.75;
        } else {
          targetX = carrier.x;
          targetY = carrier.y + 20;
          speedMultiplier = 1.05;
          accel = 0.18;
        }
        break;

      case 'BAIT_PASS':
        if (distY > 120) {
          targetX = carrier.x + 15;
          targetY = carrier.y;
          speedMultiplier = 0.85;
        } else {
          targetX = (carrier.x + support.x) * 0.68;
          targetY = support.y - 10;
          speedMultiplier = 1.0;
          accel = 0.18;
        }
        break;
    }
  }

  steerEntityWithInertia(defender, targetX, targetY, SPEEDS.DEFENDER * speedMultiplier, accel, true);
}

export function stepSimulation(state) {
  if (state.status !== 'RUNNING') return;

  const { carrier, support, defender, ball } = state;

  if (carrier.hasBall) {
    const desiredSupportY = carrier.y + 35;
    const dy = desiredSupportY - support.y;
    support.vy = -SPEEDS.ATTACKER + dy * 0.1;
  } else {
    support.vy = -SPEEDS.ATTACKER * 1.05;
    carrier.vy = -SPEEDS.ATTACKER * 0.75;
  }

  carrier.x += carrier.vx;
  carrier.y += carrier.vy;
  support.x += support.vx;
  support.y += support.vy;

  updateDefender(state);

  if (carrier.hasBall) {
    ball.x = carrier.x;
    ball.y = carrier.y;
  } else if (support.hasBall) {
    ball.x = support.x;
    ball.y = support.y;
  } else if (ball.inFlight) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (Math.hypot(ball.x - defender.x, ball.y - defender.y) <= RADII.INTERCEPT) {
      state.status = 'INTERCEPTED';
      state.outcomeReason = `Intercepted (${state.defenderType.label})`;
      ball.inFlight = false;
      return;
    }

    if (Math.hypot(ball.x - support.x, ball.y - support.y) <= RADII.CATCH) {
      ball.inFlight = false;
      support.hasBall = true;

      if (support.y < carrier.y - 4) {
        state.status = 'FORWARD_PASS';
        state.outcomeReason = 'Forward pass';
        return;
      }
    }

    if (ball.x < 0 || ball.x > PITCH.WIDTH || ball.y < 0 || ball.y > PITCH.HEIGHT) {
      state.status = 'MISSED_PASS';
      state.outcomeReason = 'Pass missed support';
      ball.inFlight = false;
      return;
    }
  }

  const holder = carrier.hasBall ? carrier : support.hasBall ? support : null;
  if (holder) {
    const tackleDist = Math.hypot(holder.x - defender.x, holder.y - defender.y);
    if (tackleDist <= RADII.TACKLE) {
      state.status = 'TACKLED';
      const who = holder === carrier ? 'Carrier tackled' : 'Support tackled';
      state.outcomeReason = `${who} (${state.defenderType.label})`;
      return;
    }

    if (holder.y <= PITCH.TRY_LINE_Y) {
      state.status = 'TRY';
      const scorer = holder === carrier ? 'Carrier scored' : 'Support scored';
      state.outcomeReason = `${scorer} (${state.defenderType.label})`;
      return;
    }
  }
}
