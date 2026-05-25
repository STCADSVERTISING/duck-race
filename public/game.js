// 🦆 High-Fidelity Duck Race Canvas & Console Engine with Dynamic rotating Ads

const socket = io();

// Get DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const podiumOverlay = document.getElementById('podium-overlay');

// Integrated Lobby DOM Elements
const lobbyPanel = document.getElementById('lobby-panel');
const lobbyTimerScreen = document.getElementById('lobby-timer-screen');
const sliderLabel = document.getElementById('lbl-duck-count-slider');
const duckCountSlider = document.getElementById('duck-count-slider');
const consoleNamesTextarea = document.getElementById('console-names-textarea');
const consoleRosterStatus = document.getElementById('console-roster-status');
const chkShowNumbers = document.getElementById('chk-show-numbers');
const lblCostumeTheme = document.getElementById('lbl-costume-theme');
const avatarPreviewCanvas = document.getElementById('avatar-preview-canvas');

// Audio elements
const soundCountdown = document.getElementById('sound-countdown');
const soundGo = document.getElementById('sound-go');
const soundSplash = document.getElementById('sound-splash');
const soundCheering = document.getElementById('sound-cheering');
const soundQuack = document.getElementById('sound-quack');

// Game Configuration
const COURSE_LENGTH = 2800; // Finish line X position
const VIEW_WIDTH = 1024;
const VIEW_HEIGHT = 576;

// Local State
let ducks = [];
let gameStatus = 'idle'; // idle, counting_down, racing, finished
let countdownVal = 5;
let countdownTimer = null;
let raceDuration = 15; // default seconds
let countdownDuration = 5;
let riggedWinners = { first: null, second: null, third: null };
let cameraX = 0;
let animationFrameId = null;
let particlePool = [];
let soundPlayed = { countdown: false, cheering: false, go: false };
let raceStartTime = null;
let smoothElapsed = 0;

let consoleMode = 'numbers'; // 'numbers' or 'names'
let keypadInputString = ''; // tracks typed stopwatch digits
let showDuckNumbers = true;
let showDuckLogo = false;
let currentLanguage = 'en'; // Force English-only interface

// Preset Color Palettes & 10 Beautifully Designed Custom Duck Styles
const DUCK_STYLES = [
  { name: 'Classic Yellow 💛', thName: 'Classic Yellow 💛', color: '#ffd700', wingColor: '#e5c100', beakColor: '#ff6600', accessory: 'none' },
  { name: 'Cool Captain 🧑‍✈️', thName: 'Cool Captain 🧑‍✈️', color: '#f3f4f6', wingColor: '#cbd5e1', beakColor: '#ff6600', accessory: 'captain_hat' },
  { name: 'Rubber Pirate 🏴‍☠️', thName: 'Rubber Pirate 🏴‍☠️', color: '#475569', wingColor: '#334155', beakColor: '#e11d48', accessory: 'pirate_patch' },
  { name: 'Neon Cyber ⚡', thName: 'Neon Cyber ⚡', color: '#39ff14', wingColor: '#2bb50e', beakColor: '#ff007f', accessory: 'neon_sunglasses' },
  { name: 'Princess Pink 🌸', thName: 'Princess Pink 🌸', color: '#f72585', wingColor: '#b5179e', beakColor: '#ffd166', accessory: 'none' },
  { name: 'Gentleman Slate 🎩', thName: 'Gentleman Slate 🎩', color: '#1e293b', wingColor: '#0f172a', beakColor: '#d97706', accessory: 'gentleman_hat' },
  { name: 'Unicorn Pastel 🦄', thName: 'Unicorn Pastel 🦄', color: '#c084fc', wingColor: '#a855f7', beakColor: '#fb7185', accessory: 'unicorn_horn' },
  { name: 'Super Hero Red 🦸', thName: 'Super Hero Red 🦸', color: '#ef4444', wingColor: '#b91c1c', beakColor: '#fbbf24', accessory: 'hero_mask' },
  { name: 'Aqua Diver 🤿', thName: 'Aqua Diver 🤿', color: '#06b6d4', wingColor: '#0891b2', beakColor: '#f97316', accessory: 'diver_goggles' },
  { name: 'Gold Laurel 🏆', thName: 'Gold Laurel 🏆', color: '#fbbf24', wingColor: '#d97706', beakColor: '#ea580c', accessory: 'gold_laurel' }
];

const TRANSLATIONS = {
  th: {
    login: '👤 เข้าสู่ระบบ!',
    premium: '⭐ สมัครพรีเมียม!',
    changeLang: '🌐 เปลี่ยนภาษา (Change Language)',
    raceTimers: 'จับเวลาแข่ง',
    classroomTimers: 'จับเวลาห้องเรียน',
    holidayTimers: 'จับเวลาเทศกาล',
    namePickers: 'สุ่มเลือกชื่อ',
    numberGens: 'สุ่มตัวเลข',
    sensoryTimers: 'จับเวลาประสาทสัมผัส',
    clocks: 'นาฬิกา',
    examTimers: 'จับเวลาสอบ',
    chanceGames: 'เกมวัดดวง',
    groupGens: 'สุ่มแบ่งกลุ่ม',
    presentationTimers: 'จับเวลานำเสนอ',
    tallyCounters: 'เครื่องนับจำนวน',
    duckRaceTitle: 'แข่งเป็ดว่ายน้ำ',
    descLine1: 'ว่ายน้ำไปสู่เส้นชัยกับการแข่งเป็ดแสนวิเศษของเรา! ตัวตั้งเวลาการแข่งขันเป็ดออนไลน์นี้ช่วยให้คุณแข่งเป็ดได้ระหว่าง 2 ถึง 100 ตัวในการแข่งขันที่แสนสนุกนี้! ใช้งานได้ฟรีเสมอ :-)',
    descLine2: 'สมาชิกพรีเมียมสามารถปล่อยตัวเป็ดแข่งได้สูงสุดถึง 1000 ตัว!',
    tryTimers: 'ลองใช้ส่วนตัวจับเวลาการแข่งของเรา!',
    hhmmss: 'ชม<br>นาที<br>วิ',
    keypadSet: 'ตั้งเวลา',
    keypadClear: 'ล้าง',
    tabNumbers: 'ตัวเลข',
    tabNames: 'ใส่ชื่อ',
    showNumbers: 'แสดงหมายเลขเป็ด:',
    showLogo: 'แสดงโลโก้:',
    textareaPlaceholder: 'พิมพ์ชื่อเป็ด แถวละ 1 ชื่อ...',
    premiumHeader: 'เฉพาะพรีเมียม!',
    premiumDesc: 'ฟีเจอร์การปล่อยตัวแถวใหญ่:',
    premiumTag: 'รองรับเป็ดได้ถึง 1000 ตัว!',
    findOutMore: 'ดูข้อมูลเพิ่มเติม!',
    btnDelete: 'ลบทั้งหมด',
    btnSave: 'อัปเดต / บันทึก',
    btnSaveAs: 'บันทึกเป็น...',
    pillAdd: '⭐ เพิ่มในหน้าของฉัน!',
    pillFullscreen: '📺 เปิดเต็มจอ!',
    pillAdFree: '🚫 ปิดโฆษณา!',
    countdownSub: 'เตรียมตัว, ระวัง, ไป...',
    podiumTitle: '🎉 การแข่งขันเสร็จสิ้น! 🎉',
    podium1st: 'ที่ 1',
    podium2nd: 'ที่ 2',
    podium3rd: 'ที่ 3',
    podiumClose: 'กลับไปหน้าหลัก',
  },
  en: {
    login: '👤 Log In!',
    premium: '⭐ Join Premium!',
    changeLang: '🌐 Change Language',
    raceTimers: 'Race Timers',
    classroomTimers: 'Classroom Timers',
    holidayTimers: 'Holiday Timers',
    namePickers: 'Random Name Pickers',
    numberGens: 'Random Number Generators',
    sensoryTimers: 'Sensory Timers',
    clocks: 'Clocks',
    examTimers: 'Exam Timers',
    chanceGames: 'Chance Games',
    groupGens: 'Group Generators',
    presentationTimers: 'Presentation Timers',
    tallyCounters: 'Tally Counters',
    duckRaceTitle: 'Duck Race',
    descLine1: 'Swim your way to the finish line! With our amazing Duck Race! This online Duck Race Timer lets you have between 2 and 100 ducks racing in this fun little Duck Game! Free to use as always :-)',
    descLine2: 'Premium Members can now have up to 1000 ducks in the race!',
    tryTimers: 'Try our Race Timers Section!',
    hhmmss: 'HH<br>MM<br>SS',
    keypadSet: 'Set',
    keypadClear: 'Clear',
    tabNumbers: 'Numbers',
    tabNames: 'Names',
    showNumbers: 'Show Race Numbers:',
    showLogo: 'Show Custom Logo:',
    textareaPlaceholder: 'Type duck names, one per line...',
    premiumHeader: 'Premium Only!',
    premiumDesc: 'Mass Start Race Feature:',
    premiumTag: 'Up to 1000 Characters!',
    findOutMore: 'Find Out More!',
    btnDelete: 'Delete',
    btnSave: 'Update / Save',
    btnSaveAs: 'Save as...',
    pillAdd: '⭐ Add to My Page!',
    pillFullscreen: '📺 Go Fullscreen!',
    pillAdFree: '🚫 Go Ad Free!',
    countdownSub: 'READY, SET, GO...',
    podiumTitle: '🎉 RACE COMPLETED! 🎉',
    podium1st: '1st',
    podium2nd: '2nd',
    podium3rd: '3rd',
    podiumClose: 'GO TO LOBBY',
  }
};

