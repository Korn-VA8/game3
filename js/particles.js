/* particles.js — Particle system with object pooling */

const MAX_PARTICLES = 300;

const pool = [];
for (let i = 0; i < MAX_PARTICLES; i++) {
  pool.push({
    alive: false, x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 0, color: '#fff', size: 2,
    type: 'splash', alpha: 1, gravity: 400, rotation: 0
  });
}

function getParticle() {
  for (const p of pool) {
    if (!p.alive) return p;
  }
  return null;
}

/**
 * Emit splash particles (colored drops from popping)
 */
export function emitSplash(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const p = getParticle();
    if (!p) break;
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = 120 + Math.random() * 220;
    p.alive = true;
    p.x = x; p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0.5 + Math.random() * 0.4;
    p.maxLife = p.life;
    p.color = color;
    p.size = 3 + Math.random() * 4;
    p.type = 'splash';
    p.alpha = 1;
    p.gravity = 350 + Math.random() * 200;
    p.rotation = 0;
  }
}

/**
 * Emit sparkle particles (4-pointed stars)
 */
export function emitSparkle(x, y, count = 5) {
  for (let i = 0; i < count; i++) {
    const p = getParticle();
    if (!p) break;
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 80;
    p.alive = true;
    p.x = x + (Math.random() - 0.5) * 20;
    p.y = y + (Math.random() - 0.5) * 20;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - 50;
    p.life = 0.5 + Math.random() * 0.4;
    p.maxLife = p.life;
    p.color = '#fff';
    p.size = 2 + Math.random() * 3;
    p.type = 'sparkle';
    p.alpha = 1;
    p.gravity = -30;
    p.rotation = Math.random() * Math.PI;
  }
}

/**
 * Emit expanding ring (pop ring)
 */
export function emitRing(x, y, color) {
  const p = getParticle();
  if (!p) return;
  p.alive = true;
  p.x = x; p.y = y;
  p.vx = 0; p.vy = 0;
  p.life = 0.4;
  p.maxLife = 0.4;
  p.color = color;
  p.size = 4;
  p.type = 'ring';
  p.alpha = 1;
  p.gravity = 0;
  p.rotation = 0;
}

export function updateParticles(dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }

    if (p.type === 'ring') {
      // Ring expands
      const t = 1 - p.life / p.maxLife;
      p.size = 4 + t * 40;
      p.alpha = 1 - t;
    } else {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= 0.993;
      if (p.type === 'sparkle') {
        p.rotation += dt * 5;
      }
    }
  }
}

export function renderParticles(ctx) {
  for (const p of pool) {
    if (!p.alive) continue;
    ctx.save();
    ctx.globalAlpha = p.alpha;

    if (p.type === 'ring') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * p.alpha;
      ctx.stroke();
    } else if (p.type === 'sparkle') {
      // 4-pointed star
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      drawStar(ctx, p.size, p.color);
    } else {
      // Circle splash
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStar(ctx, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  // 4-pointed star shape
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const ox = Math.cos(angle) * size;
    const oy = Math.sin(angle) * size;
    const ix = Math.cos(angle + Math.PI / 4) * size * 0.3;
    const iy = Math.sin(angle + Math.PI / 4) * size * 0.3;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
}
