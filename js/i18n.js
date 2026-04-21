/* i18n.js — Localization support (RU/EN) */

const TRANSLATIONS = {
  ru: {
    subtitle: 'Лопни их всех!',
    play: 'ИГРАТЬ',
    jellies_sad: '🥺 Желейки расстроились!',
    so_close: 'Ты был(а) так близко!',
    rescue: '▶ СПАСТИ ЖЕЛЕЕК!',
    rescue_sub: '📺 За рекламу',
    restart: 'начать заново →',
    booster_title: '😊💣 Возьми бомбочку!',
    get_booster: '▶ ПОЛУЧИТЬ БОМБУ',
    get_booster_sub: '📺 За рекламу',
    no_bonus: 'начать без бонуса →',
    how_to_play: 'Как играть',
    tutorial_text: 'Зажми и тяни чтобы прицелиться.<br>Отпусти чтобы стрелять!',
    tutorial_match: '3+ одного цвета',
    tutorial_match_action: '— лопнуть!',
    tutorial_swap: 'Тап ниже',
    tutorial_swap_action: '— сменить шарик',
    got_it: 'ПОНЯЛ! 👍',
    to_row: 'до ряда',
    settings: '⚙️ Настройки',
    sound: '🔊 Звук',
    on: 'ВКЛ',
    off: 'ВЫКЛ',
    wheel_title: '🎡 Колесо фортуны!',
    spin: 'КРУТИТЬ! 🎰',
    spin_again: '▶ ЕЩЁ РАЗ!',
    spin_free: '📺 За рекламу',
    continue: 'продолжить →',
  },
  en: {
    subtitle: 'Pop them all!',
    play: 'PLAY',
    jellies_sad: '🥺 Jellies are sad!',
    so_close: 'You were so close!',
    rescue: '▶ SAVE THE JELLIES!',
    rescue_sub: '📺 Watch Ad',
    restart: 'start over →',
    booster_title: '😊💣 Grab a bomb!',
    get_booster: '▶ GET BOMB',
    get_booster_sub: '📺 Watch Ad',
    no_bonus: 'start without bonus →',
    how_to_play: 'How to play',
    tutorial_text: 'Hold and drag to aim.<br>Release to shoot!',
    tutorial_match: '3+ same color',
    tutorial_match_action: '— pop!',
    tutorial_swap: 'Tap below',
    tutorial_swap_action: '— switch bubble',
    got_it: 'GOT IT! 👍',
    to_row: 'to row',
    settings: '⚙️ Settings',
    sound: '🔊 Sound',
    on: 'ON',
    off: 'OFF',
    wheel_title: '🎡 Fortune Wheel!',
    spin: 'SPIN! 🎰',
    spin_again: '▶ AGAIN!',
    spin_free: '📺 Watch Ad',
    continue: 'continue →',
  }
};

let currentLang = 'ru';

export function setLanguage(lang) {
  currentLang = lang;
  applyTranslations();
}

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['ru'][key] || key;
}

export function detectLanguage(ysdk) {
  if (ysdk?.environment?.i18n?.lang) {
    const lang = ysdk.environment.i18n.lang;
    return lang === 'ru' || lang === 'be' || lang === 'uk' || lang === 'kk' ? 'ru' : 'en';
  }
  // Fallback: browser language
  const nav = navigator.language || 'ru';
  return nav.startsWith('ru') ? 'ru' : 'en';
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const text = t(key);
    if (text) el.textContent = text;
  });
}

export function getCurrentLang() {
  return currentLang;
}
