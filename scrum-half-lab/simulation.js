import { clamp, lerpAngle } from '../shared/math.js';
import {
  PITCH_DEFAULT,
  steerEntityWithInertia,
  stepBallFlight,
  bounceBallInPitch,
  createRippedArmsState,
  stepRippedArmsPhysics,
} from '../shared/physics.js';
import { TARGET_ZONES, GAIN_LINE_ZONES, evaluateZoneCatch } from './scoring.js';

export const PITCH = PITCH_DEFAULT;
export { TARGET_ZONES, GAIN_LINE_ZONES };

export const RADII = {
  TAG: 26,
};

const DEF_LINE_DISTANCE = 230; // ~6-7m back from the ruck
const COUNTDOWN_FRAMES = 108;  // 3-2-1 countdown (~1.8s at 60fps)

export function createInitialGame() {
  const ruckX = 300;
  const ruckY = 420;

  return {
    phase: 'READY', // READY, FORMING_RUCK, COUNTDOWN, PASS_WINDOW, BALL_FLIGHT, RUN_TO_TAG, REP_END
    countdownFrames: 0,
    countdownNumber: 3,
    runElapsedFrames: 0,
    ruckX,
    ruckY,
    runnerSide: 1,
    runnerTopSpeed: 2.5,
    runnerTargetSpeed: 2.5,
    runnerTargetX: 430,
    passWindupStarted: false,
    windupFrames: 0,
    catchEffect: null, // 'BOOST', 'STRIDE', 'SLOW', 'STOP', 'ARMS_OFF'
    catchEffectTimer: 0,
    armsRipped: false,
    armsRippedTimer: 0,
    rippedArms: null,
    lastRepScore: 0,
    lastRepLabel: '',
    lastRepReason: '',
    lastRepBreakdown: [],
    attackers: [
      { id: 'A1', x: ruckX, y: ruckY, vx: 0, vy: 0, angle: -Math.PI / 2, role: 'TAGGED' },
      { id: 'A2', x: ruckX, y: ruckY + 28, vx: 0, vy: 0, angle: -Math.PI / 2, role: 'SCRUM_HALF' },
      { id: 'A3', x: ruckX + 135, y: ruckY + 230, vx: 0, vy: 0, angle: -Math.PI / 2, role: 'RUNNER' },
    ],
    defenders: [
      { id: 'D1', x: ruckX + 20, y: ruckY - 10, vx: 0, vy: 0, angle: Math.PI / 2, role: 'MARKER' },
      { id: 'D2', x: 180, y: ruckY - DEF_LINE_DISTANCE, vx: 0, vy: 0, angle: Math.PI / 2, role: 'LINE' },
      { id: 'D3', x: 420, y: ruckY - DEF_LINE_DISTANCE, vx: 0, vy: 0, angle: Math.PI / 2, role: 'LINE' },
    ],
    ball: {
      x: ruckX,
      y: ruckY + 20,
      vx: 0,
      vy: 0,
      speed: 0,
      launchSpeed: 0,
      spinAngle: 0,
      spinRate: 0,
      inFlight: false,
      holderId: 'A2',
      originX: ruckX,
      originY: ruckY + 20,
    },
  };
}

function rotateRolesAfterTag(state, catcher, tagger) {
  const prevTagged = state.attackers.find((a) => a.role === 'TAGGED');
  const prevSH = state.attackers.find((a) => a.role === 'SCRUM_HALF');

  catcher.role = 'TAGGED';
  prevSH.role = 'SCRUM_HALF';
  prevTagged.role = 'RUNNER';

  state.defenders.forEach((d) => {
    d.role = d === tagger ? 'MARKER' : 'LINE';
  });

  state.ruckX = catcher.x;
  state.ruckY = catcher.y;
}