let currentPaletteIndex = 0;
let manualAccessorySet = false; // flag to check if user customized, otherwise we randomize

// Identify as Game Screen
socket.emit('identify', 'game');

// ----------------------------------------------------
// 🌐 Bilingual Translation System
// ----------------------------------------------------

function toggleLanguage() {
  currentLanguage = currentLanguage === 'th' ? 'en' : 'th';
  updateLanguageUI();
}

function updateLanguageUI() {
  const trans = TRANSLATIONS[currentLanguage];
  
  const loginBtn = document.querySelector('.log-in-btn');
  if (loginBtn) loginBtn.textContent = trans.login;
  
  const premiumBtn = document.querySelector('.join-premium-btn');
  if (premiumBtn) premiumBtn.textContent = trans.premium;
  
  const langBtn = document.querySelector('.lang-btn');
  if (langBtn) langBtn.textContent = trans.changeLang;
  
  const pills = document.querySelectorAll('.nav-pill');
  const pillKeys = [
    'raceTimers', 'classroomTimers', 'holidayTimers', 'namePickers', 'numberGens',
    'sensoryTimers', 'clocks', 'examTimers', 'chanceGames', 'groupGens',
    'presentationTimers', 'tallyCounters'
  ];
  pills.forEach((p, idx) => {
    if (pillKeys[idx] && trans[pillKeys[idx]]) {
      p.textContent = trans[pillKeys[idx]];
    }
  });
  
  const titleBanner = document.querySelector('.blue-title-banner h2');
  if (titleBanner) titleBanner.textContent = trans.duckRaceTitle;
  
  const desc1 = document.querySelector('.desc-line1');
  if (desc1) desc1.textContent = trans.descLine1;
  
  const desc2 = document.querySelector('.desc-line2');
  if (desc2) desc2.textContent = trans.descLine2;
  
  const tryTimersBtn = document.querySelector('.try-timers-btn');
  if (tryTimersBtn) tryTimersBtn.textContent = trans.tryTimers;
  
  const hhmmssTag = document.querySelector('.hh-mm-ss-tag');
  if (hhmmssTag) hhmmssTag.innerHTML = trans.hhmmss;
  
  const btnSet = document.getElementById('keypad-btn-set');
  if (btnSet) btnSet.textContent = trans.keypadSet;
  
  const btnClear = document.getElementById('keypad-btn-clear');
  if (btnClear) btnClear.textContent = trans.keypadClear;
  
  const currentStyle = DUCK_STYLES[currentPaletteIndex];
  lblCostumeTheme.textContent = currentLanguage === 'th' ? currentStyle.thName : currentStyle.name;
  
  const tabNum = document.getElementById('tab-btn-numbers');
  if (tabNum) tabNum.textContent = trans.tabNumbers;
  
  const tabName = document.getElementById('tab-btn-names');
  if (tabName) tabName.textContent = trans.tabNames;
  
  const lblShowNum = document.getElementById('lbl-show-numbers');
  if (lblShowNum) lblShowNum.textContent = trans.showNumbers;
  
  const lblShowLogo = document.getElementById('lbl-show-logo');
  if (lblShowLogo) lblShowLogo.textContent = trans.showLogo;
  
  const txtArea = document.getElementById('console-names-textarea');
  if (txtArea) txtArea.placeholder = trans.textareaPlaceholder;
  
  updateRosterStatusText();
  
  const premHeader = document.getElementById('lbl-premium-header');
  if (premHeader) premHeader.textContent = trans.premiumHeader;
  
  const premDesc = document.getElementById('lbl-premium-desc');
  if (premDesc) premDesc.textContent = trans.premiumDesc;
  
  const premTag = document.getElementById('lbl-premium-tag');
  if (premTag) premTag.textContent = trans.premiumTag;
  
  const findOutMoreBtn = document.getElementById('lbl-find-out-more');
  if (findOutMoreBtn) findOutMoreBtn.textContent = trans.findOutMore;
  
  const btnDel = document.getElementById('lbl-btn-delete');
  if (btnDel) btnDel.textContent = trans.btnDelete;
  
  const btnSv = document.getElementById('lbl-btn-save');
  if (btnSv) btnSv.textContent = trans.btnSave;
  
  const btnSaveAsBtn = document.getElementById('lbl-btn-saveas');
  if (btnSaveAsBtn) btnSaveAsBtn.textContent = trans.btnSaveAs;
  
  const countdownSub = document.getElementById('countdown-sub');
  if (countdownSub) countdownSub.textContent = trans.countdownSub;
  
  const podiumTitle = document.getElementById('lbl-podium-title');
  if (podiumTitle) podiumTitle.textContent = trans.podiumTitle;
  
  const podium2nd = document.getElementById('lbl-podium-2nd');
  if (podium2nd) podium2nd.textContent = trans.podium2nd;
  
  const podium1st = document.getElementById('lbl-podium-1st');
  if (podium1st) podium1st.textContent = trans.podium1st;
  
  const podium3rd = document.getElementById('lbl-podium-3rd');
  if (podium3rd) podium3rd.textContent = trans.podium3rd;
  
  const podiumClose = document.getElementById('lbl-podium-close');
  if (podiumClose) podiumClose.textContent = trans.podiumClose;
  
  const pillAddBtn = document.getElementById('lbl-pill-add');
  if (pillAddBtn) pillAddBtn.textContent = trans.pillAdd;
  
  const pillFullscreenBtn = document.getElementById('lbl-pill-fullscreen');
  if (pillFullscreenBtn) pillFullscreenBtn.textContent = trans.pillFullscreen;
  
  const pillAdFreeBtn = document.getElementById('lbl-pill-adfree');
  if (pillAdFreeBtn) pillAdFreeBtn.textContent = trans.pillAdFree;
}

function updateRosterStatusText() {
  if (!consoleRosterStatus) return;
  consoleRosterStatus.textContent = currentLanguage === 'th' 
    ? `เป็ดที่พิมพ์: ${ducks.length} ตัว` 
    : `Ducks in list: ${ducks.length}`;
}

// ----------------------------------------------------
// 🌟 Keypad Stopwatch Input Sub-Engine
// ----------------------------------------------------

function pressKey(key) {
  if (gameStatus !== 'idle') return;

  if (key === 'Clear') {
    keypadInputString = '';
  } else if (key === 'Set') {
    goToReadyState();
    return;
  } else {
    if (keypadInputString.length < 6) {
      keypadInputString += key;
    }
  }

  updateTimerDisplayUI();
}

function updateTimerDisplayUI() {
  let displayStr = keypadInputString.padStart(6, '0');
  let hh = displayStr.substring(0, 2);
  let mm = displayStr.substring(2, 4);
  let ss = displayStr.substring(4, 6);
  lobbyTimerScreen.textContent = `${hh}:${mm}:${ss}`;
}

function getEnteredSeconds() {
  let displayStr = keypadInputString.padStart(6, '0');
  let hh = parseInt(displayStr.substring(0, 2)) || 0;
  let mm = parseInt(displayStr.substring(2, 4)) || 0;
  let ss = parseInt(displayStr.substring(4, 6)) || 0;
  return (hh * 3600) + (mm * 60) + ss;
}

// ----------------------------------------------------
// 🖥️ Fullscreen Scaling API
// ----------------------------------------------------

