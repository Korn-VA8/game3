/* effects.js — Screen shake, combo text, score floats */

// Screen shake
let shakeAmp = 0;
let shakeDecay = 0.9;
export let shakeX = 0;
export let shakeY = 0;

export function triggerShake(amplitude = 6) {
  shakeAmp = amplitude;
}

export function updateShake(dt) {
  if (shakeAmp > 0.5) {
    shakeX = (Math.random() - 0.5) * shakeAmp * 2;
    shakeY = (Math.random() - 0.5) * shakeAmp * 2;
    shakeAmp *= shakeDecay;
  } else {
    shakeAmp = 0;
    shakeX = 0;
    shakeY = 0;
  }
}

// Floating texts (combo, score)
const floats = [];

export function addFloatText(text, x, y, color = '#FFA502', size = 24) {
  floats.push({
    text, x, y, color, size,
    vy: -90, life: 1.4, maxLife: 1.4, alpha: 1, scale: 0
  });
}

const COMBO_TEXTS = ['NICE!', 'SWEET!', 'AMAZING!', 'JELLY COMBO!', '🔥 MEGA!'];

export function addComboText(comboLevel, x, y) {
  const idx = Math.min(comboLevel, COMBO_TEXTS.length - 1);
  const colors = ['#2ED573', '#FFA502', '#FF6B81', '#A55EEA', '#FF4757'];
  addFloatText(COMBO_TEXTS[idx], x, y, colors[idx], 28 + comboLevel * 4);
}

export function addScoreFloat(score, x, y) {
  addFloatText(`+${score}`, x, y, '#FFDA79', 20);
}

// Elastic easing function (overshoot + settle)
function elasticOut(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

export function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= 0.96;

    // Elastic scale: pop in then settle
    const age = (f.maxLife - f.life) / f.maxLife;
    if (age < 0.3) {
      f.scale = elasticOut(age / 0.3);
    } else {
      f.scale = 1;
    }

    // Fade out in last 30%
    if (age > 0.7) {
      f.alpha = 1 - (age - 0.7) / 0.3;
    } else {
      f.alpha = 1;
    }

    if (f.life <= 0) floats.splice(i, 1);
  }
}

export function renderFloats(ctx) {
  for (const f of floats) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.alpha);
    const fontSize = Math.round(f.size * f.scale);
    ctx.font = `900 ${fontSize}px Nunito, sans-serif`;
    ctx.textAlign = 'center';

    // Stroke for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(f.text, f.x, f.y);

    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}
