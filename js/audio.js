/* audio.js — Procedural sound via Web Audio API */

let audioCtx = null;
let masterGain = null;
let muted = false;

export function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(audioCtx.destination);
}

export function resumeAudio() {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}

export function suspendAudio() {
  if (audioCtx?.state === 'running') audioCtx.suspend();
}

export function setMuted(m) {
  muted = m;
  if (masterGain) masterGain.gain.value = m ? 0 : 0.5;
}

function playTone(freq, duration, type = 'sine', volume = 0.3) {
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration, volume = 0.1) {
  if (!audioCtx || muted) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start();
}

// --- Sound effects ---

export function playShoot() {
  playNoise(0.08, 0.15);
  playTone(300, 0.1, 'sine', 0.15);
}

export function playStick() {
  playTone(200, 0.12, 'sine', 0.2);
  playNoise(0.06, 0.1);
}

export function playPop(index = 0) {
  const baseFreq = 500 + index * 80;
  playTone(baseFreq, 0.15, 'sine', 0.25);
  playTone(baseFreq * 1.5, 0.1, 'triangle', 0.1);
}

export function playCascade(count) {
  const notes = [523, 587, 659, 784, 880, 988, 1047, 1175];
  for (let i = 0; i < Math.min(count, notes.length); i++) {
    setTimeout(() => playTone(notes[i], 0.2, 'sine', 0.2), i * 60);
  }
}

export function playCombo(level) {
  const chords = [
    [523, 659, 784],      // C major
    [587, 740, 880],      // D major
    [659, 830, 988],      // E major
    [784, 988, 1175],     // G major
  ];
  const chord = chords[Math.min(level, chords.length - 1)];
  for (const freq of chord) {
    playTone(freq, 0.4, 'sine', 0.12);
  }
}

export function playWin() {
  const melody = [523, 659, 784, 1047];
  melody.forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'triangle', 0.2), i * 120));
}

export function playLose() {
  const melody = [400, 350, 300, 250];
  melody.forEach((f, i) => setTimeout(() => playTone(f, 0.4, 'sine', 0.15), i * 150));
}