function toggleFullscreen() {
  const container = document.getElementById('game-console-frame');
  if (!container) return;
  
  if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

// ----------------------------------------------------
// ⚙️ Action Buttons (Delete, Update/Save, Save As...)
// ----------------------------------------------------

function deleteRoster() {
  if (gameStatus !== 'idle') return;
  const confirmed = confirm(currentLanguage === 'th' 
    ? 'คุณต้องการล้างข้อมูลตั้งค่าและเป็ดทั้งหมดใช่หรือไม่?' 
    : 'Are you sure you want to delete and reset the current roster?');
    
  if (confirmed) {
    keypadInputString = '';
    updateTimerDisplayUI();
    
    if (consoleMode === 'numbers') {
      duckCountSlider.value = 4;
      sliderLabel.textContent = 4;
      generateRosterFromSlider();
    } else {
      consoleNamesTextarea.value = '';
      updateRosterFromConsoleNames();
    }
    
    alert(currentLanguage === 'th' ? 'ล้างข้อมูลสำเร็จแล้ว!' : 'Roster successfully cleared!');
  }
}

function saveRosterAndSettings() {
  if (gameStatus !== 'idle') return;
  
  const enteredSeconds = getEnteredSeconds();
  if (enteredSeconds > 0) {
    raceDuration = enteredSeconds;
    console.log(`Custom duration saved: ${raceDuration}s`);
  }
  
  socket.emit('admin_update_settings', {
    countdownDuration: countdownDuration,
    raceDuration: raceDuration
  });
  
  syncRosterToServer();
  
  alert(currentLanguage === 'th' 
    ? 'อัปเดตและบันทึกข้อมูลเรียบร้อยแล้ว! 💾' 
    : 'Settings and roster updated successfully! 💾');
}

function saveAsCustomList() {
  if (gameStatus !== 'idle') return;
  
  const listName = prompt(currentLanguage === 'th' 
    ? 'กรุณาใส่ชื่อสำหรับรายการตั้งค่าเป็ดนี้เพื่อจัดเก็บ:' 
    : 'Please enter a name to save this custom configuration:');
    
  if (!listName) return;
  
  const config = {
    mode: consoleMode,
    duckCount: duckCountSlider.value,
    names: consoleNamesTextarea.value,
    showNumbers: showDuckNumbers,
    showLogo: showDuckLogo,
    duration: raceDuration,
    paletteIndex: currentPaletteIndex,
    ducks: ducks.map(d => ({
      name: d.name,
      color: d.color,
      styleIndex: d.styleIndex
    }))
  };
  
  localStorage.setItem(`duck_race_custom_${listName}`, JSON.stringify(config));
  
  alert(currentLanguage === 'th' 
    ? `บันทึกรายการ "${listName}" สำเร็จเรียบร้อย! ✨` 
    : `Configuration "${listName}" saved successfully! ✨`);
}

// ----------------------------------------------------
// 🌟 Lobby Tabs & Color Changers
// ----------------------------------------------------

function toggleConsoleTab(tab) {
  consoleMode = tab;
  document.getElementById('tab-btn-numbers').classList.toggle('active', tab === 'numbers');
  document.getElementById('tab-btn-names').classList.toggle('active', tab === 'names');
  document.getElementById('tab-content-numbers').classList.toggle('active-content', tab === 'numbers');
  document.getElementById('tab-content-names').classList.toggle('active-content', tab === 'names');
  
  if (tab === 'numbers') {
    generateRosterFromSlider();
  } else {
    updateRosterFromConsoleNames();
  }
}

function onSliderChange() {
  const val = duckCountSlider.value;
  sliderLabel.textContent = val;
  generateRosterFromSlider();
}

function toggleDuckNumbersCustom() {
  showDuckNumbers = !showDuckNumbers;
  const cb = document.getElementById('cb-icon-numbers');
  if (cb) {
    cb.textContent = showDuckNumbers ? '✔️' : '❌';
    cb.classList.toggle('active-tick', showDuckNumbers);
  }
}

function toggleCustomLogoCustom() {
  showDuckLogo = !showDuckLogo;
  const cb = document.getElementById('cb-icon-logo');
  if (cb) {
    cb.textContent = showDuckLogo ? '✔️' : '❌';
    cb.classList.toggle('active-tick', showDuckLogo);
  }
}

function cycleDuckPalette(direction) {
  manualAccessorySet = true; // User interacted!
  currentPaletteIndex = (currentPaletteIndex + direction + DUCK_STYLES.length) % DUCK_STYLES.length;
  const current = DUCK_STYLES[currentPaletteIndex];
  lblCostumeTheme.textContent = currentLanguage === 'th' ? current.thName : current.name;
  
  // Draw premium vector duck inside parchment scroll!
  drawAvatarPreview();

  // Re-color/style all ducks in the race
  ducks.forEach((d) => {
    d.styleIndex = currentPaletteIndex;
    d.color = current.color;
  });

  // Sync colors with server
  syncRosterToServer();
}

function drawAvatarPreview() {
  if (!avatarPreviewCanvas) return;
  const ctxP = avatarPreviewCanvas.getContext('2d');
  ctxP.clearRect(0, 0, 80, 80);
  
  const current = DUCK_STYLES[currentPaletteIndex];
  // Centering preview duck inside the 80x80 canvas (x=40, y=48)
  drawDuck(ctxP, 40, 48, 32, '', current.color, currentPaletteIndex, 0, null, '', { first: null, second: null, third: null });
}

// ----------------------------------------------------
// ⚙️ Roster Generators, Socket Syncing & Accessories Randomizer
// ----------------------------------------------------

const GORGEOUS_COLORS = [
  '#ffd700', '#f72585', '#7209b7', '#39ff14', '#06b6d4', 
  '#ef4444', '#fcd34d', '#ff007f', '#4cc157', '#ff6b6b', 
  '#4ecdc4', '#ffe66d', '#a855f7', '#fb7185', '#00e5ff'
];

const PATTERNS = ['solid', 'stripes', 'zigzag', 'polka_dots'];
const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'captain_hat', 'bandana', 'mohawk', 'top_hat', 'party_hat', 'headphones'];

function randomizeDuckDesign(d) {
  const color = GORGEOUS_COLORS[Math.floor(Math.random() * GORGEOUS_COLORS.length)];
  d.color = color;
  
  d.pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
  
  let patternColor = GORGEOUS_COLORS[Math.floor(Math.random() * GORGEOUS_COLORS.length)];
  while (patternColor === color) {
    patternColor = GORGEOUS_COLORS[Math.floor(Math.random() * GORGEOUS_COLORS.length)];
  }
  d.patternColor = patternColor;
  
  d.accessory = ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
  d.accessoryColor = GORGEOUS_COLORS[Math.floor(Math.random() * GORGEOUS_COLORS.length)];
  d.wingColor = GORGEOUS_COLORS[Math.floor(Math.random() * GORGEOUS_COLORS.length)];
  d.beakColor = ['#ff6600', '#ffd700', '#ff007f', '#ff9f1c'][Math.floor(Math.random() * 4)];
}

function shuffleCharacters() {
  if (gameStatus !== 'ready' && gameStatus !== 'idle') return;
  playSound(soundSplash);
  ducks.forEach(d => {
    randomizeDuckDesign(d);
  });
  syncRosterToServer();
  updateAndRender();
}

function initDuckState(duckData) {
  const styleIdx = duckData.styleIndex !== undefined ? duckData.styleIndex : Math.floor(Math.random() * 10);
  const style = DUCK_STYLES[styleIdx];
  const d = {
    id: duckData.id,
    name: duckData.name,
    styleIndex: styleIdx,
    color: duckData.color || style.color,
    x: 20, // start X
    y: 0,
    speed: 0,
    speedFactor: 1.0,
    bobbingPhase: Math.random() * 10,
    isRigged: 0,
    rank: null,
    finishTime: null,
    stuckCounter: 0,
    hasQuacked: false
  };

  // Restore/randomize pattern, accessory styling
  d.pattern = duckData.pattern || 'solid';
  d.patternColor = duckData.patternColor || d.color;
  d.accessory = duckData.accessory || style.accessory || 'none';
  d.accessoryColor = duckData.accessoryColor || '#ffffff';
  d.wingColor = duckData.wingColor || style.wingColor || adjustBrightness(d.color, -16);
  d.beakColor = duckData.beakColor || style.beakColor || '#ff6600';

  if (!duckData.color || d.pattern === 'solid') {
    randomizeDuckDesign(d);
  }

  return d;
}

function generateRosterFromSlider() {
  const count = parseInt(duckCountSlider.value) || 4;

  const temp = [];
  for (let i = 1; i <= count; i++) {
    const styleIdx = manualAccessorySet ? currentPaletteIndex : Math.floor(Math.random() * 10);
    const style = DUCK_STYLES[styleIdx];
    const item = {
      id: `duck-num-${i}`,
      name: `${i}`,
      styleIndex: styleIdx,
      color: style.color
    };
    randomizeDuckDesign(item);
    temp.push(item);
  }

  ducks = temp.map(d => initDuckState(d));
  syncRosterToServer();
}

function onConsoleNamesChange() {
  updateRosterFromConsoleNames();
}

function updateRosterFromConsoleNames() {
  const text = consoleNamesTextarea.value;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const temp = lines.map((name, index) => {
    const existing = ducks.find(d => d.name === name);
    const styleIdx = existing ? existing.styleIndex : (manualAccessorySet ? currentPaletteIndex : Math.floor(Math.random() * 10));
    const style = DUCK_STYLES[styleIdx];
    const item = {
      id: existing ? existing.id : `duck-${Date.now()}-${index}`,
      name: name,
      styleIndex: styleIdx,
      color: existing ? existing.color : style.color
    };
    if (!existing) {
      randomizeDuckDesign(item);
    } else {
      item.pattern = existing.pattern;
      item.patternColor = existing.patternColor;
      item.accessory = existing.accessory;
      item.accessoryColor = existing.accessoryColor;
      item.wingColor = existing.wingColor;
      item.beakColor = existing.beakColor;
    }
    return item;
  });

  ducks = temp.map(d => initDuckState(d));
  if (consoleRosterStatus) {
    consoleRosterStatus.textContent = `Ducks in list: ${ducks.length}`;
  }
  syncRosterToServer();
}

function syncRosterToServer() {
  socket.emit('client_roster_update', ducks.map(d => ({ 
    id: d.id, 
    name: d.name, 
    color: d.color,
    styleIndex: d.styleIndex,
    pattern: d.pattern,
    patternColor: d.patternColor,
    accessory: d.accessory,
    accessoryColor: d.accessoryColor,
    wingColor: d.wingColor,
    beakColor: d.beakColor
  })));
}

// ----------------------------------------------------
// 🌟 Socket.io Events
// ----------------------------------------------------

