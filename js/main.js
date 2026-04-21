/* main.js — Entry point: game loop, input, Telegram Web App SDK integration, UI */

import { Game, STATE } from './game.js';
import { initAudio, resumeAudio, suspendAudio, setMuted } from './audio.js';
import { BUBBLE_RADIUS } from './grid.js';
import { FortuneWheel } from './wheel.js';
import { setLanguage, detectLanguage, t } from './i18n.js';

// ===== TELEGRAM WEB APP =====
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand(); // Expand to full height
  // Disable swipe-to-close on mobile (prevents accidental closure)
  if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
}

// ===== CANVAS SETUP =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

let { w: canvasW, h: canvasH } = resizeCanvas();
window.addEventListener('resize', () => {
  const { w, h } = resizeCanvas();
  canvasW = w;
  canvasH = h;
  game.resize(w, h);
});

// ===== GAME INSTANCE =====
const game = new Game();
game.init(canvasW, canvasH);

// ===== UI ELEMENTS =====
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const tutorialScreen = document.getElementById('tutorial-screen');
const settingsScreen = document.getElementById('settings-screen');
const wheelScreen = document.getElementById('wheel-screen');
const hud = document.getElementById('hud');
const hudScore = document.getElementById('hud-score');
const shotCounter = document.getElementById('shot-counter');
const shotCount = document.getElementById('shot-count');
const swapHint = document.getElementById('swap-hint');
const gameoverScore = document.getElementById('gameover-score');
const btnSoundToggle = document.getElementById('btn-sound-toggle');
const wheelPrize = document.getElementById('wheel-prize');
const btnSpin = document.getElementById('btn-spin');
const btnSpinAd = document.getElementById('btn-spin-ad');
const btnWheelClose = document.getElementById('btn-wheel-close');
const boosterBar = document.getElementById('booster-bar');
const countBomb = document.getElementById('count-bomb');
const countRainbow = document.getElementById('count-rainbow');
const countLightning = document.getElementById('count-lightning');

let soundOn = true;
let fortuneWheel = null;
let dailySpinsUsed = 0;
let tutorialShown = false;
try { tutorialShown = localStorage.getItem('jelly_tutorial') === '1'; } catch(e) {}

function showScreen(screen) {
  [menuScreen, gameoverScreen, tutorialScreen, settingsScreen, wheelScreen].forEach(s => s.classList.add('hidden'));
  if (screen) screen.classList.remove('hidden');
}

function showHUD(visible) {
  hud.classList.toggle('hidden', !visible);
  shotCounter.classList.toggle('hidden', !visible);
  swapHint.classList.toggle('hidden', !visible);
  boosterBar.classList.toggle('hidden', !visible);
}

// ===== GAME CALLBACKS =====
game.onScoreChange = (score) => {
  hudScore.textContent = score.toLocaleString();
};

game.onShotCountChange = (count) => {
  shotCount.textContent = count;
  shotCount.classList.toggle('warning', count <= 2);
};

// onGameOver is set at bottom of file with saveProgress()

// Booster inventory UI update
game.onBoosterChange = (boosters) => {
  countBomb.textContent = boosters.bomb;
  countRainbow.textContent = boosters.rainbow;
  countLightning.textContent = boosters.lightning;
  document.getElementById('btn-booster-bomb').classList.toggle('disabled', boosters.bomb <= 0);
  document.getElementById('btn-booster-rainbow').classList.toggle('disabled', boosters.rainbow <= 0);
  document.getElementById('btn-booster-lightning').classList.toggle('disabled', boosters.lightning <= 0);
  
  // Save progress so wheel prizes persist immediately
  saveProgress();
};

