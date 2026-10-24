const MUTE_STORAGE_KEY = 'rugby_lab_muted';
let audioCtx = null;
let muted = false;

try {
  muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
} catch (_) {
  muted = false;
}

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function unlockAudio() {
  if (!muted) getCtx();
}

export function isAudioMuted() {
  return muted;
}

export function toggleAudioMute() {
  muted = !muted;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch (_) {
    // Ignore storage errors
  }
  if (!muted) {
    playCountdownTick(true);
  }
  return muted;
}

function randomPitchShift(spread = 0.075) {
  return 1 + (Math.random() * 2 - 1) * spread;
}

function playTone({
  freq = 440,
  endFreq = null,
  type = 'sine',
  duration = 0.08,
  gain = 0.07,
  delay = 0,
  pitchMult = randomPitchShift(),
}) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const stop = start + duration;
  const adjFreq = Math.max(20, freq * pitchMult);
  const adjEndFreq = endFreq !== null ? Math.max(20, endFreq * pitchMult) : null;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(adjFreq, start);
  if (adjEndFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(adjEndFreq, stop);
  }

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.min(0.01, duration * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(start);
  osc.stop(stop + 0.01);
}

export function playCountdownTick(isGo = false) {
  const pitchMult = randomPitchShift(0.045);
  if (isGo) {
    playTone({ freq: 660, endFreq: 740, type: 'triangle', duration: 0.065, gain: 0.06, pitchMult });
  } else {
    playTone({ freq: 440, endFreq: 420, type: 'sine', duration: 0.045, gain: 0.045, pitchMult });
  }
}

export function playWindup() {
  playTone({ freq: 230, endFreq: 290, type: 'sine', duration: 0.035, gain: 0.035, pitchMult: randomPitchShift(0.08) });
}

export function playPass(powerRatio = 0.5) {
  const startFreq = 220 + powerRatio * 140;
  const endFreq = 95 + powerRatio * 40;
  playTone({ freq: startFreq, endFreq, type: 'triangle', duration: 0.075, gain: 0.065, pitchMult: randomPitchShift(0.085) });
}

export function playCatchBoost() {
  const pitchMult = randomPitchShift(0.065);
  playTone({ freq: 523.25, endFreq: 587.33, type: 'triangle', duration: 0.07, gain: 0.065, delay: 0, pitchMult });
  playTone({ freq: 783.99, endFreq: 880, type: 'sine', duration: 0.11, gain: 0.07, delay: 0.055, pitchMult });
}

export function playCatchNormal() {
  const pitchMult = randomPitchShift(0.08);
  playTone({ freq: 240, endFreq: 130, type: 'sine', duration: 0.055, gain: 0.06, pitchMult });
  playTone({ freq: 480, endFreq: 520, type: 'triangle', duration: 0.045, gain: 0.035, delay: 0.02, pitchMult });
}

export function playCatchSlow() {
  playTone({ freq: 210, endFreq: 115, type: 'triangle', duration: 0.095, gain: 0.06, pitchMult: randomPitchShift(0.08) });
}

export function playArmsRipped() {
  // Pop + comedic falling whistle
  const pitchMult = randomPitchShift(0.09);
  playTone({ freq: 540, endFreq: 190, type: 'triangle', duration: 0.06, gain: 0.075, delay: 0, pitchMult });
  playTone({ freq: 680, endFreq: 140, type: 'sine', duration: 0.26, gain: 0.065, delay: 0.05, pitchMult });
}

export function playTag() {
  playTone({ freq: 310, endFreq: 120, type: 'triangle', duration: 0.055, gain: 0.055, pitchMult: randomPitchShift(0.09) });
}

export function playTry() {
  const pitchMult = randomPitchShift(0.06);
  playTone({ freq: 523.25, type: 'triangle', duration: 0.08, gain: 0.065, delay: 0, pitchMult });
  playTone({ freq: 659.25, type: 'triangle', duration: 0.08, gain: 0.065, delay: 0.065, pitchMult });
  playTone({ freq: 783.99, type: 'sine', duration: 0.16, gain: 0.075, delay: 0.13, pitchMult });
}

export function playError() {
  const pitchMult = randomPitchShift(0.07);
  playTone({ freq: 220, endFreq: 185, type: 'triangle', duration: 0.075, gain: 0.055, delay: 0, pitchMult });
  playTone({ freq: 175, endFreq: 135, type: 'triangle', duration: 0.11, gain: 0.055, delay: 0.07, pitchMult });
}
