import { clamp, lerpAngle, shuffleDeck } from '../shared/math.js';
import { PITCH_DEFAULT, steerEntityWithInertia } from '../shared/physics.js';

export const PITCH = {
  ...PITCH_DEFAULT,
  TRY_LINE_Y: PITCH_DEFAULT.HEIGHT - 80, // 670 (defender's try line at bottom)
  SIDE_MARGIN: 34,
  TAG_RADIUS: 40,
  ARM_REACH_RADIUS: 115,
};

export const ATTACKER_PATTERNS = [
  { id: 'STRAIGHT_HARD', label: 'Straight Hard Line' },
  { id: 'INSIDE_STEP', label: 'Sharp Inside Step' },
  { id: 'OUTSIDE_STEP', label: 'Sharp Outside Step' },
  { id: 'DOUBLE_STEP', label: 'Double Feint Step' },
  { id: 'LATE_SWERVE', label: 'Late Pace Swerve' },
];

// Defender top speed cannot exceed the attacker's speed
const ATT_BASE_SPEED = 4.1;
const ATT_ACCEL = 0.13;
const DEF_MAX_SPEED = 3.9;
const DEF_ACCEL = 0.17;
const DEF_BRAKE = 0.78;

// Above this relative speed, swiping at the tag misses and play continues
const MAX_TAG_REL_SPEED = 4.6;
const WHIFF_COOLDOWN_TICKS = 32;
const TAG_ANIM_FRAMES = 42;
const COUNTDOWN_FRAMES_PER_STEP = 42;

export function createRoutineDeck() {
  return shuffleDeck([...ATTACKER_PATTERNS, ...ATTACKER_PATTERNS]);
}

export function createScenario(pattern = ATTACKER_PATTERNS[0]) {
  const attStartX = 300 + (Math.random() * 110 - 55);
  const attStartY = 110;
  const defStartX = 300 + (Math.random() * 50 - 25);
  const defStartY = 560;
  const sideBias = attStartX > 300 ? -1 : 1;

  return {
    status: 'READY', // READY | COUNTDOWN | RUNNING | TAG_ANIM | TAGGED | MISSED
    outcome: null, // TAGGED | MISSED
    pattern,
    tick: 0,
    countdownStep: 3,
    countdownTicks: 0,
    reactionTicks: null,
    tagCooldownTicks: 0,
    tagAnimTicks: 0,
    rippedTag: null,
    missedSwipePos: null,
    missedSwipeRelSpeed: null,
    tagInfo: null,
    attacker: {
      x: attStartX,
      y: attStartY,
      startX: attStartX,
      startY: attStartY,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      sideBias,
      stepTriggered: false,
      stepTick: 0,
      targetX: attStartX,
    },
    defender: {
      x: defStartX,
      y: defStartY,
      startX: defStartX,
      startY: defStartY,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      speed: 0,
    },
  };
}

function updateAttackerTarget(state) {
  const { attacker, defender, pattern, tick } = state;
  const dist = Math.hypot(attacker.x - defender.x, attacker.y - defender.y);
  const dy = defender.y - attacker.y;

  if (!attacker.stepTriggered && (dist < 175 || dy < 155 || tick > 50)) {
    attacker.stepTriggered = true;
    attacker.stepTick = tick;
  }

  let desiredX = attacker.startX;
  let speedMult = 1.0;

  switch (pattern.id) {
    case 'STRAIGHT_HARD': {
      desiredX = attacker.startX + attacker.sideBias * 28;
      speedMult = 1.04;
      break;
    }
    case 'INSIDE_STEP': {
      if (attacker.stepTriggered) {
        const dirToCenter = attacker.x > 300 ? -1 : 1;
        desiredX = attacker.startX + dirToCenter * 125;
        speedMult = 1.0;
      }
      break;
    }
    case 'OUTSIDE_STEP': {
      if (attacker.stepTriggered) {
        const dirOut = attacker.x >= 300 ? 1 : -1;
        desiredX = attacker.startX + dirOut * 130;
        speedMult = 1.0;
      }
      break;
    }
    case 'DOUBLE_STEP': {
      if (attacker.stepTriggered) {
        const elapsed = tick - attacker.stepTick;
        if (elapsed < 20) {
          desiredX = attacker.startX + attacker.sideBias * 75;
          speedMult = 0.96;
        } else {
          desiredX = attacker.startX - attacker.sideBias * 115;
          speedMult = 1.02;
        }
      }
      break;
    }
    case 'LATE_SWERVE': {
      const wave = Math.sin(tick * 0.06) * 95;
      desiredX = attacker.startX + attacker.sideBias * 40 + wave;
      speedMult = 1.03;
      break;
    }
  }

  attacker.targetX = clamp(desiredX, PITCH.SIDE_MARGIN + 20, PITCH.WIDTH - PITCH.SIDE_MARGIN - 20);
  const targetY = PITCH.TRY_LINE_Y + 35;
  steerEntityWithInertia(attacker, attacker.targetX, targetY, ATT_BASE_SPEED * speedMult, ATT_ACCEL, true);
  attacker.x = clamp(attacker.x, PITCH.SIDE_MARGIN, PITCH.WIDTH - PITCH.SIDE_MARGIN);
}

