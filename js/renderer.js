/* renderer.js — Canvas 2D drawing for jellies, background, and effects */

import { BUBBLE_RADIUS } from './grid.js';
import { EMOTION } from './bubble.js';

const R = BUBBLE_RADIUS;

/**
 * Draw background gradient + floating particles + ambient glow
 */
const bgParticles = Array.from({ length: 50 }, () => ({
  x: Math.random(), y: Math.random(),
  size: 1 + Math.random() * 3,
  speed: 0.003 + Math.random() * 0.008,
  alpha: 0.05 + Math.random() * 0.15,
  drift: (Math.random() - 0.5) * 0.001
}));

export function drawBackground(ctx, w, h, time) {
  // Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0F0C29');
  grad.addColorStop(0.5, '#302B63');
  grad.addColorStop(1, '#24243E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ambient glow behind grid area
  const glowX = w / 2;
  const glowY = h * 0.25;
  const glowR = w * 0.5;
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
  const pulse = 0.06 + Math.sin(time * 0.5) * 0.02;
  glow.addColorStop(0, `rgba(165, 94, 234, ${pulse})`);
  glow.addColorStop(0.5, `rgba(30, 144, 255, ${pulse * 0.5})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Floating particles
  for (const p of bgParticles) {
    p.y -= p.speed * 0.016;
    p.x += p.drift;
    if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
    if (p.x < 0) p.x = 1;
    if (p.x > 1) p.x = 0;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
    ctx.fill();
  }
}

/**
 * Draw death line with red glow
 */
export function drawDeathLine(ctx, y, w, time) {
  const pulse = 0.3 + Math.sin(time * 3) * 0.15;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 71, 87, ${pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -time * 30;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const glow = ctx.createLinearGradient(0, y - 25, 0, y + 25);
  glow.addColorStop(0, 'rgba(255, 71, 87, 0)');
  glow.addColorStop(0.5, `rgba(255, 71, 87, ${pulse * 0.3})`);
  glow.addColorStop(1, 'rgba(255, 71, 87, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, y - 25, w, 50);
  ctx.restore();
}

/**
 * Draw a jelly bubble with all animations
 */
export function drawJelly(ctx, x, y, bubble, pointerX, pointerY, activeBooster = null) {
  if (!bubble.alive && !bubble.popping) return;

  const r = R;
  const { color, emotion } = bubble;
  const idle = bubble.idleOffset;
  const drawY = y + idle;
  const alpha = bubble.falling ? bubble.fallAlpha : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Falling rotation
  if (bubble.falling) {
    ctx.translate(x, drawY);
    ctx.rotate(bubble.fallRotation);
    drawFullJelly(ctx, 0, 0, r, bubble, color, emotion, pointerX - x, pointerY - drawY, activeBooster);
    ctx.restore();
    return;
  }

  if (bubble.popping) {
    const scale = bubble.popScale;
    const popAlpha = bubble.popAlpha;
    ctx.globalAlpha = popAlpha;
    ctx.translate(x, drawY);
    ctx.scale(scale, scale);
    // During squeeze phase, close eyes
    const popEmotion = bubble.popProgress < 0.3 ? EMOTION.HAPPY : EMOTION.POP;
    const isBlinking = bubble.popProgress < 0.3;
    
    drawJellyBody(ctx, 0, 0, r, color);
    drawFrogEyeBumps(ctx, 0, 0, r, color);
    drawJellyInner(ctx, r, color);
    drawFrogBelly(ctx, 0, 0, r, color);
    drawHighlight(ctx, r);
    drawFrogCheeks(ctx, 0, 0, r);
    drawFrogEyes(ctx, 0, 0, r, popEmotion, isBlinking, 0, 0);
    drawFrogMouth(ctx, 0, 0, r, popEmotion);
    
    ctx.restore();
    return;
  }

  ctx.translate(x, drawY);

  // Combine wobble + squash deformations
  const squash = bubble.squashDeform;
  const wobbleSx = 1 + Math.sin(bubble.wobblePhase) * bubble.wobbleAmp * 0.02;
  const wobbleSy = 1 - Math.sin(bubble.wobblePhase) * bubble.wobbleAmp * 0.02;
  ctx.scale(wobbleSx * squash.sx, wobbleSy * squash.sy);

  drawFullJelly(ctx, 0, 0, r, bubble, color, emotion, pointerX - x, pointerY - drawY, activeBooster);

  ctx.restore();
}

function drawFullJelly(ctx, x, y, r, bubble, color, emotion, dx, dy, activeBooster) {
  drawJellyBody(ctx, x, y, r, color);
  drawFrogEyeBumps(ctx, x, y, r, color); // Draw bumps over body to blend perfectly
  drawJellyInner(ctx, r, color);
  drawFrogBelly(ctx, x, y, r, color);
  drawHighlight(ctx, r);
  if (activeBooster) {
    drawBoosterIcon(ctx, x, y, r, activeBooster);
  } else {
    drawFrogCheeks(ctx, x, y, r);
    drawFrogEyes(ctx, x, y, r, emotion, bubble.isBlinking, dx, dy);
    drawFrogMouth(ctx, x, y, r, emotion);
  }
}

function drawFrogEyeBumps(ctx, x, y, r, color) {
  const eyeR = r * 0.16; // Small, subtle bumps
  const eyeOffsetX = r * 0.35; // Exactly matching eyeSpacing
  const eyeOffsetY = -r * 0.55; // Exactly matching eyeY
  
  // Use the same gradient as the body to blend seamlessly
  const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  grad.addColorStop(0, colorWithAlpha(color.jelly, 0.45));
  grad.addColorStop(0.6, colorWithAlpha(color.jelly, 0.3));
  grad.addColorStop(1, colorWithAlpha(color.jelly, 0.1));
  
  ctx.fillStyle = grad;
  
  // Left bump
  ctx.beginPath();
  ctx.arc(x - eyeOffsetX, y + eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  
  // Right bump
  ctx.beginPath();
  ctx.arc(x + eyeOffsetX, y + eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrogBelly(ctx, x, y, r, color) {
  ctx.fillStyle = lighten(color.bubble, 50);
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.4, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawFrogCheeks(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(255, 105, 180, 0.4)'; // Soft pink
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.35, r * 0.12, r * 0.06, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.4, y - r * 0.35, r * 0.12, r * 0.06, 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoosterIcon(ctx, x, y, r, boosterType) {
  const ICONS = { bomb: '💣', rainbow: '🌈', lightning: '⚡' };
  ctx.font = `900 ${r * 1.2}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ICONS[boosterType] || '', x, y);
}

function drawJellyBody(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  grad.addColorStop(0, colorWithAlpha(color.jelly, 0.45));
  grad.addColorStop(0.6, colorWithAlpha(color.jelly, 0.3));
  grad.addColorStop(1, colorWithAlpha(color.jelly, 0.1));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(color.bubble, 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawJellyInner(ctx, r, color) {
  const innerR = r * 0.6;
  const innerGrad = ctx.createRadialGradient(-innerR * 0.3, -innerR * 0.3, 0, 0, 0, innerR);
  innerGrad.addColorStop(0, lighten(color.bubble, 40));
  innerGrad.addColorStop(1, color.bubble);
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();
}

function drawHighlight(ctx, r) {
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.2, r * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
  // Second smaller highlight
  ctx.beginPath();
  ctx.arc(r * 0.15, -r * 0.35, r * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
}

function drawFrogEyes(ctx, x, y, r, emotion, blinking, dx, dy) {
  const eyeSpacing = r * 0.35;
  const eyeY = -r * 0.55; // Eyes high up, near the bumps
  const eyeR = r * 0.1; // Dark dot size

  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const followX = (dx / dist) * eyeR * 0.3;
  const followY = (dy / dist) * eyeR * 0.3;

  for (const side of [-1, 1]) {
    const ex = x + eyeSpacing * side;
    const ey = y + eyeY;

    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(ex - eyeR, ey);
      ctx.lineTo(ex + eyeR, ey);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      let py = ey + followY;
      let px = ex + followX;
      if (emotion === EMOTION.SCARED) py = ey + eyeR * 0.2;
      if (emotion === EMOTION.SAD) py = ey + eyeR * 0.25;

      ctx.beginPath();
      if (emotion === EMOTION.SURPRISED) {
        ctx.arc(px, py, eyeR * 1.2, 0, Math.PI * 2);
      } else {
        ctx.arc(px, py, eyeR, 0, Math.PI * 2);
      }
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();

      // Big cute glint
      ctx.beginPath();
      ctx.arc(px + eyeR * 0.15, py - eyeR * 0.2, eyeR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
  }
}

function drawFrogMouth(ctx, x, y, r, emotion) {
  const my = y - r * 0.4; // Moved mouth up between the eyes
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a1a2e';

  switch (emotion) {
    case EMOTION.IDLE:
    case EMOTION.HAPPY:
      // Tiny cute 'W'
      ctx.beginPath();
      ctx.moveTo(x - r * 0.12, my);
      ctx.quadraticCurveTo(x - r * 0.06, my + r * 0.08, x, my + r * 0.02);
      ctx.quadraticCurveTo(x + r * 0.06, my + r * 0.08, x + r * 0.12, my);
      ctx.stroke();
      break;
    case EMOTION.POP:
      // Tiny open mouth
      ctx.beginPath();
      ctx.moveTo(x - r * 0.1, my);
      ctx.quadraticCurveTo(x, my + r * 0.05, x + r * 0.1, my);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.08, my + r * 0.02);
      ctx.quadraticCurveTo(x, my + r * 0.15, x + r * 0.08, my + r * 0.02);
      ctx.fillStyle = '#FF4757';
      ctx.fill();
      ctx.stroke();
      break;
    case EMOTION.SURPRISED:
      ctx.beginPath();
      ctx.ellipse(x, my + r * 0.05, r * 0.05, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      break;
    case EMOTION.SCARED:
      ctx.beginPath();
      ctx.moveTo(x - r * 0.12, my + r * 0.05);
      ctx.quadraticCurveTo(x - r * 0.06, my, x, my + r * 0.05);
      ctx.quadraticCurveTo(x + r * 0.06, my + r * 0.1, x + r * 0.12, my + r * 0.05);
      ctx.stroke();
      break;
    case EMOTION.SAD:
      ctx.beginPath();
      ctx.moveTo(x - r * 0.12, my + r * 0.1);
      ctx.quadraticCurveTo(x, my, x + r * 0.12, my + r * 0.1);
      ctx.stroke();
      break;
  }
}

/**
 * Draw aim line — gradient dots from bright to dim
 */
export function drawAimLine(ctx, segments, time, color) {
  if (segments.length < 2) return;
  ctx.save();

  const total = segments.length;
  const dotSpacing = 3; // draw every Nth segment point as a dot

  for (let i = 0; i < total; i += dotSpacing) {
    const s = segments[i];
    const t = i / total; // 0 at shooter, 1 at target
    const alpha = 0.6 * (1 - t * 0.7); // fade out
    const dotR = 2.5 - t * 1.2; // shrink

    // Animated pulse
    const pulse = Math.sin(time * 8 - i * 0.3) * 0.15;

    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(1, dotR + pulse), 0, Math.PI * 2);

    if (color) {
      ctx.fillStyle = colorWithAlpha(color, alpha);
    } else {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    }
    ctx.fill();
  }

  // Ghost bubble at end
  if (segments.length > 0) {
    const end = segments[segments.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, R * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw projectile trail
 */
const trailPoints = [];
const TRAIL_MAX = 8;

export function updateTrail(x, y, active) {
  if (active) {
    trailPoints.unshift({ x, y });
    if (trailPoints.length > TRAIL_MAX) trailPoints.pop();
  } else {
    trailPoints.length = 0;
  }
}

export function drawTrail(ctx, color) {
  for (let i = 0; i < trailPoints.length; i++) {
    const p = trailPoints[i];
    const t = i / TRAIL_MAX;
    const alpha = 0.3 * (1 - t);
    const size = R * 0.5 * (1 - t * 0.7);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = colorWithAlpha(color, alpha);
    ctx.fill();
  }
}

/**
 * Draw the shooter bubble at bottom
 */
export function drawShooterBubble(ctx, x, y, bubble, time, activeBooster = null) {
  if (!bubble) return;
  const r = R;

  // Pulsing ring
  const ringPulse = 1 + Math.sin(time * 3) * 0.08;
  ctx.beginPath();
  ctx.arc(x, y, (r + 6) * ringPulse, 0, Math.PI * 2);
  ctx.strokeStyle = colorWithAlpha(bubble.color.jelly, 0.2);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Outer glow
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = colorWithAlpha(bubble.color.jelly, 0.12);
  ctx.fill();

  // Draw the frog body for the shooter!
  drawFullJelly(ctx, x, y, r, bubble, bubble.color, EMOTION.IDLE, 0, 0, activeBooster);
}

// ===== UTILS =====

export function colorWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + amount);
  g = Math.min(255, g + amount);
  b = Math.min(255, b + amount);
  return `rgb(${r}, ${g}, ${b})`;
}