socket.on('game_init', (serverState) => {
  console.log('Server state loaded:', serverState);
  
  countdownDuration = serverState.countdownDuration || 5;
  raceDuration = serverState.raceDuration || 15;
  riggedWinners = serverState.riggedWinners;
  
  // Sync loaded duration to digital stopwatch display
  keypadInputString = formatSecondsToKeypadString(raceDuration);
  updateTimerDisplayUI();
  
  if (serverState.ducks && serverState.ducks.length > 0) {
    ducks = serverState.ducks.map(d => initDuckState(d));
    
    // Sync into lobby controls
    if (ducks[0] && ducks[0].id.includes('num')) {
      consoleMode = 'numbers';
      duckCountSlider.value = ducks.length;
      sliderLabel.textContent = ducks.length;
    } else {
      consoleMode = 'names';
      consoleNamesTextarea.value = ducks.map(d => d.name).join('\n');
      consoleRosterStatus.textContent = `เป็ดที่พิมพ์: ${ducks.length} ตัว`;
    }
    toggleConsoleTab(consoleMode);
  } else {
    // Default starting list
    generateRosterFromSlider();
  }
});

socket.on('sync_settings', (settingsInfo) => {
  countdownDuration = settingsInfo.countdownDuration || 5;
  raceDuration = settingsInfo.raceDuration || 15;
  console.log(`Settings synced from server: countdown=${countdownDuration}, duration=${raceDuration}`);
});

socket.on('sync_rigging', (newRigged) => {
  riggedWinners = newRigged;
  ducks.forEach(d => {
    d.isRigged = 0;
    if (riggedWinners.first === d.id) d.isRigged = 1;
    else if (riggedWinners.second === d.id) d.isRigged = 2;
    else if (riggedWinners.third === d.id) d.isRigged = 3;
  });
});

socket.on('game_start_race', () => {
  if (gameStatus === 'idle' || gameStatus === 'ready') {
    // Transition screens if started from idle remotely
    lobbyPanel.style.display = 'none';
    const readyOverlay = document.getElementById('ready-racing-overlay');
    if (readyOverlay) {
      readyOverlay.classList.remove('hidden');
      const btnShuffle = readyOverlay.querySelector('.btn-shuffle');
      const btnStart = readyOverlay.querySelector('.btn-start');
      if (btnShuffle) btnShuffle.classList.add('hidden');
      if (btnStart) btnStart.classList.add('hidden');
    }
    
    // Position ducks behind diagonal line
    const startWaterY = 305;
    const endWaterY = 545;
    const usableHeight = endWaterY - startWaterY;
    const laneHeight = usableHeight / ducks.length;
    ducks.forEach((d, idx) => {
      d.baseY = startWaterY + (idx * laneHeight) + (laneHeight / 2);
      d.y = d.baseY;
      d.x = (250 - (d.y - 285) * 6 / 13) - 35;
    });

    // Start racing immediately with no countdown!
    beginRace();
  }
});

socket.on('game_reset_race', () => {
  resetRoster();
});

// ----------------------------------------------------
// 🏁 Race Game Engine Logic
// ----------------------------------------------------

function triggerSetTimerAndStart() {
  goToReadyState();
}

function goToReadyState() {
  if (ducks.length < 2) {
    alert('Please add at least 2 ducks for the race!');
    return;
  }
  
  // Read keypad timer entered
  let seconds = getEnteredSeconds();
  if (seconds > 0) {
    raceDuration = seconds;
    console.log(`Race duration custom set to: ${raceDuration} seconds`);
    // update server
    socket.emit('admin_update_settings', { countdownDuration, raceDuration });
  }

  gameStatus = 'ready';
  
  // Transition screens
  lobbyPanel.style.display = 'none';
  const readyOverlay = document.getElementById('ready-racing-overlay');
  if (readyOverlay) {
    readyOverlay.classList.remove('hidden');
    
    // Ensure shuffle and start buttons are visible in ready state
    const btnShuffle = readyOverlay.querySelector('.btn-shuffle');
    const btnStart = readyOverlay.querySelector('.btn-start');
    if (btnShuffle) btnShuffle.classList.remove('hidden');
    if (btnStart) btnStart.classList.remove('hidden');
  }
  
  // Show timer screen
  const timerScreen = document.getElementById('ready-timer-screen');
  if (timerScreen) {
    timerScreen.textContent = formatSecondsToStopwatch(raceDuration);
  }
  
  // Position lanes dynamically behind diagonal checkered line
  const startWaterY = 305;
  const endWaterY = 545;
  const usableHeight = endWaterY - startWaterY;
  const laneHeight = usableHeight / ducks.length;

  ducks.forEach((d, idx) => {
    d.baseY = startWaterY + (idx * laneHeight) + (laneHeight / 2);
    d.y = d.baseY;
    d.x = (250 - (d.y - 285) * 6 / 13) - 35;
    d.speed = 0;
    d.rank = null;
    d.finishTime = null;
    d.bobbingPhase = Math.random() * 10;
  });

  cameraX = 0;
  particlePool = [];
  
  socket.emit('client_status_update', { status: 'ready', duration: raceDuration });
  updateAndRender();
}

function startRaceFromReady() {
  // Hide shuffle and start buttons
  const readyOverlay = document.getElementById('ready-racing-overlay');
  if (readyOverlay) {
    const btnShuffle = readyOverlay.querySelector('.btn-shuffle');
    const btnStart = readyOverlay.querySelector('.btn-start');
    if (btnShuffle) btnShuffle.classList.add('hidden');
    if (btnStart) btnStart.classList.add('hidden');
  }
  
  // Trigger race start across all screens
  socket.emit('admin_trigger_start');
}

function formatSecondsToStopwatch(seconds) {
  let sec = Math.max(0, Math.floor(seconds));
  let hh = Math.floor(sec / 3600);
  let mm = Math.floor((sec % 3600) / 60);
  let ss = sec % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function beginCountdown() {
  gameStatus = 'counting_down';
  lobbyPanel.style.display = 'none';
  countdownOverlay.classList.remove('hidden');
  countdownVal = countdownDuration;
  countdownNumber.textContent = countdownVal;
  
  socket.emit('client_status_update', { status: 'counting_down', countdown: countdownVal });

  soundPlayed.countdown = false;
  soundPlayed.go = false;
  soundPlayed.cheering = false;

  playSound(soundCountdown);

  countdownTimer = setInterval(() => {
    countdownVal--;
    if (countdownVal > 0) {
      countdownNumber.textContent = countdownVal;
      playSound(soundCountdown);
      socket.emit('client_status_update', { status: 'counting_down', countdown: countdownVal });
    } else if (countdownVal === 0) {
      countdownNumber.textContent = 'GO!';
      playSound(soundGo);
      socket.emit('client_status_update', { status: 'counting_down', countdown: 0 });
    } else {
      clearInterval(countdownTimer);
      countdownOverlay.classList.add('hidden');
      beginRace();
    }
  }, 1000);
}

function beginRace() {
  gameStatus = 'racing';
  socket.emit('client_status_update', { status: 'racing' });
  
  // Make sure ready overlay is active and ready panel action buttons are hidden
  const readyOverlay = document.getElementById('ready-racing-overlay');
  if (readyOverlay) {
    readyOverlay.classList.remove('hidden');
    const btnShuffle = readyOverlay.querySelector('.btn-shuffle');
    const btnStart = readyOverlay.querySelector('.btn-start');
    if (btnShuffle) btnShuffle.classList.add('hidden');
    if (btnStart) btnStart.classList.add('hidden');
  }
  
  playSound(soundSplash);
  playSound(soundCheering);

  // Position lanes dynamically in the water area (avoiding sky and grass banks)
  const startWaterY = 305;
  const endWaterY = 545;
  const usableHeight = endWaterY - startWaterY;
  const laneHeight = usableHeight / ducks.length;

  const assignedRanks = new Array(ducks.length).fill(null);

  // Apply rigging from the admin settings if configured
  if (riggedWinners.first) {
    const firstDuckIdx = ducks.findIndex(d => d.id === riggedWinners.first);
    if (firstDuckIdx !== -1) assignedRanks[firstDuckIdx] = 1;
  }
  if (riggedWinners.second) {
    const secondDuckIdx = ducks.findIndex(d => d.id === riggedWinners.second);
    if (secondDuckIdx !== -1) assignedRanks[secondDuckIdx] = 2;
  }
  if (riggedWinners.third) {
    const thirdDuckIdx = ducks.findIndex(d => d.id === riggedWinners.third);
    if (thirdDuckIdx !== -1) assignedRanks[thirdDuckIdx] = 3;
  }

  // Collect all ranks that are still available (not rigged)
  const availableRanks = [];
  for (let r = 1; r <= ducks.length; r++) {
    if (!assignedRanks.includes(r)) {
      availableRanks.push(r);
    }
  }

  // Knuth-Shuffle to randomize available ranks organically!
  for (let i = availableRanks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableRanks[i], availableRanks[j]] = [availableRanks[j], availableRanks[i]];
  }

  // Fill in other empty ranks organically and randomly!
  let availableIdx = 0;
  ducks.forEach((d, idx) => {
    if (assignedRanks[idx] !== null) return;
    assignedRanks[idx] = availableRanks[availableIdx];
    availableIdx++;
  });

  // Assign parameters to each duck
  ducks.forEach((d, idx) => {
    d.baseY = startWaterY + (idx * laneHeight) + (laneHeight / 2);
    d.y = d.baseY;
    d.x = (250 - (d.y - 285) * 6 / 13) - 35;
    d.speed = 0;
    d.progress = 0;
    d.rank = null;
    d.finishTime = null;
    d.hasQuacked = false;
    d.bobbingPhase = Math.random() * 10;
    
    // Assign pre-determined target rankings
    d.targetRank = assignedRanks[idx];
    
    // Assign highly exciting, gentle and elegant sweet-spot sinusoidal variables for continuous, smooth back-and-forth overtaking
    d.amp1 = 0.030 + Math.random() * 0.020;  // 3% to 5% of course distance (max surge of ~140px, noticeable but elegant)
    d.amp2 = 0.015 + Math.random() * 0.015;  // 1.5% to 3% of course distance (adds gentle, secondary drift)
    
    // Balanced frequencies (2 to 4.5 cycles) to guarantee multiple overtakings back-and-forth during the race smoothly!
    d.freq1 = 2.5 + Math.random() * 2.0;
    d.freq2 = 2.0 + Math.random() * 1.5;
    
    d.phase1 = Math.random() * Math.PI * 2;
    d.phase2 = Math.random() * Math.PI * 2;
    
    // Assign target spacing offset at the finish line
    d.finishOffset = - (d.targetRank - 1) * 0.008;
  });

  raceStartTime = Date.now();
  smoothElapsed = 0;
  cameraX = 0;
  particlePool = [];
  
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(updateAndRender);
}