export function setupNextPlay(state, isFirstRep = false) {
  if (!isFirstRep && state.pendingTagRotation) {
    rotateRolesAfterTag(state, state.pendingTagRotation.catcher, state.pendingTagRotation.tagger);
    state.pendingTagRotation = null;
  }

  if (isFirstRep) {
    state.ruckX = 260 + Math.random() * 80;
    state.ruckY = 420;
  } else {
    state.ruckX = clamp(state.ruckX, 160, 440);
    state.ruckY = 420;
  }

  if (state.ruckX < 210) {
    state.runnerSide = 1;
  } else if (state.ruckX > 390) {
    state.runnerSide = -1;
  } else {
    state.runnerSide = Math.random() < 0.5 ? 1 : -1;
  }

  const lateralGap = 115 + Math.random() * 85;
  const startDepth = 205 + Math.random() * 60;
  state.runnerTopSpeed = 2.1 + Math.random() * 1.1;
  state.runnerTargetSpeed = state.runnerTopSpeed;
  state.runnerTargetX = clamp(state.ruckX + state.runnerSide * lateralGap, 70, PITCH.WIDTH - 70);
  state.runnerStartDepth = startDepth;
  state.runElapsedFrames = 0;
  state.passWindupStarted = false;
  state.windupFrames = 0;
  state.catchEffect = null;
  state.catchEffectTimer = 0;
  state.armsRipped = false;
  state.armsRippedTimer = 0;
  state.rippedArms = null;
  state.lastRepBreakdown = [];

  state.attackers.forEach((a) => {
    a.vx = 0;
    a.vy = 0;
  });
  state.defenders.forEach((d) => {
    d.vx = 0;
    d.vy = 0;
  });

  const tagged = state.attackers.find((a) => a.role === 'TAGGED');
  const sh = state.attackers.find((a) => a.role === 'SCRUM_HALF');
  const runner = state.attackers.find((a) => a.role === 'RUNNER');
  const marker = state.defenders.find((d) => d.role === 'MARKER');
  const lineDefs = state.defenders.filter((d) => d.role === 'LINE');

  if (isFirstRep) {
    tagged.x = state.ruckX;
    tagged.y = state.ruckY;
    tagged.angle = -Math.PI / 2;

    marker.x = state.ruckX + 20;
    marker.y = state.ruckY - 10;
    marker.angle = Math.PI / 2;

    sh.x = state.ruckX;
    sh.y = state.ruckY + 28;
    sh.angle = -Math.PI / 2;

    runner.x = state.runnerTargetX;
    runner.y = state.ruckY + startDepth;
    runner.angle = -Math.PI / 2;

    const defLineY = state.ruckY - DEF_LINE_DISTANCE;
    lineDefs[0].x = clamp(state.ruckX - 115, 60, PITCH.WIDTH - 60);
    lineDefs[0].y = defLineY;
    lineDefs[0].angle = Math.PI / 2;

    lineDefs[1].x = clamp(state.ruckX + 115, 60, PITCH.WIDTH - 60);
    lineDefs[1].y = defLineY;
    lineDefs[1].angle = Math.PI / 2;

    state.ball.x = sh.x;
    state.ball.y = sh.y - 8;
    state.ball.inFlight = false;
    state.ball.holderId = sh.id;

    state.countdownFrames = COUNTDOWN_FRAMES;
    state.countdownNumber = 3;
    state.phase = 'COUNTDOWN';
  } else {
    state.phase = 'FORMING_RUCK';
  }
}

export function triggerPassWindup(state) {
  if (state.phase === 'PASS_WINDOW' || state.phase === 'COUNTDOWN') {
    state.passWindupStarted = true;
  }
}

export function launchSwipePass(state, dx, dy) {
  if (state.phase !== 'PASS_WINDOW') return false;

  const dragDist = Math.hypot(dx, dy);
  if (dragDist < 12) return false;

  const sh = state.attackers.find((a) => a.role === 'SCRUM_HALF');
  const speed = clamp(dragDist * 0.064, 2.5, 14.2);
  const angle = Math.atan2(dy, dx);

  sh.angle = angle;
  state.passWindupStarted = true;
  state.ball.originX = state.ball.x;
  state.ball.originY = state.ball.y;
  state.ball.vx = Math.cos(angle) * speed;
  state.ball.vy = Math.sin(angle) * speed;
  state.ball.speed = speed;
  state.ball.launchSpeed = speed;
  state.ball.spinAngle = angle;
  state.ball.spinRate = 0;
  state.ball.inFlight = true;
  state.ball.holderId = null;

  state.phase = 'BALL_FLIGHT';
  return true;
}

function advanceDefendersWithInertia(lineDefs, runner, maxSpeed, accel) {
  lineDefs.forEach((d) => {
    steerEntityWithInertia(d, runner.x, runner.y - 22, maxSpeed, accel, true);
  });
}