function updateDefender(state, input) {
  const { defender, attacker } = state;
  let steering = false;

  if (input.moveX !== 0 || input.moveY !== 0) {
    const mag = Math.hypot(input.moveX, input.moveY);
    const tx = defender.x + (input.moveX / mag) * 80;
    const ty = defender.y + (input.moveY / mag) * 80;
    steerEntityWithInertia(defender, tx, ty, DEF_MAX_SPEED, DEF_ACCEL, false);
    steering = true;
  } else if (input.pointerActive && input.targetX !== null && input.targetY !== null) {
    const distToTarget = Math.hypot(input.targetX - defender.x, input.targetY - defender.y);
    if (distToTarget > 12) {
      const speedScale = clamp(distToTarget / 55, 0.35, 1);
      steerEntityWithInertia(defender, input.targetX, input.targetY, DEF_MAX_SPEED * speedScale, DEF_ACCEL, false);
      steering = true;
    }
  }

  if (!steering) {
    defender.vx *= DEF_BRAKE;
    defender.vy *= DEF_BRAKE;
    if (Math.hypot(defender.vx, defender.vy) < 0.04) {
      defender.vx = 0;
      defender.vy = 0;
    }
    defender.x += defender.vx;
    defender.y += defender.vy;
  }

  defender.x = clamp(defender.x, PITCH.SIDE_MARGIN, PITCH.WIDTH - PITCH.SIDE_MARGIN);
  defender.y = clamp(defender.y, 24, PITCH.TRY_LINE_Y + 10);
  defender.speed = Math.hypot(defender.vx, defender.vy);

  // Track initial upward press reaction off GO
  if (state.reactionTicks === null && (defender.vy < -1.0 || defender.startY - defender.y > 10)) {
    state.reactionTicks = state.tick;
  }

  // Face the attacker to square up
  const toAttacker = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
  defender.angle = lerpAngle(defender.angle, toAttacker, 0.25);
}

function evaluateTagQuality(state) {
  const { defender, attacker, reactionTicks } = state;
  const relSpeed = Math.hypot(defender.vx - attacker.vx, defender.vy - attacker.vy);
  const tagY = attacker.y;
  const lateralOffset = Math.abs(defender.x - attacker.x);
  const inFront = defender.y > attacker.y + 6;

  // 1. Press & Space Taken (/4) — attacker starts at y=110 running down toward y=670
  let pressPts = 0;
  const fastReact = reactionTicks !== null && reactionTicks <= 16;
  if (tagY <= 370 && fastReact) pressPts = 4;
  else if (tagY <= 430) pressPts = 3;
  else if (tagY <= 500) pressPts = 2;
  else if (tagY <= 580) pressPts = 1;

  // 2. Stutter-Step & Pace Match (/4) — lower relative speed = moving with attacker
  let stutterPts = 1;
  if (relSpeed <= 2.2) stutterPts = 4;
  else if (relSpeed <= 3.2) stutterPts = 3;
  else if (relSpeed <= 4.0) stutterPts = 2;

  // 3. Square Body Position (/2)
  let squarePts = 0;
  if (inFront && lateralOffset <= 26) squarePts = 2;
  else if (defender.y >= attacker.y - 8 && lateralOffset <= 36) squarePts = 1;

  const total = clamp(pressPts + stutterPts + squarePts, 1, 10);

  const breakdown = [
    {
      tier: pressPts >= 3 ? 'good' : pressPts >= 2 ? 'bad' : 'ugly',
      text:
        pressPts >= 3
          ? `Press & Space (${pressPts}/4): Quick press up, shut down space early`
          : `Press & Space (${pressPts}/4): Press up faster off GO to take away space`,
    },
    {
      tier: stutterPts >= 3 ? 'good' : 'bad',
      text:
        stutterPts >= 3
          ? `Stutter & Pace (${stutterPts}/4): Matched attacker pace (relative speed ${relSpeed.toFixed(1)})`
          : `Stutter & Pace (${stutterPts}/4): Drift back with attacker to lower relative speed (${relSpeed.toFixed(1)})`,
    },
    {
      tier: squarePts === 2 ? 'good' : squarePts === 1 ? 'bad' : 'ugly',
      text:
        squarePts === 2
          ? 'Body Position (2/2): Squared up cleanly in front'
          : `Body Position (${squarePts}/2): Reached from the side/behind`,
    },
  ];

  return {
    score: total,
    relSpeed,
    tagY,
    pressPts,
    stutterPts,
    squarePts,
    breakdown,
  };
}

