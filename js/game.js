/* game.js — Core game logic orchestrator (INFINITE MODE) */

import { COLS, BUBBLE_RADIUS, BUBBLE_DIAMETER, ROW_HEIGHT, gridToPixel, pixelToGrid, maxColsForRow, findColorGroup, findOrphans, createGrid, getNeighbors } from './grid.js';
import { Bubble, randomColor, COLORS, EMOTION } from './bubble.js';
import { drawJelly, drawShooterBubble, drawAimLine, drawBackground, drawDeathLine, updateTrail, drawTrail, colorWithAlpha } from './renderer.js';
import { emitSplash, emitSparkle, emitRing, updateParticles, renderParticles } from './particles.js';
import { triggerShake, updateShake, shakeX, shakeY, addComboText, addScoreFloat, updateFloats, renderFloats } from './effects.js';
import { playShoot, playStick, playPop, playCascade, playCombo, playWin, playLose } from './audio.js';

// ===== GAME STATE =====
const STATE = { LOADING: 0, MENU: 1, PLAYING: 2, PAUSED: 3, GAME_OVER: 4 };

class Game {
  constructor() {
    this.state = STATE.LOADING;
    this.grid = [];
    this.gridOffsetX = 0;
    this.gridOffsetY = 0;
    this.score = 0;
    this.highScore = 0;
    this.numColors = 4;
    this.shotsFired = 0;
    this.shotsPerRow = 4;
    this.shotsUntilNewRow = 4;

    // Projectile
    this.projectile = null;
    this.projSpeed = 650;

    // Shooter
    this.currentBubble = null;
    this.nextBubble = null;
    this.shooterX = 0;
    this.shooterY = 0;

    // Pointer
    this.pointerX = 0;
    this.pointerY = 0;
    this.aimAngle = -Math.PI / 2;

    // Death line
    this.deathLineY = 0;

    // Pause for animations
    this.animDelay = 0;

    // Combo tracking
    this.combo = 0;

    // Canvas dimensions
    this.width = 0;
    this.height = 0;

    // Time
    this.time = 0;

    // Falling bubbles (detached from grid but still rendering)
    this.fallingBubbles = [];

    // Callback hooks for UI/SDK
    this.onGameOver = null;
    this.onScoreChange = null;
    this.onShotCountChange = null;
    this.onBoosterChange = null;

    // Boosters inventory
    this.boosters = { bomb: 0, rainbow: 0, lightning: 0 };
    this.activeBooster = null; // 'bomb' | 'rainbow' | 'lightning' | null
  }

  init(w, h) {
    this.width = w;
    this.height = h;
    this.gridOffsetX = Math.floor((w - (COLS * BUBBLE_DIAMETER)) / 2);
    this.gridOffsetY = 40;
    this.deathLineY = h - 120;
    this.shooterX = w / 2;
    this.shooterY = h - 60;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.gridOffsetX = Math.floor((w - (COLS * BUBBLE_DIAMETER)) / 2);
    this.deathLineY = h - 120;
    this.shooterX = w / 2;
    this.shooterY = h - 60;
    this.refreshBubblePositions();
  }