function triggerArmsRipped(state, runner, ball) {
  state.armsRipped = true;
  state.armsRippedTimer = 46;
  state.catchEffect = 'ARMS_OFF';
  state.lastRepScore = 0;
  state.lastRepLabel = 'TOO FAST — ARMS RIPPED OFF!';
  state.lastRepReason = 'You threw the ball way too fast — ripped the runner’s arms off (0/10)';
  state.lastRepBreakdown = [
    { tier: 'ugly', text: 'Pass Power: You threw the ball way too fast — ripped the runner’s arms clean off!' },
  ];

  ball.vx *= 0.88;
  ball.vy = ball.vy * 0.85 + runner.vy * 0.25;
  ball.speed = Math.hypot(ball.vx, ball.vy);
  ball.spinAngle = Math.atan2(ball.vy, ball.vx);
  ball.spinRate = (state.runnerSide === 1 ? 1 : -1) * 0.28;
  ball.inFlight = true;
  ball.holderId = null;

  state.rippedArms = createRippedArmsState(runner, ball);
}

export function stepSimulation(state) {
  const tagged = state.attackers.find((a) => a.role === 'TAGGED');
  const sh = state.attackers.find((a) => a.role === 'SCRUM_HALF');
  const runner = state.attackers.find((a) => a.role === 'RUNNER');
  const marker = state.defenders.find((d) => d.role === 'MARKER');
  const lineDefs = state.defenders.filter((d) => d.role === 'LINE');
  const { ball } = state;

  if (state.phase === 'FORMING_RUCK') {
    const targetRuckY = 420;
    const targetRuckX = clamp(state.ruckX, 160, 440);
    const shiftY = (targetRuckY - tagged.y) * 0.14;
    const shiftX = (targetRuckX - tagged.x) * 0.14;

    tagged.x += shiftX;
    tagged.y += shiftY;
    tagged.angle = lerpAngle(tagged.angle, -Math.PI / 2, 0.2);

    const markerTargetX = tagged.x + 20;
    const markerTargetY = tagged.y - 10;
    marker.x += (markerTargetX - marker.x) * 0.18;
    marker.y += (markerTargetY - marker.y) * 0.18;
    marker.angle = lerpAngle(marker.angle, Math.PI / 2, 0.2);

    const shTargetX = tagged.x;
    const shTargetY = tagged.y + 28;
    const shDx = shTargetX - sh.x;
    const shDy = shTargetY - sh.y;
    sh.x += shDx * 0.16;
    sh.y += shDy * 0.16;
    sh.angle = Math.hypot(shDx, shDy) > 4 ? Math.atan2(shDy, shDx) : lerpAngle(sh.angle, -Math.PI / 2, 0.25);

    const runnerTargetY = targetRuckY + state.runnerStartDepth;
    const rDx = state.runnerTargetX - runner.x;
    const rDy = runnerTargetY - runner.y;
    runner.x += rDx * 0.14;
    runner.y += rDy * 0.14;
    runner.angle = Math.hypot(rDx, rDy) > 5 ? Math.atan2(rDy, rDx) : lerpAngle(runner.angle, -Math.PI / 2, 0.25);

    const defLineY = targetRuckY - DEF_LINE_DISTANCE;
    const d0TargetX = clamp(targetRuckX - 115, 60, PITCH.WIDTH - 60);
    const d1TargetX = clamp(targetRuckX + 115, 60, PITCH.WIDTH - 60);

    lineDefs[0].x += (d0TargetX - lineDefs[0].x) * 0.14;
    lineDefs[0].y += (defLineY - lineDefs[0].y) * 0.14;
    lineDefs[0].angle = lerpAngle(lineDefs[0].angle, Math.PI / 2, 0.2);

    lineDefs[1].x += (d1TargetX - lineDefs[1].x) * 0.14;
    lineDefs[1].y += (defLineY - lineDefs[1].y) * 0.14;
    lineDefs[1].angle = lerpAngle(lineDefs[1].angle, Math.PI / 2, 0.2);

    ball.x = tagged.x;
    ball.y = tagged.y + 16;

    if (
      Math.hypot(shTargetX - sh.x, shTargetY - sh.y) < 3 &&
      Math.hypot(rDx, rDy) < 4 &&
      Math.abs(targetRuckY - tagged.y) < 2
    ) {
      state.ruckX = tagged.x;
      state.ruckY = tagged.y;
      sh.angle = -Math.PI / 2;
      runner.angle = -Math.PI / 2;
      runner.vx = 0;
      runner.vy = 0;
      lineDefs.forEach((d) => {
        d.vx = 0;
        d.vy = 0;
      });
      ball.x = sh.x;
      ball.y = sh.y - 8;
      ball.holderId = sh.id;
      state.countdownFrames = COUNTDOWN_FRAMES;
      state.countdownNumber = 3;
      state.phase = 'COUNTDOWN';
    }
    return;
  }

  if (state.phase === 'COUNTDOWN') {
    state.countdownFrames -= 1;
    state.countdownNumber = Math.max(1, Math.ceil((state.countdownFrames / COUNTDOWN_FRAMES) * 3));
    if (state.countdownFrames <= 0) {
      state.phase = 'PASS_WINDOW';
    }
    return;
  }

  if (state.phase === 'PASS_WINDOW') {
    state.runElapsedFrames += 1;

    const desiredVy = -state.runnerTopSpeed;
    runner.vy += (desiredVy - runner.vy) * 0.045;
    runner.y += runner.vy;
    runner.angle = -Math.PI / 2;

    if (state.passWindupStarted) {
      state.windupFrames += 1;
      advanceDefendersWithInertia(lineDefs, runner, 1.85, 0.035);
    }

    if (runner.y < state.ruckY - 65) {
      state.lastRepScore = 0;
      state.lastRepLabel = 'HELD BALL TOO LONG';
      state.lastRepReason = 'You waited too long to pass — the runner ran past the ruck (0/10)';
      state.lastRepBreakdown = [
        { tier: 'ugly', text: 'Release Speed: You waited too long to pass — the runner ran past the ruck' },
      ];
      state.phase = 'REP_END';
    }
    return;
  }

  if (state.phase === 'BALL_FLIGHT') {
    state.runElapsedFrames += 1;

    if (state.armsRipped) {
      state.armsRippedTimer -= 1;

      runner.vy *= 0.91;
      runner.y += runner.vy;
      runner.angle = -Math.PI / 2 + Math.sin(state.armsRippedTimer * 0.55) * 0.22;

      advanceDefendersWithInertia(lineDefs, runner, 0.7, 0.03);
      stepBallFlight(ball, 0.982);
      bounceBallInPitch(ball, PITCH, 22, 0.75);
      stepRippedArmsPhysics(state.rippedArms, ball, state.runElapsedFrames);

      if (state.armsRippedTimer <= 0) {
        ball.inFlight = false;
        state.phase = 'REP_END';
      }
      return;
    }

    const dxToRunner = Math.abs(ball.x - runner.x);
    const relY = ball.y - runner.y;
    const approachingGreen =
      dxToRunner < 55 && relY >= TARGET_ZONES.GREEN_TOP - 8 && relY <= TARGET_ZONES.GREEN_BOT;

    const desiredVy = -(approachingGreen ? state.runnerTopSpeed * 1.3 : state.runnerTopSpeed);
    runner.vy += (desiredVy - runner.vy) * (approachingGreen ? 0.14 : 0.05);
    runner.y += runner.vy;
    runner.angle = -Math.PI / 2;

    advanceDefendersWithInertia(lineDefs, runner, 1.9, 0.04);
    stepBallFlight(ball, 0.985);

    for (const d of lineDefs) {
      if (Math.hypot(ball.x - d.x, ball.y - d.y) <= 22) {
        ball.inFlight = false;
        state.lastRepScore = 0;
        state.lastRepLabel = 'INTERCEPTED';
        state.lastRepReason = 'You threw the ball straight into a defender (0/10)';
        state.lastRepBreakdown = [
          { tier: 'ugly', text: 'Pass Aim: You threw the ball straight into a defender' },
        ];
        state.phase = 'REP_END';
        return;
      }
    }

    const inLaneX = Math.abs(ball.x - runner.x) <= TARGET_ZONES.HALF_WIDTH;
    const relCatchY = ball.y - runner.y;
    const inZoneY = relCatchY >= TARGET_ZONES.GREEN_TOP && relCatchY <= TARGET_ZONES.RED_BOT;

    if (inLaneX && inZoneY) {
      const isTooFast = ball.speed >= 8.2 || (ball.launchSpeed && ball.launchSpeed >= 10.4);
      if (isTooFast) {
        triggerArmsRipped(state, runner, ball);
        return;
      }

      ball.inFlight = false;
      ball.holderId = runner.id;

      const result = evaluateZoneCatch(state, runner, ball);
      state.lastRepScore = result.score;
      state.lastRepLabel = result.label;
      state.lastRepReason = result.reason;
      state.lastRepBreakdown = result.breakdown;
      state.catchEffect = result.effect;
      state.catchEffectTimer = 45;
      state.runnerTargetSpeed = state.runnerTopSpeed * result.speedMult;

      state.catchOffsetX = clamp(ball.x - runner.x, -22, 22);
      state.catchOffsetY = clamp(ball.y - runner.y, -34, 28);

      if (result.effect === 'BOOST') {
        runner.vy = -state.runnerTargetSpeed;
      } else if (result.effect === 'STOP') {
        runner.vy *= 0.15;
      } else if (result.effect === 'SLOW') {
        runner.vy *= 0.4;
      }

      state.phase = result.score === 0 ? 'REP_END' : 'RUN_TO_TAG';
      return;
    }

    const passedRunner =
      (state.runnerSide === 1 && ball.x > runner.x + 55) ||
      (state.runnerSide === -1 && ball.x < runner.x - 55);

    if (
      ball.speed < 0.8 ||
      passedRunner ||
      ball.x < 10 ||
      ball.x > PITCH.WIDTH - 10 ||
      ball.y < 10 ||
      ball.y > PITCH.HEIGHT - 10
    ) {
      ball.inFlight = false;
      state.lastRepScore = 0;
      if (ball.speed < 0.8) {
        state.lastRepLabel = 'PASS TOO SOFT';
        state.lastRepReason = 'You threw the ball too softly — it stopped before reaching the runner (0/10)';
        state.lastRepBreakdown = [
          { tier: 'ugly', text: 'Pass Power: You threw the ball too softly — it stopped before reaching the runner' },
        ];
      } else {
        state.lastRepLabel = 'MISSED RUNNER';
        state.lastRepReason = 'Your pass missed the runner completely (0/10)';
        state.lastRepBreakdown = [
          { tier: 'ugly', text: 'Pass Aim: Your pass missed the runner completely' },
        ];
      }
      state.phase = 'REP_END';
    }
    return;
  }

  if (state.phase === 'RUN_TO_TAG') {
    if (state.catchEffectTimer > 0) {
      state.catchEffectTimer -= 1;
    }

    const desiredVy = -state.runnerTargetSpeed;
    runner.vy += (desiredVy - runner.vy) * 0.12;
    runner.y += runner.vy;
    runner.angle = -Math.PI / 2;

    const targetCarryY = state.catchEffect === 'BOOST' ? -22 : state.catchEffect === 'STOP' ? 14 : -14;
    state.catchOffsetX += (0 - state.catchOffsetX) * 0.06;
    state.catchOffsetY += (targetCarryY - state.catchOffsetY) * 0.06;
    ball.x = runner.x + state.catchOffsetX;
    ball.y = runner.y + state.catchOffsetY;

    let closestDef = lineDefs[0];
    let minDist = Infinity;
    lineDefs.forEach((d) => {
      const distToRunner = Math.hypot(runner.x - d.x, runner.y - d.y);
      if (distToRunner < minDist) {
        minDist = distToRunner;
        closestDef = d;
      }
    });

    lineDefs.forEach((d) => {
      const targetX = d === closestDef ? runner.x : (runner.x + d.x) * 0.5;
      const targetY = d === closestDef ? runner.y : runner.y - 40;
      const maxSpd = d === closestDef ? 2.6 : 1.8;
      steerEntityWithInertia(d, targetX, targetY, maxSpd, 0.06, true);
    });

    if (runner.y <= PITCH.TRY_LINE_Y) {
      state.lastRepScore += 2;
      state.lastRepLabel = 'CLEAN BREAK TRY! (+2 BONUS)';
      state.lastRepReason = `${state.lastRepReason.replace(/\s*\(\d+\/10\)$/, '')} + Try Bonus (${state.lastRepScore}/10)`;
      state.pendingTagRotation = { catcher: runner, tagger: closestDef };
      state.phase = 'REP_END';
      return;
    }

    if (minDist <= RADII.TAG) {
      state.pendingTagRotation = { catcher: runner, tagger: closestDef };
      state.phase = 'REP_END';
    }
  }
}