// Booster button clicks
document.querySelectorAll('.booster-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.booster;
    if (game.activateBooster(type)) {
      document.querySelectorAll('.booster-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  });
});

// ===== START GAME FLOW =====
let gamesPlayed = 0;

function _doStartNewGame() {
  initAudio();
  resumeAudio();
  showScreen(null);
  showHUD(true);
  game.startGame();
}

function startNewGame() {
  _doStartNewGame();
  gamesPlayed++;
}

// ===== BUTTON HANDLERS =====
document.getElementById('btn-play').addEventListener('click', () => {
  if (!tutorialShown) {
    showScreen(tutorialScreen);
    return;
  }
  // Check if fortune wheel is available today
  if (FortuneWheel.canSpinToday()) {
    showFortuneWheel();
    return;
  }
  startNewGame();
});

document.getElementById('btn-tutorial-ok').addEventListener('click', () => {
  tutorialShown = true;
  try { localStorage.setItem('jelly_tutorial', '1'); } catch(e) {}
  // Show wheel after tutorial if available
  if (FortuneWheel.canSpinToday()) {
    showFortuneWheel();
    return;
  }
  startNewGame();
});

// ===== FORTUNE WHEEL =====
function showFortuneWheel() {
  dailySpinsUsed = 0;
  fortuneWheel = new FortuneWheel('wheel-canvas');
  wheelPrize.classList.add('hidden');
  btnSpin.classList.remove('hidden');
  btnSpinAd.classList.add('hidden');
  btnWheelClose.classList.add('hidden');
  showScreen(wheelScreen);
}

function doSpin() {
  fortuneWheel.spin((prize) => {
    dailySpinsUsed++;
    wheelPrize.textContent = `${prize.label} ${prize.name}!`;
    wheelPrize.classList.remove('hidden');
    btnSpin.classList.add('hidden');

    // Grant booster based on prize
    const PRIZE_MAP = {
      '💣': 'bomb',
      '🔥': 'bomb',
      '🌈': 'rainbow',
      '⚡': 'lightning',
    };
    const boosterType = PRIZE_MAP[prize.label];
    if (boosterType) {
      game.addBooster(boosterType);
    } else if (prize.label === '+3') {
      // +3 extra shots before next row
      game.shotsUntilNewRow += 3;
      if (game.onShotCountChange) game.onShotCountChange(game.shotsUntilNewRow);
    } else if (prize.label === '×2') {
      // ×2 score
      game.score *= 2;
      if (game.onScoreChange) game.onScoreChange(game.score);
    } else {
      // 💎, 🎁 → random booster
      const types = ['bomb', 'rainbow', 'lightning'];
      game.addBooster(types[Math.floor(Math.random() * types.length)]);
    }

    if (dailySpinsUsed < 2) {
      // Offer a free second spin in Telegram (no ad required)
      btnSpinAd.classList.remove('hidden');
      btnWheelClose.classList.remove('hidden');
    } else {
      FortuneWheel.markSpunToday();
      btnSpinAd.classList.add('hidden');
      btnWheelClose.classList.remove('hidden');
    }
  });
}

btnSpin.addEventListener('click', () => {
  doSpin();
});

btnSpinAd.addEventListener('click', () => {
  // In Telegram version: free second spin (no rewarded ad)
  btnSpinAd.classList.add('hidden');
  wheelPrize.classList.add('hidden');
  doSpin();
});

btnWheelClose.addEventListener('click', () => {
  FortuneWheel.markSpunToday();
  startNewGame();
});

document.getElementById('btn-restart').addEventListener('click', () => {
  startNewGame();
});

document.getElementById('btn-rescue').addEventListener('click', () => {
  // In Telegram: free rescue (no rewarded ad)
  game.rescue();
  showScreen(null);
  showHUD(true);
});

// Settings
document.getElementById('btn-settings').addEventListener('click', () => {
  showScreen(settingsScreen);
});

btnSoundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  setMuted(!soundOn);
  btnSoundToggle.textContent = soundOn ? 'ВКЛ' : 'ВЫКЛ';
  btnSoundToggle.className = 'settings-toggle ' + (soundOn ? 'on' : 'off');
});

document.getElementById('btn-settings-close').addEventListener('click', () => {
  showScreen(null);
  showHUD(true);
});

// Swap
swapHint.addEventListener('click', () => {
  game.swapBubbles();
});

// ===== INPUT =====
let isDown = false;

function onPointerDown(x, y) {
  if (game.state !== STATE.PLAYING) return;
  isDown = true;
  game.setPointer(x, y);
  initAudio();
  resumeAudio();
}

function onPointerMove(x, y) {
  if (game.state !== STATE.PLAYING) return;
  game.setPointer(x, y);
}

function onPointerUp(x, y) {
  if (!isDown) return;
  isDown = false;
  if (game.state === STATE.PLAYING) {
    game.shoot();
  }
}

// Mouse
canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
canvas.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
canvas.addEventListener('mouseup', (e) => onPointerUp(e.clientX, e.clientY));

// Touch
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  onPointerDown(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  onPointerMove(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  onPointerUp(0, 0);
}, { passive: false });

// Prevent context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ===== VISIBILITY: pause audio on tab hide =====
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    suspendAudio();
  } else {
    if (game.state === STATE.PLAYING) {
      resumeAudio();
    }
  }
});

// ===== GAME LOOP =====
const FIXED_DT = 1 / 60;
let lastTime = 0;
let accumulator = 0;

function loop(timestamp) {
  const rawDt = (timestamp - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.1);
  lastTime = timestamp;
  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    game.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  ctx.clearRect(0, 0, canvasW, canvasH);
  game.render(ctx);

  requestAnimationFrame(loop);
}

lastTime = performance.now();
requestAnimationFrame(loop);

// ===== SAVE/LOAD (localStorage only for Telegram) =====
function saveProgress() {
  const data = {
    highScore: game.highScore,
    soundOn: soundOn,
    tutorialDone: tutorialShown,
    boosters: game.boosters
  };
  try { localStorage.setItem('jelly_save', JSON.stringify(data)); } catch(e) {}
}

function loadProgress() {
  let data = null;
  try {
    const raw = localStorage.getItem('jelly_save');
    if (raw) data = JSON.parse(raw);
  } catch(e) {}
  
  if (data) {
    if (data.highScore) game.highScore = data.highScore;
    if (data.soundOn !== undefined) {
      soundOn = data.soundOn;
      setMuted(!soundOn);
      btnSoundToggle.textContent = soundOn ? 'ВКЛ' : 'ВЫКЛ';
      btnSoundToggle.className = 'settings-toggle ' + (soundOn ? 'on' : 'off');
    }
    if (data.tutorialDone) {
      tutorialShown = true;
    }
    if (data.boosters) {
      game.boosters = data.boosters;
      if (game.onBoosterChange) game.onBoosterChange(game.boosters);
    }
  }
}

// Save on game over
game.onGameOver = () => {
  showHUD(false);
  gameoverScore.textContent = game.score.toLocaleString();
  showScreen(gameoverScreen);
  saveProgress();
};

// ===== LANGUAGE DETECTION =====
function detectTelegramLanguage() {
  if (tg?.initDataUnsafe?.user?.language_code) {
    return tg.initDataUnsafe.user.language_code === 'ru' ? 'ru' : 'en';
  }
  const browserLang = navigator.language || navigator.userLanguage || 'ru';
  return browserLang.startsWith('ru') ? 'ru' : 'en';
}

// ===== START =====
(() => {
  setLanguage(detectTelegramLanguage());
  loadProgress();
  showScreen(menuScreen);
  showHUD(false);
  game.state = STATE.MENU;
})();