  /**
   * Start infinite mode game
   */
  startGame() {
    this.score = 0;
    this.shotsFired = 0;
    this.numColors = 4;
    this.combo = 0;
    this.animDelay = 0;
    this.fallingBubbles = [];
    this.shotsPerRow = 4;
    this.shotsUntilNewRow = 4;
    
    const startRows = 5;
    this.grid = createGrid(startRows + 20);

    for (let r = 0; r < startRows; r++) {
      for (let c = 0; c < maxColsForRow(r); c++) {
        const ci = randomColor(this.numColors);
        const pos = gridToPixel(r, c, this.gridOffsetX, this.gridOffsetY);
        const b = new Bubble(ci, pos.x, pos.y);
        b.row = r;
        b.col = c;
        this.grid[r][c] = b;
      }
    }

    this.currentBubble = this.randomShooterBubble();
    this.nextBubble = this.randomShooterBubble();
    this.projectile = null;
    this.activeBooster = null;
    this.state = STATE.PLAYING;
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.onShotCountChange) this.onShotCountChange(this.shotsUntilNewRow);
    if (this.onBoosterChange) this.onBoosterChange(this.boosters);
  }

  /**
   * Push a new row from the top: shift all existing bubbles down by 1 row
   */
  pushNewRow() {
    // Add extra row at the bottom for capacity
    this.grid.push(new Array(COLS).fill(null));

    // Collect all existing bubbles
    const bubbles = [];
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b && !b.falling && !b.popping) {
          bubbles.push({ bubble: b, row: r, col: c });
          this.grid[r][c] = null;
        }
      }
    }

    // Place each bubble one row lower (same column — uniform col count)
    for (const { bubble, row, col } of bubbles) {
      const newRow = row + 1;
      while (this.grid.length <= newRow) {
        this.grid.push(new Array(COLS).fill(null));
      }
      this.grid[newRow][col] = bubble;
      bubble.row = newRow;
      bubble.col = col;
    }

    // Fill row 0 with new bubbles
    this.grid[0] = new Array(COLS).fill(null);
    for (let c = 0; c < COLS; c++) {
      const ci = randomColor(this.numColors);
      const pos = gridToPixel(0, c, this.gridOffsetX, this.gridOffsetY);
      const b = new Bubble(ci, pos.x, pos.y);
      b.row = 0;
      b.col = c;
      b.startWobble(2);
      this.grid[0][c] = b;
    }

    // Set targets for smooth animation
    this.refreshBubbleTargets();

    // Increase difficulty over time
    this.shotsFired++;
    if (this.shotsFired % 15 === 0 && this.numColors < COLORS.length) {
      this.numColors++;
    }

    // Scare bubbles near death line
    this.scareBubblesByDeathLine();

    // Check if any bubble now below death line
    this.checkDeathLine();
  }

  randomShooterBubble() {
    const gridColors = new Set();
    for (const row of this.grid) {
      if (!row) continue;
      for (const b of row) {
        if (b) gridColors.add(b.colorIndex);
      }
    }
    const available = gridColors.size > 0 ? [...gridColors] : [randomColor(this.numColors)];
    const ci = available[Math.floor(Math.random() * available.length)];
    return new Bubble(ci);
  }

  refreshBubblePositions() {
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] && !this.grid[r][c].falling) {
          const pos = gridToPixel(r, c, this.gridOffsetX, this.gridOffsetY);
          this.grid[r][c].x = pos.x;
          this.grid[r][c].y = pos.y;
          this.grid[r][c].targetX = pos.x;
          this.grid[r][c].targetY = pos.y;
        }
      }
    }
  }

  refreshBubbleTargets() {
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] && !this.grid[r][c].falling) {
          const pos = gridToPixel(r, c, this.gridOffsetX, this.gridOffsetY);
          this.grid[r][c].setTarget(pos.x, pos.y);
          // Wobble after push with delay based on row
          this.grid[r][c].startWobble(1.5 + r * 0.2);
        }
      }
    }
  }

  // ===== AIMING =====

  setPointer(x, y) {
    this.pointerX = x;
    this.pointerY = y;
    const dx = x - this.shooterX;
    const dy = y - this.shooterY;
    this.aimAngle = Math.atan2(dy, dx);
    if (this.aimAngle > -0.18) this.aimAngle = -0.18;
    if (this.aimAngle < -(Math.PI - 0.18)) this.aimAngle = -(Math.PI - 0.18);
  }

  getAimSegments() {
    const segments = [];
    let x = this.shooterX;
    let y = this.shooterY;
    let dx = Math.cos(this.aimAngle);
    let dy = Math.sin(this.aimAngle);
    const step = 8;
    const leftWall = this.gridOffsetX + BUBBLE_RADIUS;
    const rightWall = this.gridOffsetX + COLS * BUBBLE_DIAMETER - BUBBLE_RADIUS;

    segments.push({ x, y });

    for (let i = 0; i < 80; i++) {
      x += dx * step;
      y += dy * step;

      if (x < leftWall) { x = leftWall; dx = -dx; }
      if (x > rightWall) { x = rightWall; dx = -dx; }
      if (y < this.gridOffsetY) { y = this.gridOffsetY; break; }

      segments.push({ x, y });
      if (this.checkCollisionAt(x, y)) break;
    }
    return segments;
  }

  // ===== SHOOTING =====

  shoot() {
    if (this.state !== STATE.PLAYING || this.projectile || this.animDelay > 0) return;
    playShoot();

    this.projectile = {
      x: this.shooterX,
      y: this.shooterY,
      vx: Math.cos(this.aimAngle) * this.projSpeed,
      vy: Math.sin(this.aimAngle) * this.projSpeed,
      bubble: this.currentBubble
    };

    this.currentBubble = this.nextBubble;
    this.nextBubble = this.randomShooterBubble();
  }

  swapBubbles() {
    if (this.projectile || this.animDelay > 0) return;
    [this.currentBubble, this.nextBubble] = [this.nextBubble, this.currentBubble];
  }

  // ===== UPDATE =====

  update(dt) {
    if (this.state !== STATE.PLAYING) return;

    this.time += dt;

    if (this.animDelay > 0) {
      this.animDelay -= dt;
    }

    // Update grid bubbles
    for (const row of this.grid) {
      if (!row) continue;
      for (const b of row) {
        if (b) b.update(dt);
      }
    }

    // Update falling bubbles
    for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
      const b = this.fallingBubbles[i];
      b.update(dt);
      if (!b.alive) this.fallingBubbles.splice(i, 1);
    }

    // Remove dead bubbles from grid
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] && !this.grid[r][c].alive) {
          this.grid[r][c] = null;
        }
      }
    }

    updateParticles(dt);
    updateShake(dt);
    updateFloats(dt);

    if (this.projectile) {
      this.updateProjectile(dt);
      updateTrail(this.projectile?.x, this.projectile?.y, !!this.projectile);
    } else {
      updateTrail(0, 0, false);
    }
  }

  updateProjectile(dt) {
    const p = this.projectile;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const leftWall = this.gridOffsetX;
    const rightWall = this.gridOffsetX + COLS * BUBBLE_DIAMETER;

    if (p.x - BUBBLE_RADIUS < leftWall) {
      p.x = leftWall + BUBBLE_RADIUS;
      p.vx = -p.vx;
    }
    if (p.x + BUBBLE_RADIUS > rightWall) {
      p.x = rightWall - BUBBLE_RADIUS;
      p.vx = -p.vx;
    }

    if (p.y - BUBBLE_RADIUS <= this.gridOffsetY) {
      this.snapProjectile();
      return;
    }

    if (this.checkCollisionAt(p.x, p.y)) {
      this.snapProjectile();
    }
  }

  checkCollisionAt(x, y) {
    const checkR = BUBBLE_DIAMETER * 0.9;
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (!b || b.popping || b.falling) continue;
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy < checkR * checkR) return true;
      }
    }
    return false;
  }

  snapProjectile() {
    const p = this.projectile;
    const { row, col } = pixelToGrid(p.x, p.y, this.gridOffsetX, this.gridOffsetY);

    while (this.grid.length <= row) {
      this.grid.push(new Array(maxColsForRow(this.grid.length)).fill(null));
    }

    let snapRow = row, snapCol = col;
    if (this.grid[row]?.[col]) {
      const neighbors = getNeighbors(row, col);
      let bestDist = Infinity;
      for (const n of neighbors) {
        if (n.row < 0) continue;
        while (this.grid.length <= n.row) {
          this.grid.push(new Array(maxColsForRow(this.grid.length)).fill(null));
        }
        if (!this.grid[n.row]?.[n.col]) {
          const pos = gridToPixel(n.row, n.col, this.gridOffsetX, this.gridOffsetY);
          const dx = p.x - pos.x;
          const dy = p.y - pos.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            snapRow = n.row;
            snapCol = n.col;
          }
        }
      }
    }

    if (snapCol < 0 || snapCol >= maxColsForRow(snapRow)) {
      snapCol = Math.max(0, Math.min(snapCol, maxColsForRow(snapRow) - 1));
    }

    const pos = gridToPixel(snapRow, snapCol, this.gridOffsetX, this.gridOffsetY);
    const bubble = p.bubble;
    bubble.x = pos.x;
    bubble.y = pos.y;
    bubble.targetX = pos.x;
    bubble.targetY = pos.y;
    bubble.row = snapRow;
    bubble.col = snapCol;
    this.grid[snapRow][snapCol] = bubble;
    this.projectile = null;

    playStick();
    bubble.startSquash(); // Landing squash animation

    const neighbors = getNeighbors(snapRow, snapCol);
    for (const n of neighbors) {
      const nb = this.grid[n.row]?.[n.col];
      if (nb) nb.startWobble(2);
    }
    bubble.startWobble(3);

    // If booster is active, execute it instead of normal match
    if (this.activeBooster) {
      // Remove the delivery bubble
      this.grid[snapRow][snapCol] = null;
      bubble.startPop();
      this.executeBooster(snapRow, snapCol);
      return;
    }

    this.checkMatch(snapRow, snapCol);
  }

  checkMatch(row, col) {
    const group = findColorGroup(this.grid, row, col);

    // Decrement shot counter
    this.shotsUntilNewRow--;
    if (this.onShotCountChange) this.onShotCountChange(this.shotsUntilNewRow);

    if (group.length >= 3) {
      this.combo++;
      const baseScore = group.length * 10;
      const comboBonus = this.combo > 1 ? this.combo : 1;
      const totalScore = baseScore * comboBonus;
      this.score += totalScore;
      if (this.onScoreChange) this.onScoreChange(this.score);

      group.forEach((g, i) => {
        const b = this.grid[g.row][g.col];
        if (b) {
          setTimeout(() => {
            b.startPop();
            playPop(i);
            emitSplash(b.x, b.y, b.color.jelly, 8);
            emitSparkle(b.x, b.y, 4);
            emitRing(b.x, b.y, b.color.jelly);
          }, i * 50);
        }
      });

      const centerBubble = this.grid[group[0].row]?.[group[0].col];
      if (centerBubble) {
        addScoreFloat(totalScore, centerBubble.x, centerBubble.y);
        if (this.combo > 1) {
          addComboText(this.combo - 1, centerBubble.x, centerBubble.y - 30);
          playCombo(this.combo - 1);
        }
      }

      triggerShake(3 + this.combo * 2);

      this.animDelay = group.length * 0.05 + 0.3;
      setTimeout(() => {
        this.cascadeOrphans();
        this.maybeAddNewRow();
      }, (group.length * 50 + 250));
    } else {
      this.combo = 0;
      this.checkDeathLine();
      if (this.state !== STATE.GAME_OVER) {
        this.maybeAddNewRow();
      }
    }
  }

  maybeAddNewRow() {
    if (this.shotsUntilNewRow <= 0) {
      this.pushNewRow();
      this.shotsUntilNewRow = this.shotsPerRow;
      if (this.onShotCountChange) this.onShotCountChange(this.shotsUntilNewRow);
    }
  }

  cascadeOrphans() {
    const orphans = findOrphans(this.grid);
    if (orphans.length > 0) {
      const cascadeScore = orphans.length * 15;
      this.score += cascadeScore;
      if (this.onScoreChange) this.onScoreChange(this.score);

      playCascade(orphans.length);

      orphans.forEach((o, i) => {
        const b = this.grid[o.row][o.col];
        if (b) {
          setTimeout(() => {
            b.startFall();
            b.emotion = EMOTION.SCARED;
            emitSparkle(b.x, b.y, 2);
          }, i * 30);
          this.grid[o.row][o.col] = null;
          this.fallingBubbles.push(b);
        }
      });

      addScoreFloat(cascadeScore, this.width / 2, this.height / 2);
      triggerShake(4 + orphans.length);
    }
  }

  // ===== BOOSTERS =====
  addBooster(type) {
    if (this.boosters[type] !== undefined) {
      this.boosters[type]++;
      if (this.onBoosterChange) this.onBoosterChange(this.boosters);
    }
  }

  activateBooster(type) {
    if (this.boosters[type] > 0 && !this.activeBooster) {
      this.activeBooster = type;
      return true;
    }
    return false;
  }

  executeBooster(snapRow, snapCol) {
    const type = this.activeBooster;
    if (!type) return false;
    
    this.boosters[type]--;
    this.activeBooster = null;
    if (this.onBoosterChange) this.onBoosterChange(this.boosters);

    switch (type) {
      case 'bomb': return this.executeBomb(snapRow, snapCol);
      case 'rainbow': return this.executeRainbow(snapRow, snapCol);
      case 'lightning': return this.executeLightning(snapRow);
    }
    return false;
  }

  executeBomb(row, col) {
    let count = 0;
    // Explode 2-cell radius around snap point
    for (let r = row - 2; r <= row + 2; r++) {
      if (r < 0 || r >= this.grid.length) continue;
      for (let c = col - 2; c <= col + 2; c++) {
        if (c < 0 || !this.grid[r] || c >= this.grid[r].length) continue;
        const b = this.grid[r][c];
        if (b && !b.falling && !b.popping) {
          const dx = col - c, dy = row - r;
          if (dx * dx + dy * dy <= 5) { // roughly circular
            setTimeout(() => {
              b.startPop();
              emitSplash(b.x, b.y, b.color.jelly, 6);
              emitSparkle(b.x, b.y, 3);
              emitRing(b.x, b.y, b.color.jelly);
              playPop(count);
            }, count * 40);
            this.grid[r][c] = null;
            count++;
          }
        }
      }
    }
    if (count > 0) {
      const score = count * 15;
      this.score += score;
      if (this.onScoreChange) this.onScoreChange(this.score);
      const pos = gridToPixel(row, col, this.gridOffsetX, this.gridOffsetY);
      addScoreFloat(score, pos.x, pos.y);
      triggerShake(8);
      this.animDelay = count * 0.04 + 0.3;
      setTimeout(() => this.cascadeOrphans(), count * 40 + 200);
    }
    return count > 0;
  }

  executeRainbow(row, col) {
    // Find the most common color in the grid and remove all of it
    const colorCounts = {};
    for (const gridRow of this.grid) {
      if (!gridRow) continue;
      for (const b of gridRow) {
        if (b && !b.falling && !b.popping) {
          const key = b.colorIndex;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
        }
      }
    }
    let targetColor = -1, maxCount = 0;
    for (const [ci, count] of Object.entries(colorCounts)) {
      if (count > maxCount) { maxCount = count; targetColor = parseInt(ci); }
    }
    if (targetColor < 0) return false;

    let count = 0;
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b && b.colorIndex === targetColor && !b.falling && !b.popping) {
          setTimeout(() => {
            b.startPop();
            emitSplash(b.x, b.y, b.color.jelly, 5);
            emitSparkle(b.x, b.y, 3);
            playPop(count % 8);
          }, count * 30);
          this.grid[r][c] = null;
          count++;
        }
      }
    }
    if (count > 0) {
      const score = count * 12;
      this.score += score;
      if (this.onScoreChange) this.onScoreChange(this.score);
      addScoreFloat(score, this.width / 2, this.height / 3);
      addComboText(count, this.width / 2, this.height / 3 - 30);
      triggerShake(6 + count);
      this.animDelay = count * 0.03 + 0.3;
      setTimeout(() => this.cascadeOrphans(), count * 30 + 200);
    }
    return count > 0;
  }

  executeLightning(row) {
    let count = 0;
    if (!this.grid[row]) return false;
    for (let c = 0; c < this.grid[row].length; c++) {
      const b = this.grid[row][c];
      if (b && !b.falling && !b.popping) {
        setTimeout(() => {
          b.startPop();
          emitSplash(b.x, b.y, b.color.jelly, 4);
          emitSparkle(b.x, b.y, 2);
          playPop(count % 8);
        }, count * 25);
        this.grid[row][c] = null;
        count++;
      }
    }
    if (count > 0) {
      const score = count * 10;
      this.score += score;
      if (this.onScoreChange) this.onScoreChange(this.score);
      const pos = gridToPixel(row, 0, this.gridOffsetX, this.gridOffsetY);
      addScoreFloat(score, this.width / 2, pos.y);
      triggerShake(5);
      this.animDelay = count * 0.025 + 0.3;
      setTimeout(() => this.cascadeOrphans(), count * 25 + 200);
    }
    return count > 0;
  }

  scareBubblesByDeathLine() {
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b) {
          if (b.y > this.deathLineY - 60) {
            b.emotion = EMOTION.SCARED;
          } else {
            b.emotion = EMOTION.IDLE;
          }
        }
      }
    }
  }

  checkDeathLine() {
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b && !b.falling && !b.popping) {
          // Use grid-based position (where the bubble WILL be, not where it's lerping from)
          const pos = gridToPixel(b.row, b.col, this.gridOffsetX, this.gridOffsetY);
          if (pos.y > this.deathLineY) {
            this.gameOver();
            return;
          }
        }
      }
    }
  }

  gameOver() {
    this.state = STATE.GAME_OVER;
    playLose();
    for (const row of this.grid) {
      if (!row) continue;
      for (const b of row) {
        if (b) b.emotion = EMOTION.SAD;
      }
    }
    if (this.score > this.highScore) this.highScore = this.score;
    if (this.onGameOver) this.onGameOver();
  }

  rescue() {
    // After rewarded ad: remove bottom 3 rows of bubbles
    let clearedRows = 0;
    for (let r = this.grid.length - 1; r >= 0 && clearedRows < 3; r--) {
      if (!this.grid[r]) continue;
      let hasAny = false;
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c]) { hasAny = true; break; }
      }
      if (hasAny) {
        for (let c = 0; c < this.grid[r].length; c++) {
          const b = this.grid[r][c];
          if (b) {
            b.startFall();
            this.fallingBubbles.push(b);
            this.grid[r][c] = null;
          }
        }
        clearedRows++;
      }
    }
    setTimeout(() => this.cascadeOrphans(), 200);
    this.state = STATE.PLAYING;
  }

  // ===== RENDER =====

  render(ctx) {
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(ctx, w, h, this.time);
    drawDeathLine(ctx, this.deathLineY, w, this.time);

    // Grid bubbles
    for (let r = 0; r < this.grid.length; r++) {
      if (!this.grid[r]) continue;
      for (let c = 0; c < this.grid[r].length; c++) {
        const b = this.grid[r][c];
        if (b && (b.alive || b.popping)) {
          drawJelly(ctx, b.x, b.y, b, this.pointerX, this.pointerY);
        }
      }
    }

    // Falling bubbles (detached from grid)
    for (const b of this.fallingBubbles) {
      if (b.alive) {
        drawJelly(ctx, b.x, b.y, b, this.pointerX, this.pointerY);
      }
    }

    renderParticles(ctx);

    // Aim line
    if (this.state === STATE.PLAYING && !this.projectile && this.animDelay <= 0) {
      const segments = this.getAimSegments();
      const aimColor = this.currentBubble?.color?.jelly || null;
      drawAimLine(ctx, segments, this.time, aimColor);
    }

    // Projectile with trail
    if (this.projectile) {
      const p = this.projectile;
      drawTrail(ctx, p.bubble.color.jelly);
      drawJelly(ctx, p.x, p.y, p.bubble, this.pointerX, this.pointerY);
    }

    // Shooter bubble
    if (this.state === STATE.PLAYING) {
      drawShooterBubble(ctx, this.shooterX, this.shooterY, this.currentBubble, this.time);

      if (this.nextBubble) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        const nextX = this.shooterX + 50;
        const nextY = this.shooterY + 10;
        ctx.beginPath();
        ctx.arc(nextX, nextY, BUBBLE_RADIUS * 0.6, 0, Math.PI * 2);
        const ng = ctx.createRadialGradient(nextX, nextY, 0, nextX, nextY, BUBBLE_RADIUS * 0.6);
        ng.addColorStop(0, this.nextBubble.color.jelly);
        ng.addColorStop(1, this.nextBubble.color.bubble);
        ctx.fillStyle = ng;
        ctx.fill();
        ctx.restore();
      }
    }

    renderFloats(ctx);
    ctx.restore();
  }
}

export { Game, STATE };
