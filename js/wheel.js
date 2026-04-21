/* wheel.js — Fortune Wheel with Canvas rendering + daily spin tracking */

const PRIZES = [
  { label: '💣', name: 'Бомба', color: '#FF4757' },
  { label: '🌈', name: 'Радуга', color: '#A55EEA' },
  { label: '⚡', name: 'Молния', color: '#1E90FF' },
  { label: '×2', name: '×2 Очков', color: '#FFA502' },
  { label: '🔥', name: 'Огонь', color: '#FF6B81' },
  { label: '+3', name: '+3 Хода', color: '#2ED573' },
  { label: '💎', name: 'Кристалл', color: '#70A1FF' },
  { label: '🎁', name: 'Сюрприз', color: '#FFDA79' },
];

const SEGMENTS = PRIZES.length;
const ARC = (Math.PI * 2) / SEGMENTS;

export class FortuneWheel {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.size = 280;
    this.canvas.width = this.size * 2; // hi-dpi
    this.canvas.height = this.size * 2;
    this.cx = this.size;
    this.cy = this.size;
    this.radius = this.size - 10;

    this.angle = 0;
    this.spinning = false;
    this.spinSpeed = 0;
    this.targetAngle = 0;
    this.spinStart = 0;
    this.spinDuration = 0;
    this.prizeIndex = -1;
    this.onPrizeCallback = null;

    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const cx = this.cx;
    const cy = this.cy;
    const r = this.radius;

    ctx.clearRect(0, 0, this.size * 2, this.size * 2);

    // Draw segments
    for (let i = 0; i < SEGMENTS; i++) {
      const startAngle = this.angle + i * ARC - Math.PI / 2;
      const endAngle = startAngle + ARC;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0
        ? 'rgba(48, 43, 99, 0.9)'
        : 'rgba(36, 36, 62, 0.9)';
      ctx.fill();

      // Colored edge
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = PRIZES[i].color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Prize icon
      ctx.save();
      const midAngle = startAngle + ARC / 2;
      const textR = r * 0.65;
      ctx.translate(cx + Math.cos(midAngle) * textR, cy + Math.sin(midAngle) * textR);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.font = '700 36px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(PRIZES[i].label, 0, 0);
      ctx.restore();
    }

    // Border ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner circle (hub)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.15);
    grad.addColorStop(0, '#A55EEA');
    grad.addColorStop(1, '#302B63');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hub logo
    ctx.font = '900 28px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('🎡', cx, cy);
  }

  spin(onPrize) {
    if (this.spinning) return;
    this.spinning = true;
    this.onPrizeCallback = onPrize;

    // Pick random result
    this.prizeIndex = Math.floor(Math.random() * SEGMENTS);

    // Calculate target angle: several full spins + land on prize
    const prizeAngle = this.prizeIndex * ARC + ARC / 2;
    const fullSpins = 4 + Math.random() * 3; // 4-7 full rotations
    // The pointer is at the top (-PI/2), so target angle should align the segment's offset exactly to top
    this.targetAngle = this.angle + fullSpins * Math.PI * 2 - prizeAngle;

    this.spinStart = performance.now();
    this.spinDuration = 3000 + Math.random() * 1500; // 3-4.5 seconds

    this._animate();
  }

  _animate() {
    const now = performance.now();
    const elapsed = now - this.spinStart;
    const t = Math.min(1, elapsed / this.spinDuration);

    // Ease-out (cubic)  
    const eased = 1 - Math.pow(1 - t, 3);
    const startAngle = this.angle;

    // Current angle
    const diff = this.targetAngle - startAngle;
    const currentAngle = startAngle + diff * eased;

    // Store for drawing
    const origAngle = this.angle;
    this.angle = currentAngle;
    this.draw();
    this.angle = origAngle; // keep original for next frame calc

    if (t < 1) {
      requestAnimationFrame(() => this._animate());
    } else {
      // Spin complete
      this.angle = this.targetAngle % (Math.PI * 2);
      this.spinning = false;
      this.draw();

      if (this.onPrizeCallback) {
        this.onPrizeCallback(PRIZES[this.prizeIndex]);
      }
    }
  }

  // Daily check: returns true if user can spin today
  static canSpinToday() {
    try {
      const last = localStorage.getItem('jelly_wheel_date');
      const today = new Date().toDateString();
      return last !== today;
    } catch (e) {
      return true;
    }
  }

  static markSpunToday() {
    try {
      localStorage.setItem('jelly_wheel_date', new Date().toDateString());
    } catch (e) {}
  }
}