// ----------------------------------------------------
// 🕵️ Covert Rigging Sub-Engine
// ----------------------------------------------------

function updatePhysics() {
  smoothElapsed += 0.01667;
  const elapsed = smoothElapsed;
  
  let finishedCount = ducks.filter(d => d.rank !== null).length;
  let allFinished = finishedCount === ducks.length;

  const maxPersonalDuration = raceDuration + (ducks.length - 1) * 0.6;

  if (allFinished && elapsed >= maxPersonalDuration + 0.8) {
    handleRaceCompletion();
    return;
  }

  // Update top stopwatch timer display in real-time
  const remainingSeconds = Math.max(0, raceDuration - elapsed);
  const timerScreen = document.getElementById('ready-timer-screen');
  if (timerScreen) {
    timerScreen.textContent = formatSecondsToStopwatch(remainingSeconds);
  }

  ducks.forEach(d => {
    // Update bobbing waddling phase
    d.bobbingPhase += 0.08;

    // Staggered finish delay formula based on pre-assigned targetRank
    const personalDuration = raceDuration + (d.targetRank - 1) * 0.6;
    let duckProgress = elapsed / personalDuration;

    // Organic envelope (smooth dome shape peaking at the middle of the race and decaying to 0 at the start and end)
    // Damp waves completely when the duck reaches the finish line (duckProgress >= 1.0)
    let envelope = 0;
    if (duckProgress < 1.0) {
      envelope = Math.sin(duckProgress * Math.PI);
    }

    // Sinusoidal surging waves for lifelike, extremely smooth overtaking (subtle amplitudes for silk-like motion)
    let wave1 = Math.sin(duckProgress * Math.PI * d.freq1 + d.phase1) * d.amp1;
    let wave2 = Math.cos(duckProgress * Math.PI * d.freq2 + d.phase2) * d.amp2;

    // Subtle waddling paddling surge (paddling bursts twice per bobbing cycle)
    let paddleSurge = Math.sin(d.bobbingPhase * 2) * 0.003;

    let finalProgress = duckProgress + (wave1 + wave2 + paddleSurge) * envelope;

    // Strict Progress clamping (finalProgress is mathematically guaranteed strictly increasing with tuned wave parameters)
    d.progress = Math.max(0, Math.min(finalProgress, 1.12));

    // Keep ducks strictly inside their own lanes: no messy diagonal crossing!
    // But add an extremely subtle, organic waddling float (max 1.2px) so they feel like they are floating on water!
    const floatWaddle = Math.sin(duckProgress * Math.PI * 4 + d.phase1) * 1.2;
    d.y = d.baseY + floatWaddle;

    // Convert progress to coordinate position (startX = diagonal start, endX = COURSE_LENGTH)
    const startX = (250 - (d.y - 285) * 6 / 13) - 35;
    const endX = COURSE_LENGTH;
    const distance = endX - startX;
    let targetX = startX + d.progress * distance;

    // Exciting staggered column parking past the finish line (strictly on-screen between 2820px and 2895px)
    const restX = COURSE_LENGTH + 20 + (ducks.length - d.targetRank) * 7;
    if (targetX > restX) {
      targetX = restX;
    }

    // Buttery-smooth easing pursuit of targetX:
    if (d.x === undefined || d.x === 0 || d.x < 0) {
      d.x = startX;
    }
    
    let dx = targetX - d.x;
    
    // Dynamic pursuit factor: gentle, slow, and continuous easing during the race, and fast snapping once crossed to ensure 100% precision
    let easeFactor = 0.055; // Highly elegant, slow, and continuous waddle waddle!
    if (duckProgress >= 1.0) {
      easeFactor = 0.25; // Snaps quickly and precisely past the finish line!
    }
    
    d.x += dx * easeFactor;
    d.speed = dx * easeFactor;

    // Splash particles
    if (Math.random() < 0.12 && d.x < COURSE_LENGTH + 50) {
      createSplash(d.x - 15, d.y + 10, d.color);
    }

    // Occasional cute duck quacking sound
    if (Math.random() < 0.0015 && !d.hasQuacked) {
      playSound(soundQuack);
    }

    // Cross the finish line
    if (d.x >= COURSE_LENGTH && d.rank === null) {
      const finishedDucks = ducks.filter(x => x.rank !== null);
      d.rank = finishedDucks.length + 1;
      d.finishTime = Date.now();
      playSound(soundQuack);
    }
  });

  // Camera tracking: focus on the leading duck that hasn't finished yet
  let activeMaxX = 0;
  ducks.forEach(d => {
    if (d.rank === null && d.x > activeMaxX) activeMaxX = d.x;
  });
  
  if (activeMaxX === 0) activeMaxX = COURSE_LENGTH;
  
  const targetCamX = Math.max(0, Math.min(COURSE_LENGTH - VIEW_WIDTH + 120, activeMaxX - VIEW_WIDTH * 0.45));
  cameraX += (targetCamX - cameraX) * 0.06;
}

// ----------------------------------------------------
// 🎨 Canvas Drawing Renders
// ----------------------------------------------------

function updateAndRender() {
  if (gameStatus === 'racing') {
    updatePhysics();
    updateParticles();
  }

  // Clear frame
  ctx.fillStyle = '#005588';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.save();
  ctx.translate(-cameraX, 0);

  drawBackgroundParallax();
  drawFinishLine();
  drawWaterRippleDetails();
  drawParticles();

  ducks.forEach(d => {
    const bobbing = Math.sin(d.bobbingPhase) * 3;
    drawDuck(
      ctx,
      d.x,
      d.y,
      32,
      showDuckNumbers ? d.name : '',
      d.color,
      d.styleIndex,
      bobbing,
      d.rank,
      d.id,
      riggedWinners
    );
  });

  ctx.restore();

  if (gameStatus === 'racing' || gameStatus === 'finished') {
    animationFrameId = requestAnimationFrame(updateAndRender);
  }
}

function drawBackgroundParallax() {
  const pxSkyX = cameraX * 0.15;
  const pxGrassX = cameraX * 0.45;

  // 1. Sky (light sky blue)
  ctx.fillStyle = '#87ceeb'; // sky blue
  ctx.fillRect(cameraX, 0, VIEW_WIDTH, 150);
  
  // 2. Draw Sun in top-left with radiating rays
  ctx.save();
  ctx.translate(120 - pxSkyX, 60);
  ctx.strokeStyle = 'rgba(255, 223, 0, 0.45)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(0, 50);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Fluffy Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (let i = 0; i < 6; i++) {
    let cx = (i * 500 + 200) - pxSkyX;
    let cy = 40 + (i % 2) * 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.arc(cx + 20, cy - 10, 30, 0, Math.PI * 2);
    ctx.arc(cx + 45, cy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Grass bank (vibrant light green)
  ctx.fillStyle = '#4cd137'; // vibrant green
  ctx.fillRect(cameraX, 150, VIEW_WIDTH, 120);

  // 5. Green bushes along the grass bank
  ctx.fillStyle = '#44bd32'; // darker green for bushes
  for (let i = 0; i < 15; i++) {
    let bx = (i * 240 + 80) - pxGrassX;
    let by = 160 + (i % 2) * 15;
    ctx.beginPath();
    ctx.arc(bx, by, 18, 0, Math.PI * 2);
    ctx.arc(bx + 15, by - 6, 22, 0, Math.PI * 2);
    ctx.arc(bx + 30, by, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Draw blades of grass
  ctx.strokeStyle = '#44bd32';
  ctx.lineWidth = 2;
  for (let i = 0; i < 30; i++) {
    let gx = (i * 120 + 30) - pxGrassX;
    let gy = 200 + (i % 3) * 20;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 4, gy - 10);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy - 12);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 4, gy - 8);
    ctx.stroke();
  }

  // 7. Brown River bank (dirt shore line)
  ctx.fillStyle = '#8c5638'; // brown dirt color
  ctx.fillRect(cameraX, 270, VIEW_WIDTH, 15);

  // 8. Water area (ocean blue)
  ctx.fillStyle = '#00a8ff'; // vibrant water blue
  ctx.fillRect(cameraX, 285, VIEW_WIDTH, VIEW_HEIGHT - 285);
  
  // 9. Diagonal Checkered starting line from (250, 285) to (130, 545)
  const N = 26; // number of checkered segments
  const segHeight = 260 / N;
  const lineW = 10; // width of each checkered block
  for (let i = 0; i < N; i++) {
    const y1 = 285 + i * segHeight;
    const y2 = y1 + segHeight;
    const x1 = 250 - (y1 - 285) * 6 / 13;
    const x2 = 250 - (y2 - 285) * 6 / 13;
    
    // Segment 1 (left half of checkered line)
    ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#000000';
    ctx.beginPath();
    ctx.moveTo(x1 - lineW, y1);
    ctx.lineTo(x2 - lineW, y2);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x1, y1);
    ctx.closePath();
    ctx.fill();
    
    // Segment 2 (right half of checkered line)
    ctx.fillStyle = (i % 2 === 0) ? '#000000' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + lineW, y2);
    ctx.lineTo(x1 + lineW, y1);
    ctx.closePath();
    ctx.fill();
  }
  
  // Large styled lane numbers drawn right next to each lane
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.font = 'italic bold 48px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ducks.forEach((d, idx) => {
    const startX = 250 - (d.baseY - 285) * 6 / 13;
    ctx.fillText(`${idx + 1}`, startX + 35, d.baseY + 5);
  });
}

