/* bubble.js — Jelly bubble entity */

// Color definitions: [jellyColor, bubbleColor, name]
export const COLORS = [
  { jelly: '#FF6B81', bubble: '#FF4757', name: 'strawberry' },
  { jelly: '#FFDA79', bubble: '#FFA502', name: 'lemon' },
  { jelly: '#7BED9F', bubble: '#2ED573', name: 'lime' },
  { jelly: '#70A1FF', bubble: '#1E90FF', name: 'blueberry' },
  { jelly: '#C8A2FF', bubble: '#A55EEA', name: 'grape' },
  { jelly: '#FFB8C6', bubble: '#FF6B81', name: 'raspberry' }
];

// Emotions
export const EMOTION = {
  IDLE: 0,
  SURPRISED: 1,
  HAPPY: 2,
  SCARED: 3,
  SAD: 4,
  POP: 5
};

export class Bubble {
  constructor(colorIndex, x = 0, y = 0) {
    this.colorIndex = colorIndex;
    this.color = COLORS[colorIndex];
    this.x = x;
    this.y = y;
    this.row = -1;
    this.col = -1;
    this.emotion = EMOTION.IDLE;
    this.alive = true;

    // Wobble
    this.wobbleAmp = 0;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleDecay = 0.92;

    // Idle animation
    this.idlePhase = Math.random() * Math.PI * 2;
    this.blinkTimer = 3 + Math.random() * 4;

    // Pop animation (improved: squeeze → burst)
    this.popProgress = 0;
    this.popping = false;

    // Landing squash animation
    this.squashProgress = 0; // 0 = no squash, >0 = animating
    this.squashing = false;

    // Smooth position interpolation (for pushNewRow)
    this.targetX = x;
    this.targetY = y;
    this.lerpSpeed = 8; // how fast to lerp to target

    // Fall animation
    this.falling = false;
    this.vy = 0;
    this.vx = 0;
    this.gravity = 800;
    this.fallAlpha = 1;
    this.fallRotation = 0;
    this.fallRotSpeed = 0;
  }

  startWobble(amp = 3) {
    this.wobbleAmp = amp;
    this.wobblePhase = 0;
  }

  startPop() {
    this.popping = true;
    this.popProgress = 0;
    this.emotion = EMOTION.HAPPY; // squeeze with happy face first
  }

  startSquash() {
    this.squashing = true;
    this.squashProgress = 0;
  }

  startFall() {
    this.falling = true;
    this.emotion = EMOTION.SCARED;
    this.vy = -80 - Math.random() * 120;
    this.vx = (Math.random() - 0.5) * 150;
    this.fallRotSpeed = (Math.random() - 0.5) * 12;
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  update(dt) {
    // Idle bob
    this.idlePhase += dt * 1.5;

    // Blink timer
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 3 + Math.random() * 4;
    }

    // Wobble decay
    if (this.wobbleAmp > 0.1) {
      this.wobblePhase += dt * 15;
      this.wobbleAmp *= this.wobbleDecay;
    } else {
      this.wobbleAmp = 0;
    }

    // Squash landing animation
    if (this.squashing) {
      this.squashProgress += dt * 8;
      if (this.squashProgress >= 1) {
        this.squashing = false;
        this.squashProgress = 0;
      }
    }

    // Pop animation (squeeze → burst)
    if (this.popping) {
      this.popProgress += dt * 5;
      if (this.popProgress >= 1) {
        this.alive = false;
      }
    }

    // Smooth position lerp (for row push animation)
    if (!this.falling && !this.popping) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.x += dx * this.lerpSpeed * dt;
        this.y += dy * this.lerpSpeed * dt;
      } else {
        this.x = this.targetX;
        this.y = this.targetY;
      }
    }

    // Fall physics
    if (this.falling) {
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.fallRotation += this.fallRotSpeed * dt;
      this.fallAlpha -= dt * 0.8;
      if (this.fallAlpha <= 0) {
        this.alive = false;
        this.fallAlpha = 0;
      }
    }
  }

  get isBlinking() {
    return this.blinkTimer < 0.15;
  }

  get idleOffset() {
    return Math.sin(this.idlePhase) * 1.5;
  }

  get wobbleOffset() {
    return Math.sin(this.wobblePhase) * this.wobbleAmp;
  }

  // Squash deformation: returns {sx, sy}
  get squashDeform() {
    if (!this.squashing) return { sx: 1, sy: 1 };
    const t = this.squashProgress;
    // Elastic bounce: squash down, overshoot up, settle
    const bounce = Math.sin(t * Math.PI * 3) * Math.exp(-t * 4);
    return {
      sx: 1 + bounce * 0.25,  // wider when squashed
      sy: 1 - bounce * 0.25   // shorter when squashed
    };
  }

  // Pop deformation: squeeze → burst
  get popScale() {
    const t = this.popProgress;
    if (t < 0.3) {
      // Squeeze phase: scale down
      return 1 - t * 0.8;
    } else {
      // Burst phase: scale up fast
      const bt = (t - 0.3) / 0.7;
      return 0.76 + bt * 1.5;
    }
  }

  get popAlpha() {
    const t = this.popProgress;
    if (t < 0.3) return 1;
    return Math.max(0, 1 - ((t - 0.3) / 0.7));
  }
}

/**
 * Pick a random color index from a limited set
 */
export function randomColor(numColors) {
  return Math.floor(Math.random() * Math.min(numColors, COLORS.length));
}
