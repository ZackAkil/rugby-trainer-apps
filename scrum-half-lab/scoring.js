import { clamp } from '../shared/math.js';

// Target zones relative to runner.y (runner moves upfield toward -y):
// Green (Boost / Sweet Spot): y from runner.y - 44 to runner.y - 16
// Yellow (In-Stride):         y from runner.y - 16 to runner.y + 4
// Red (Behind / Slowdown):    y from runner.y + 4  to runner.y + 30
export const TARGET_ZONES = {
  HALF_WIDTH: 22,
  GREEN_TOP: -44,
  GREEN_BOT: -16,
  YELLOW_TOP: -16,
  YELLOW_BOT: 4,
  RED_TOP: 4,
  RED_BOT: 30,
};

export const GAIN_LINE_ZONES = {
  GREEN_MAX: 25,
  YELLOW_MAX: 52,
  RED_MAX: 80,
};

export function evaluateZoneCatch(state, runner, ball) {
  const relY = ball.y - runner.y; // negative = in front of runner, positive = behind runner
  const originY = ball.originY;

  // Forward pass check: ball caught above the scrum-half's pass line
  if (ball.y < originY - 3) {
    return {
      score: 0,
      label: 'FORWARD PASS',
      reason: 'You passed the ball forward over the line (0/10)',
      effect: 'STOP',
      speedMult: 0,
      breakdown: [
        { tier: 'ugly', text: 'Gain Line: You passed the ball forward over the flat line' },
      ],
    };
  }

  let baseScore = 8;
  let effect = 'STRIDE';
  let speedMult = 1.0;
  const breakdown = [];

  // 1. Runner Placement (where the ball arrived on the runner)
  if (relY <= TARGET_ZONES.GREEN_BOT) {
    baseScore = 10;
    effect = 'BOOST';
    speedMult = 1.55;
    breakdown.push({
      tier: 'good',
      text: 'Runner Target: Passed right in front of the runner for a speed boost',
    });
  } else if (relY <= TARGET_ZONES.YELLOW_BOT) {
    baseScore = 8;
    effect = 'STRIDE';
    speedMult = 1.0;
    breakdown.push({
      tier: 'bad',
      text: 'Runner Target: Passed at the runner’s body — caught, but no speed boost',
    });
  } else if (relY <= 16) {
    baseScore = 5;
    effect = 'SLOW';
    speedMult = 0.25;
    breakdown.push({
      tier: 'ugly',
      text: 'Runner Target: Passed behind the runner — forced them to reach back and slow down',
    });
  } else {
    baseScore = 3;
    effect = 'STOP';
    speedMult = 0.65;
    breakdown.push({
      tier: 'ugly',
      text: 'Runner Target: Passed way behind the runner — forced them to stop and step back',
    });
  }

  let score = baseScore;

  // 2. Gain Line (how close to the gain line the runner caught the ball)
  const depthBehindLine = ball.y - originY;
  if (depthBehindLine <= GAIN_LINE_ZONES.GREEN_MAX) {
    breakdown.push({
      tier: 'good',
      text: 'Gain Line: Caught flat right near the gain line',
    });
  } else if (depthBehindLine <= GAIN_LINE_ZONES.YELLOW_MAX) {
    score -= 1;
    breakdown.push({
      tier: 'bad',
      text: 'Gain Line: Caught a bit too far behind the gain line',
    });
  } else {
    score -= 2;
    breakdown.push({
      tier: 'ugly',
      text: 'Gain Line: Caught way too far behind the gain line',
    });
  }

  // 3. Pass Power (how hard or soft you threw the pass)
  if (ball.speed >= 5.0 && ball.speed <= 9.8) {
    breakdown.push({
      tier: 'good',
      text: 'Pass Power: Good pass speed — firm and easy to catch',
    });
  } else if (ball.speed < 4.2) {
    score -= 2;
    breakdown.push({
      tier: 'ugly',
      text: 'Pass Power: You threw the ball way too softly',
    });
  } else if (ball.speed < 5.0) {
    score -= 1;
    breakdown.push({
      tier: 'bad',
      text: 'Pass Power: You threw the ball a bit too softly',
    });
  } else if (ball.speed <= 10.8) {
    score -= 1;
    breakdown.push({
      tier: 'bad',
      text: 'Pass Power: You threw the ball a bit too hard',
    });
  } else {
    score -= 2;
    breakdown.push({
      tier: 'ugly',
      text: 'Pass Power: You threw the ball way too hard',
    });
  }

  // 4. Release Speed (how quickly you released the pass after pressing down)
  const wf = Math.max(1, state.windupFrames || 1);
  const releaseSec = (wf / 60).toFixed(2);
  if (wf <= 18) {
    breakdown.push({
      tier: 'good',
      text: `Release Speed: Fast release (${releaseSec}s) — passed before defenders moved up`,
    });
  } else if (wf <= 38) {
    score -= 1;
    breakdown.push({
      tier: 'bad',
      text: `Release Speed: Slow release (${releaseSec}s) — held the ball and let defenders move up`,
    });
  } else {
    score -= 2;
    breakdown.push({
      tier: 'ugly',
      text: `Release Speed: Very slow release (${releaseSec}s) — held way too long while defenders rushed up`,
    });
  }

  score = clamp(score, 1, 10);

  let label = 'GOOD PASS — IN STRIDE';
  if (effect === 'BOOST' && score >= 9) label = 'GREAT PASS — SPEED BOOST!';
  else if (effect === 'BOOST') label = 'IN FRONT — SPEED BOOST';
  else if (effect === 'STRIDE') label = 'CAUGHT AT BODY';
  else if (effect === 'SLOW') label = 'BEHIND RUNNER — SLOWED';
  else if (effect === 'STOP') label = 'WAY BEHIND — STOPPED';

  return {
    score,
    label,
    reason: `${score}/10`,
    effect,
    speedMult,
    breakdown,
  };
}