export function stepSimulation(state, input) {
  const events = { countdownTick: null, missedSwipe: false, tagMade: false, outcome: null };

  if (state.status === 'COUNTDOWN') {
    state.countdownTicks += 1;
    if (state.countdownTicks >= COUNTDOWN_FRAMES_PER_STEP) {
      state.countdownTicks = 0;
      state.countdownStep -= 1;
      if (state.countdownStep > 0) {
        events.countdownTick = state.countdownStep;
      } else {
        state.status = 'RUNNING';
        events.countdownTick = 'GO';
      }
    }
    return events;
  }

  if (state.status === 'TAG_ANIM') {
    state.tagAnimTicks += 1;

    // Attacker stops sharply; defender coasts to a halt
    state.attacker.vx *= 0.7;
    state.attacker.vy *= 0.7;
    state.attacker.x += state.attacker.vx;
    state.attacker.y += state.attacker.vy;

    state.defender.vx *= 0.82;
    state.defender.vy *= 0.82;
    state.defender.x += state.defender.vx;
    state.defender.y += state.defender.vy;

    if (state.rippedTag) {
      state.rippedTag.x += state.rippedTag.vx;
      state.rippedTag.y += state.rippedTag.vy;
      state.rippedTag.vy += 0.14;
      state.rippedTag.vx *= 0.96;
      state.rippedTag.angle += state.rippedTag.spin;
    }

    if (state.tagAnimTicks >= TAG_ANIM_FRAMES) {
      state.status = 'TAGGED';
      state.outcome = 'TAGGED';
      events.outcome = 'TAGGED';
    }
    return events;
  }

  if (state.status !== 'RUNNING') {
    return events;
  }

  state.tick += 1;
  if (state.tagCooldownTicks > 0) {
    state.tagCooldownTicks -= 1;
  }

  updateAttackerTarget(state);
  updateDefender(state, input);

  const dist = Math.hypot(state.attacker.x - state.defender.x, state.attacker.y - state.defender.y);

  // Auto-tag check when arms reach tag belt
  if (dist <= PITCH.TAG_RADIUS && state.tagCooldownTicks === 0) {
    const relSpeed = Math.hypot(
      state.defender.vx - state.attacker.vx,
      state.defender.vy - state.attacker.vy
    );

    if (relSpeed > MAX_TAG_REL_SPEED) {
      // Sprinted in too hot: missed tag! Play continues as attacker runs on to score
      state.tagCooldownTicks = WHIFF_COOLDOWN_TICKS;
      state.missedSwipePos = { x: state.attacker.x, y: state.attacker.y };
      state.missedSwipeRelSpeed = relSpeed;
      events.missedSwipe = true;
    } else {
      state.status = 'TAG_ANIM';
      state.tagAnimTicks = 0;
      state.tagInfo = evaluateTagQuality(state);
      const side = state.defender.x <= state.attacker.x ? 1 : -1;
      state.rippedTag = {
        x: state.attacker.x,
        y: state.attacker.y,
        vx: side * 2.2 + state.defender.vx * 0.25,
        vy: -2.6,
        angle: 0,
        spin: side * 0.24,
      };
      events.tagMade = true;
      return events;
    }
  }

  // Play continues until the attacker crosses the try line and scores
  if (state.attacker.y >= PITCH.TRY_LINE_Y) {
    state.status = 'MISSED';
    state.outcome = 'MISSED';

    const whiffedTooFast = state.missedSwipeRelSpeed !== null;
    state.tagInfo = {
      score: 0,
      relSpeed: state.missedSwipeRelSpeed || 0,
      tagY: state.attacker.y,
      whiffedTooFast,
      breakdown: whiffedTooFast
        ? [
            {
              tier: 'ugly',
              text: `Missed Tag! Relative speed too high (${state.missedSwipeRelSpeed.toFixed(1)}) — sprinted past instead of braking`,
            },
            {
              tier: 'ugly',
              text: 'Stutter-Step (0/4): Stop and move WITH the attacker before contact',
            },
            {
              tier: 'ugly',
              text: 'Try Conceded (0/10): Attacker burned past and scored',
            },
          ]
        : [
            { tier: 'ugly', text: 'Press & Space (0/4): Attacker broke the line untouched' },
            { tier: 'ugly', text: 'Stutter-Step (0/4): Failed to mirror the step' },
            { tier: 'ugly', text: 'Try Conceded (0/10): Attacker scored' },
          ],
    };
    events.outcome = 'MISSED';
    return events;
  }

  return events;
}