function drawFinishLine() {
  const lineX = COURSE_LENGTH;
  const stripeWidth = 15;

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(lineX, 285, 40, VIEW_HEIGHT - 285);

  ctx.fillStyle = '#000';
  for (let y = 285; y < VIEW_HEIGHT; y += stripeWidth * 2) {
    ctx.fillRect(lineX, y, stripeWidth, stripeWidth);
    ctx.fillRect(lineX + stripeWidth, y + stripeWidth, stripeWidth, stripeWidth);
  }

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(lineX + 15, 60, 10, VIEW_HEIGHT - 60);

  ctx.fillStyle = '#ff3300';
  ctx.font = 'bold 16px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillRect(lineX - 40, 60, 120, 32);
  ctx.fillStyle = '#fff';
  ctx.fillText('FINISH', lineX + 20, 82);
  ctx.restore();
}

function drawWaterRippleDetails() {
  // 1. Lane dividers / current lines (flowing dashed ripples)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  
  ducks.forEach((d, idx) => {
    if (idx === 0) return;
    ctx.beginPath();
    // Flowing line dash! This animates the line to flow right-to-left
    const flowOffset = (Date.now() * 0.02) % 30;
    ctx.setLineDash([15, 15]);
    ctx.lineDashOffset = flowOffset;
    const dividerY = d.y - (d.y - ducks[idx - 1].y) / 2;
    ctx.moveTo(0, dividerY);
    ctx.lineTo(COURSE_LENGTH + 200, dividerY);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // 2. Beautiful wavy flowing river currents in the background
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1.5;
  const flowT = Date.now() * 0.0015;
  
  for (let i = 0; i < 15; i++) {
    const waveY = 295 + (i * 18);
    ctx.beginPath();
    // Draw a long flowing wave curve
    for (let x = cameraX; x < cameraX + VIEW_WIDTH + 100; x += 40) {
      const dy = Math.sin(x * 0.01 + flowT + i) * 5;
      if (x === cameraX) {
        ctx.moveTo(x, waveY + dy);
      } else {
        ctx.lineTo(x, waveY + dy);
      }
    }
    ctx.stroke();
  }

  // 3. Cute floating bubbles/sparkles that float down the river
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  const t = Date.now() * 0.002;
  for (let i = 0; i < 30; i++) {
    // Generate pseudorandom but stable properties based on index
    let seed = Math.sin(i * 123.456);
    let startX = (i * 180) % (COURSE_LENGTH + 400);
    // Flowing speed
    let flowSpeed = 1.5 + Math.abs(seed) * 1.5;
    let wx = (startX - (t * 50 * flowSpeed)) % (COURSE_LENGTH + 400);
    if (wx < -50) wx += (COURSE_LENGTH + 400);
    
    let wy = 295 + Math.abs(Math.cos(i * 987.654)) * (VIEW_HEIGHT - 315);
    
    ctx.beginPath();
    ctx.arc(wx, wy, 2 + Math.abs(seed) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDuck(ctx, x, y, size, name, color, styleIndex, bobbingOffset, rank, id, riggedWinners) {
  ctx.save();
  ctx.translate(x, y + bobbingOffset);
  
  // Cute swimming tilt rotation based on bobbing phase for a waddling swimming effect!
  const tilt = (bobbingOffset / 3) * 0.12;
  ctx.rotate(tilt);

  // Look up duck state in memory to retrieve patterns & accessories if they exist
  const d = (typeof ducks !== 'undefined') ? ducks.find(x => x.id === id) : null;

  const style = DUCK_STYLES[styleIndex !== undefined ? styleIndex : 0] || DUCK_STYLES[0];
  const duckColor = color || (d && d.color) || style.color;
  const pattern = (d && d.pattern) ? d.pattern : 'solid';
  const patternColor = (d && d.patternColor) ? d.patternColor : duckColor;
  
  const wingColor = (d && d.wingColor) || style.wingColor || adjustBrightness(duckColor, -16);
  const beakColor = (d && d.beakColor) || style.beakColor || '#ff6600';
  
  const accessory = (d && d.accessory) ? d.accessory : (style.accessory || 'none');
  const accessoryColor = (d && d.accessoryColor) ? d.accessoryColor : '#ffffff';

  // 1. Soft Ambient Drop Shadow under the duck (anchors it to the water realistically!)
  ctx.fillStyle = 'rgba(0, 45, 90, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1.5 Swimming Water Wake (drawn behind/under the duck body)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 2.2;
  const t = Date.now() * 0.015 + x * 0.05;
  const waveAmp = 6 + Math.sin(t) * 3.5;
  
  // V-shape trail extending behind the duck
  ctx.beginPath();
  ctx.moveTo(-24, 6);
  ctx.quadraticCurveTo(-45, 6 - waveAmp, -75, 4 - waveAmp * 1.8);
  ctx.moveTo(-24, 6);
  ctx.quadraticCurveTo(-45, 6 + waveAmp, -75, 8 + waveAmp * 1.8);
  ctx.stroke();
  
  // Little bubbles/particles trailing behind
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 3; i++) {
    const bx = -35 - (i * 12) - (t * 2 % 10);
    const by = 6 + Math.sin(t + i) * 3;
    ctx.beginPath();
    ctx.arc(bx, by, 1.5 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. Tail (drawn behind the swim ring body)
  ctx.fillStyle = duckColor;
  ctx.beginPath();
  ctx.moveTo(-18, 2);
  ctx.quadraticCurveTo(-26, -6, -20, 0);
  ctx.quadraticCurveTo(-14, 4, -18, 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 3. Swim Ring Body (outer ellipse with volumetric 3D radial gradient shading)
  let ringGrad = ctx.createRadialGradient(-6, 0, 4, 0, 4, 26);
  ringGrad.addColorStop(0, adjustBrightness(duckColor, 35)); // Highlight specular reflection
  ringGrad.addColorStop(0.35, duckColor); // Base color
  ringGrad.addColorStop(1, adjustBrightness(duckColor, -42)); // 3D shadow depth

  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Render patterns inside swim ring
  if (pattern === 'stripes') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 14, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = patternColor;
    for (let sx = -40; sx < 40; sx += 12) {
      ctx.fillRect(sx, -25, 6, 50);
    }
    ctx.restore();
  } else if (pattern === 'zigzag') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 14, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let sy = -25; sy < 25; sy += 10) {
      ctx.moveTo(-35, sy);
      ctx.lineTo(-17, sy + 5);
      ctx.lineTo(0, sy);
      ctx.lineTo(17, sy + 5);
      ctx.lineTo(35, sy);
    }
    ctx.stroke();
    ctx.restore();
  } else if (pattern === 'polka_dots') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 14, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = patternColor;
    const dots = [
      {x: -12, y: -2}, {x: 0, y: -4}, {x: 12, y: 0},
      {x: -8, y: 10}, {x: 4, y: 8}, {x: -2, y: 3}, {x: 10, y: 12}
    ];
    dots.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Stroke Swim Ring Body
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 4, 24, 14, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Glossy Specular Highlight on Swim Ring (gives it a high-end plastic reflection)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.arc(-8, -1, 13, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();

  // 4. Inner Hole of Swim Ring (representing 3D depth)
  let holeGrad = ctx.createLinearGradient(0, 0, 0, 8);
  holeGrad.addColorStop(0, '#004488'); // Darkest shadow at top edge of hole
  holeGrad.addColorStop(1, '#0088cc'); // Lighter water highlight
  
  ctx.fillStyle = holeGrad;
  ctx.beginPath();
  ctx.ellipse(0, 4, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 5. Duck Neck & Head (drawn rising from the center of the ring)
  // Neck with linear 3D gradient
  let neckGrad = ctx.createLinearGradient(2, -4, 18, -4);
  neckGrad.addColorStop(0, adjustBrightness(duckColor, 20));
  neckGrad.addColorStop(1, adjustBrightness(duckColor, -25));
  ctx.fillStyle = neckGrad;
  
  ctx.beginPath();
  ctx.moveTo(2, 4);
  ctx.lineTo(14, -12);
  ctx.lineTo(22, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Head with 3D radial gradient sphere shading
  let headGrad = ctx.createRadialGradient(10, -16, 2, 14, -12, 11);
  headGrad.addColorStop(0, '#ffffff'); // Specular shiny white light highlight
  headGrad.addColorStop(0.15, adjustBrightness(duckColor, 35));
  headGrad.addColorStop(0.55, duckColor); // Base color
  headGrad.addColorStop(1, adjustBrightness(duckColor, -35)); // Deep sphere shadow
  
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(14, -12, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  
  // 6. Eye & Blush
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(17, -15, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16.2, -15.8, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Cute pink cheek blush for a gorgeous premium look!
  ctx.fillStyle = 'rgba(255, 102, 102, 0.6)';
  ctx.beginPath();
  ctx.arc(12, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // 7. Beak
  ctx.fillStyle = beakColor;
  ctx.beginPath();
  ctx.moveTo(24, -15);
  ctx.quadraticCurveTo(34, -13, 26, -9);
  ctx.quadraticCurveTo(22, -9, 24, -15);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 8. Wing (on side of the swim ring, drawn on top with 3D volume shading)
  let wingGrad = ctx.createRadialGradient(-4, 0, 2, -2, 3, 10);
  wingGrad.addColorStop(0, adjustBrightness(wingColor, 25));
  wingGrad.addColorStop(0.5, wingColor);
  wingGrad.addColorStop(1, adjustBrightness(wingColor, -35));
  
  ctx.fillStyle = wingGrad;
  ctx.beginPath();
  ctx.ellipse(-2, 3, 10, 6, Math.PI / 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // 9. Accessories relative to head center (14, -12)
  ctx.save();
  ctx.translate(14, -12);
  
  if (accessory === 'glasses') {
    ctx.strokeStyle = accessoryColor || '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(6, -4, 5, 0, Math.PI * 2);
    ctx.stroke();
    // bridge
    ctx.beginPath();
    ctx.moveTo(1, -4);
    ctx.lineTo(-3, -2);
    ctx.stroke();
  }
  else if (accessory === 'sunglasses') {
    ctx.fillStyle = '#111';
    ctx.strokeStyle = accessoryColor || '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(6, -4, 6, 4, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // arm
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-4, -2);
    ctx.stroke();
  }
  else if (accessory === 'captain_hat') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -11, 8, Math.PI, 0); // Cap dome
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cap brim
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(10, -8);
    ctx.stroke();
  }
  else if (accessory === 'bandana') {
    ctx.fillStyle = accessoryColor || '#ef4444';
    ctx.beginPath();
    ctx.arc(-2, -10, 9, Math.PI * 1.1, Math.PI * 1.9);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // tie
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-12, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  else if (accessory === 'mohawk') {
    ctx.fillStyle = accessoryColor || '#ff007f';
    ctx.beginPath();
    ctx.moveTo(-10, -11);
    ctx.lineTo(-4, -21);
    ctx.lineTo(2, -19);
    ctx.lineTo(6, -23);
    ctx.lineTo(10, -13);
    ctx.quadraticCurveTo(0, -13, -10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  else if (accessory === 'top_hat') {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-8, -11);
    ctx.lineTo(8, -11);
    ctx.stroke();
    // Hat
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.rect(-5, -23, 10, 12);
    ctx.fill();
    ctx.stroke();
    // band
    ctx.fillStyle = accessoryColor || '#ef4444';
    ctx.fillRect(-5, -14, 10, 3);
  }
  else if (accessory === 'party_hat') {
    ctx.fillStyle = accessoryColor || '#ff007f';
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(0, -27);
    ctx.lineTo(6, -11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // pom-pom
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, -28, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  else if (accessory === 'crown') {
    // Crown drawing disabled to preserve rigging secrecy
  }
  else if (accessory === 'headphones') {
    ctx.strokeStyle = accessoryColor || '#00a8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 1, 15, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // earcups
    ctx.fillStyle = accessoryColor || '#00a8ff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-14, 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(14, 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 10. White Capsule Tag (Number or Name) drawn at the VERY end on top of everything!
  if (name !== '') {
    ctx.save();
    ctx.font = 'bold 11px "Outfit", sans-serif';
    const textWidth = ctx.measureText(name).width;
    const rectWidth = Math.max(18, textWidth + 8);
    const rectHeight = 15;
    
    // Position tag dynamically above the head (head center is at X=14, Y=-12)
    let tagY = -12;
    if (accessory === 'party_hat') {
      tagY = -34;
    } else if (accessory === 'top_hat' || accessory === 'mohawk' || accessory === 'captain_hat') {
      tagY = -30;
    } else if (accessory !== 'none') {
      tagY = -26;
    } else {
      tagY = -22;
    }
    
    const rx = 14 - rectWidth / 2;
    const ry = tagY - rectHeight / 2;
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.8;
    
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rectWidth, rectHeight, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(rx + 6, ry + 6, 6, Math.PI, Math.PI * 1.5);
      ctx.arc(rx + rectWidth - 6, ry + 6, 6, Math.PI * 1.5, Math.PI * 2);
      ctx.arc(rx + rectWidth - 6, ry + rectHeight - 6, 6, 0, Math.PI * 0.5);
      ctx.arc(rx + 6, ry + rectHeight - 6, 6, Math.PI * 0.5, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, rx + rectWidth / 2, ry + rectHeight / 2 + 1);
    ctx.restore();
  }

  ctx.restore();
  
  // 10. Name tag on top of the duck (disabled to prevent duplicate tags)
}

function adjustBrightness(hex, percent) {
  let num = parseInt(hex.replace("#",""), 16),
  amt = Math.round(2.55 * percent),
  R = (num >> 16) + amt,
  G = (num >> 8 & 0x00FF) + amt,
  B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

// ----------------------------------------------------
// 🎆 Particles Splash
// ----------------------------------------------------

function createSplash(x, y, color) {
  for (let i = 0; i < 3; i++) {
    particlePool.push({
      x: x,
      y: y,
      vx: -1.5 - Math.random() * 2,
      vy: -1 - Math.random() * 2,
      color: 'rgba(255, 255, 255, 0.75)',
      size: 2 + Math.random() * 3,
      life: 1.0,
      decay: 0.04 + Math.random() * 0.04
    });
  }
}

function updateParticles() {
  particlePool.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    p.life -= p.decay;
  });
  particlePool = particlePool.filter(p => p.life > 0);
}

function drawParticles() {
  particlePool.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1.0;
}

function playSound(audioEl) {
  audioEl.currentTime = 0;
  audioEl.play().catch(e => console.log('Audio blocked by browser policy'));
}

// ----------------------------------------------------
// 🏆 Race Finished / Lobby Return
// ----------------------------------------------------

function handleRaceCompletion() {
  gameStatus = 'finished';
  cancelAnimationFrame(animationFrameId);

  const sorted = [...ducks].sort((a, b) => a.rank - b.rank);
  const winner1 = sorted[0];
  const winner2 = sorted[1];
  const winner3 = sorted[2];

  document.getElementById('avatar-1st').style.backgroundColor = winner1.color;
  document.getElementById('podium-1st-name').textContent = winner1.name;

  document.getElementById('avatar-2nd').style.backgroundColor = winner2.color;
  document.getElementById('podium-2nd-name').textContent = winner2.name;

  document.getElementById('avatar-3rd').style.backgroundColor = winner3.color;
  document.getElementById('podium-3rd-name').textContent = winner3.name;

  podiumOverlay.classList.remove('hidden');
  playSound(soundCheering);

  socket.emit('client_race_finished', {
    duckCount: ducks.length,
    winners: {
      first: winner1.name,
      second: winner2.name,
      third: winner3.name
    }
  });

  triggerConfetti();
}

function triggerConfetti() {
  let timer = setInterval(() => {
    if (gameStatus !== 'finished') {
      clearInterval(timer);
      return;
    }
    for (let i = 0; i < 8; i++) {
      particlePool.push({
        x: cameraX + Math.random() * VIEW_WIDTH,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        color: ['#ffd700', '#f72585', '#39ff14', '#06b6d4', '#ef4444', '#fcd34d', '#ff007f'][Math.floor(Math.random() * 7)],
        size: 4 + Math.random() * 6,
        life: 1.0,
        decay: 0.01
      });
    }
  }, 200);
  setTimeout(() => clearInterval(timer), 15000);
}

function resetRoster() {
  clearInterval(countdownTimer);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  
  gameStatus = 'idle';
  cameraX = 0;
  particlePool = [];
  
  countdownOverlay.classList.add('hidden');
  podiumOverlay.classList.add('hidden');
  
  // Hide ready-racing overlay
  const readyOverlay = document.getElementById('ready-racing-overlay');
  if (readyOverlay) readyOverlay.classList.add('hidden');
  
  // Show lobby console frame again
  lobbyPanel.style.display = 'flex';
  
  ducks.forEach(d => {
    d.x = 20;
    d.speed = 0;
    d.rank = null;
    d.finishTime = null;
  });

  updateAndRender();
  socket.emit('client_status_update', { status: 'idle' });
}

// ----------------------------------------------------
// 📢 DYNAMIC DUCK GOOGLE ADSENSE ROTATOR (Every 3.5s)
// ----------------------------------------------------

const ADS_DATABASE = {
  top: [
    { title: '⚡ ปั้นเพจออโต้ & ปักตะกร้าติ๊กตอกออโต้ เริ่มต้นเพียง 10 บาท! ⚡', subtitle: 'ระบบอัตโนมัติ 24 ชม. ดันยอดวิว ดันผู้ติดตาม เพิ่มการเข้าถึง มั่นใจได้ 100% ที่ TikFlow24.com', bg: 'linear-gradient(90deg, #ff007f 0%, #7928ca 100%)', text: '#fff' },
    { title: 'PDF Spaces unlock insights & next steps.', subtitle: 'Start free trial. Adobe Acrobat Studio.', bg: 'linear-gradient(90deg, #ff4e00 0%, #ec9f05 100%)', text: '#fff' },
    { title: 'Hostinger: Build your website in minutes!', subtitle: 'Get 80% off premium web hosting plan. Use code DUCK.', bg: 'linear-gradient(90deg, #6c33f2 0%, #8c52ff 100%)', text: '#fff' },
    { title: 'Shopee 6.6 Brands Festival!', subtitle: 'Free Shipping minimum spend 0฿. 50% discount codes live now.', bg: 'linear-gradient(90deg, #ff5722 0%, #ff8a65 100%)', text: '#fff' }
  ],
  left: [
    { title: 'TIKFLOW24.COM 🤖', text: 'หมดปัญหาปั้นช่องแล้วไม่ปัง! ระบบปั้นเพจ TikTok อัตโนมัติ ปักตะกร้าง่าย ๆ เริ่มต้นเพียง 10 บาท ดันยอดผู้ติดตาม & ดันยอดวิวครบวงจรในเว็บเดียว!', bg: 'linear-gradient(180deg, #0f0c1b 0%, #201335 100%)', btnText: 'เริ่มปั้นช่อง' },
    { title: 'Disneyland Paris', text: 'Pixar Summer Fest is here! Match colors and meet Buzz, Woody & Nemo today!', bg: 'linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', btnText: 'BOOK TICKETS' },
    { title: 'QUACKPOT CASINO 🎰', text: 'Bet on your lucky duck! Join 20,000+ winners daily. Withdrawals in 2 minutes guaranteed.', bg: 'linear-gradient(180deg, #b00020 0%, #1e1e1e 100%)', btnText: 'GET 100$ BONUS' },
    { title: 'Premium Duck Wheat 🌾', text: 'Make your ducks swim up to 30% faster and have organic yellow coats. 100% natural grain.', bg: 'linear-gradient(180deg, #134e5e 0%, #71b280 100%)', btnText: 'BUY 1 GET 1 FREE' }
  ],
  right: [
    { title: 'ปักตะกร้าติ๊กตอกออโต้ 🛒', text: 'ระบบปักตะกร้า TikTok Auto ดันยอดขายพุ่งแรงแบบไม่ต้องนั่งเฝ้า เริ่มต้นเพียง 10 บาท สมัครใช้งานเพื่อเพิ่มรายได้นายหน้าของคุณวันนี้!', bg: 'linear-gradient(180deg, #0c0817 0%, #ff007f 100%)', btnText: 'เริ่มปักตะกร้า' },
    { title: 'Adobe Creative Cloud', text: 'Save 30% on 20+ creative applications including Photoshop, Premiere, and Illustrator.', bg: 'linear-gradient(180deg, #00b4db 0%, #0083b0 100%)', btnText: 'START FREE TRIAL' },
    { title: 'Lazada Mega Sale!', text: 'Add to cart today! Best prices on gadgets, shirts, and electronics with free shipping vouchers.', bg: 'linear-gradient(180deg, #1f4068 0%, #162447 100%)', btnText: 'SHOP NOW' },
    { title: 'QuackCoin (QCK) Token', text: 'The next big meme token has arrived. Over 15,000% gains this week alone. Buy on PancakeSwap.', bg: 'linear-gradient(180deg, #2b1055 0%, #7597de 100%)', btnText: 'TRADE NOW' }
  ]
};

function rotateAdvertisements() {
  const topSlot = document.getElementById('ad-top-slot');
  const leftSlot = document.getElementById('ad-left-slot');
  const rightSlot = document.getElementById('ad-right-slot');

  if (!topSlot || !leftSlot || !rightSlot) return;

  // Add transition class to trigger fade out
  topSlot.style.opacity = '0.1';
  leftSlot.style.opacity = '0.1';
  rightSlot.style.opacity = '0.1';

  setTimeout(() => {
    // Select random entries
    const topAd = ADS_DATABASE.top[Math.floor(Math.random() * ADS_DATABASE.top.length)];
    const leftAd = ADS_DATABASE.left[Math.floor(Math.random() * ADS_DATABASE.left.length)];
    const rightAd = ADS_DATABASE.right[Math.floor(Math.random() * ADS_DATABASE.right.length)];

    // Populate Top Ad HTML
    topSlot.innerHTML = `
      <div class="ad-google-card" style="background: ${topAd.bg}; color: ${topAd.text}">
        <span class="ads-label" style="color: rgba(255,255,255,0.6)">ADVERTISEMENT</span>
        <h3 style="font-size: 1.15rem; font-weight:900;">${topAd.title}</h3>
        <p style="font-size: 0.8rem; font-weight:700; margin-top: 2px; opacity:0.9">${topAd.subtitle}</p>
      </div>
    `;

    // Populate Left Ad HTML
    leftSlot.innerHTML = `
      <div class="ad-google-card" style="background: ${leftAd.bg}; color: #fff; height: 100%; display:flex; flex-direction:column; padding:20px 14px; text-align:center; align-items:center;">
        <span class="ads-label" style="color: rgba(255,255,255,0.5)">SPONSORED</span>
        <h3 style="font-size: 1rem; font-weight:900; margin-top: 15px; margin-bottom: 20px;">${leftAd.title}</h3>
        <p style="font-size: 0.75rem; line-height:1.5; color: #e5e7eb; margin-bottom: auto;">${leftAd.text}</p>
        <button style="width: 100%; padding: 10px; background:#ffd166; border:none; font-weight:800; font-size:0.75rem; border-radius:4px; margin-top: 20px; cursor:pointer; color:#000">${leftAd.btnText}</button>
      </div>
    `;

    // Populate Right Ad HTML
    rightSlot.innerHTML = `
      <div class="ad-google-card" style="background: ${rightAd.bg}; color: #fff; height: 100%; display:flex; flex-direction:column; padding:20px 14px; text-align:center; align-items:center;">
        <span class="ads-label" style="color: rgba(255,255,255,0.5)">ADVERTISEMENT</span>
        <h3 style="font-size: 1rem; font-weight:900; margin-top: 15px; margin-bottom: 20px;">${rightAd.title}</h3>
        <p style="font-size: 0.75rem; line-height:1.5; color: #e5e7eb; margin-bottom: auto;">${rightAd.text}</p>
        <button style="width: 100%; padding: 10px; background:#4caf50; border:none; font-weight:800; font-size:0.75rem; border-radius:4px; margin-top: 20px; cursor:pointer; color:#fff">${rightAd.btnText}</button>
      </div>
    `;

    // Fade in back smoothly
    topSlot.style.opacity = '1';
    leftSlot.style.opacity = '1';
    rightSlot.style.opacity = '1';
  }, 350);
}

// ----------------------------------------------------
// 📱 Dynamic Canvas & Console UI Scaler
// ----------------------------------------------------

function resizeConsole() {
  const canvasEl = document.getElementById('gameCanvas');
  const scaler = document.getElementById('console-scaler');
  if (!canvasEl || !scaler) return;

  const w = canvasEl.clientWidth;
  const scale = w / VIEW_WIDTH;
  scaler.style.transform = `scale(${scale})`;
  scaler.style.left = `${canvasEl.offsetLeft}px`;
  scaler.style.top = `${canvasEl.offsetTop}px`;
}

// Start Ad rotator loop
rotateAdvertisements();
setInterval(rotateAdvertisements, 4500);

function formatSecondsToKeypadString(seconds) {
  let hh = Math.floor(seconds / 3600);
  let mm = Math.floor((seconds % 3600) / 60);
  let ss = seconds % 60;
  return `${hh.toString().padStart(2, '0')}${mm.toString().padStart(2, '0')}${ss.toString().padStart(2, '0')}`;
}

// Initial draw frame
window.addEventListener('load', () => {
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  
  // Set default keypad string and timer display from initial raceDuration
  keypadInputString = formatSecondsToKeypadString(raceDuration);
  updateTimerDisplayUI();
  
  // Draw custom vector duck inside the parchment scroll
  drawAvatarPreview();

  // Initialize bilingual translation UI
  updateLanguageUI();

  resizeConsole();
  updateAndRender();
});

window.addEventListener('resize', resizeConsole);
// Trigger immediate scale check
setTimeout(resizeConsole, 0);
setTimeout(resizeConsole, 100);

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Service Worker registered successfully! 📱'))
      .catch(err => console.error('PWA Service Worker registration failed:', err));
  });
}

