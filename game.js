// 🦆 High-Fidelity Duck Race Canvas & Console Engine with Dynamic rotating Ads

const socket = io();

// Get DOM Elements
const canvas = document.getElementById('gameCanvas');
let ctx = null;
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

// Three.js 3D WebGL Engine Globals
let scene, camera, renderer;
let waterMesh, waterGeometry, waterMaterial;
let sunLight;
let treeMeshes = [];
let duck3DGroups = {};
let finishPillars = [];
let is3DActive = false;
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

// Get or generate 4-digit Room ID
let roomId = localStorage.getItem('duck_race_room_id');
if (!roomId || roomId.length !== 4 || isNaN(roomId)) {
  roomId = Math.floor(1000 + Math.random() * 9000).toString();
  localStorage.setItem('duck_race_room_id', roomId);
}

// Identify as Game Screen with Room ID on connect
socket.on('connect', () => {
  socket.emit('identify', { role: 'game', roomId: roomId });
  console.log(`Socket connected! Identified room: ${roomId}`);
});

// Update UI badge immediately or on load
function updateRoomBadge() {
  const roomBadge = document.getElementById('lobby-room-id-badge');
  if (roomBadge) {
    roomBadge.textContent = `ROOM: ${roomId}`;
  }
}
if (document.readyState !== 'loading') {
  updateRoomBadge();
} else {
  document.addEventListener('DOMContentLoaded', updateRoomBadge);
}


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
    d.pattern = 'solid';
    d.wingColor = current.wingColor || adjustBrightness(current.color, -16);
    d.beakColor = current.beakColor || '#ff6600';
    d.accessory = current.accessory || 'none';
  });

  clear3DDucks();

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
  clear3DDucks();
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

  if (duckData.pattern === undefined && duckData.accessory === undefined) {
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

socket.on('game_sync_roster', (newDucks) => {
  console.log('Roster synced from server:', newDucks);
  ducks = newDucks.map(d => initDuckState(d));
  
  // Sync into lobby controls
  if (ducks[0] && ducks[0].id.includes('num')) {
    consoleMode = 'numbers';
    if (duckCountSlider) {
      duckCountSlider.value = ducks.length;
      sliderLabel.textContent = ducks.length;
    }
  } else {
    consoleMode = 'names';
    if (consoleNamesTextarea) {
      consoleNamesTextarea.value = ducks.map(d => d.name).join('\n');
      consoleRosterStatus.textContent = `เป็ดที่พิมพ์: ${ducks.length} ตัว`;
    }
  }
  toggleConsoleTab(consoleMode);

  clear3DDucks();
  updateAndRender();
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
    
    // Position ducks equally
    const startWaterY = 305;
    const endWaterY = 545;
    const usableHeight = endWaterY - startWaterY;
    const laneHeight = usableHeight / ducks.length;
    ducks.forEach((d, idx) => {
      d.baseY = startWaterY + (idx * laneHeight) + (laneHeight / 2);
      d.y = d.baseY;
      d.x = 100;
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
  
  // Position lanes dynamically behind checkered line
  const startWaterY = 305;
  const endWaterY = 545;
  const usableHeight = endWaterY - startWaterY;
  const laneHeight = usableHeight / ducks.length;

  ducks.forEach((d, idx) => {
    d.baseY = startWaterY + (idx * laneHeight) + (laneHeight / 2);
    d.y = d.baseY;
    d.x = 100;
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
    
    // Faster pursuit factor - ducks follow their target more closely
    let easeFactor = 0.12; // Faster, more responsive movement
    if (duckProgress >= 1.0) {
      easeFactor = 0.35; // Snaps quickly and precisely past the finish line!
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

  // Camera tracking: keep leading duck centered on screen
  let activeMaxX = 0;
  let activeMinX = Infinity;
  let activeDuckCount = 0;
  
  ducks.forEach(d => {
    if (d.rank === null) {
      if (d.x > activeMaxX) activeMaxX = d.x;
      if (d.x < activeMinX) activeMinX = d.x;
      activeDuckCount++;
    }
  });
  
  if (activeMaxX === 0) activeMaxX = COURSE_LENGTH;
  
  // Calculate center of all active ducks
  const duckCenterX = (activeMaxX + (activeMinX < Infinity ? activeMinX : activeMaxX)) / 2;
  
  // Camera follows the center of active ducks, keeping them in the middle of screen
  const targetCamX = Math.max(0, Math.min(COURSE_LENGTH - VIEW_WIDTH + 200, duckCenterX - VIEW_WIDTH * 0.5));
  
  // Smooth but responsive camera follow
  const cameraSpeed = activeDuckCount > 0 ? 0.15 : 0.1;
  cameraX += (targetCamX - cameraX) * cameraSpeed;
}

// ----------------------------------------------------
// 🎨 Canvas Drawing Renders
// ----------------------------------------------------

// ----------------------------------------------------
// 🎨 WebGL 3D / 2D Engine Rendering Integration
// ----------------------------------------------------

function isWebGLSupported() {
  try {
    const canvasTemp = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvasTemp.getContext('webgl') || canvasTemp.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function tryInit3D() {
  if (typeof THREE === 'undefined') {
    console.warn('Three.js library is not loaded. Falling back to 2D.');
    is3DActive = false;
    return;
  }
  if (!isWebGLSupported()) {
    console.warn('WebGL is not supported by the browser or GPU acceleration is disabled. Falling back to 2D.');
    is3DActive = false;
    return;
  }
  try {
    init3D();
    is3DActive = true;
    console.log('WebGL 3D Engine initialized successfully! 🎮');
  } catch (err) {
    console.error('Failed to initialize 3D WebGL context:', err);
    is3DActive = false;
  }
}

function init3D() {
  // 1. Initialize Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 2. Initialize Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#87ceeb'); // Beautiful sky blue
  scene.fog = new THREE.FogExp2('#87ceeb', 0.0004); // Atmospheric fog

  // 3. Initialize Camera
  camera = new THREE.PerspectiveCamera(40, VIEW_WIDTH / VIEW_HEIGHT, 1, 10000);
  camera.position.set(0, 320, 480); // x, y, z

  // 4. Initialize Lights
  const ambientLight = new THREE.AmbientLight('#ffffff', 0.55);
  scene.add(ambientLight);

  sunLight = new THREE.DirectionalLight('#ffffff', 1.0);
  sunLight.position.set(500, 1000, 300);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 2500;
  
  const d = 500;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  scene.add(sunLight);

  // 5. Add Banks (ground on top and bottom of the river, moved further apart for a wider river)
  const bankGeo = new THREE.BoxGeometry(COURSE_LENGTH + 2000, 100, 800);
  const bankMat = new THREE.MeshStandardMaterial({ color: '#55a630', roughness: 0.8, metalness: 0.1 });
  
  const topBank = new THREE.Mesh(bankGeo, bankMat);
  topBank.position.set(COURSE_LENGTH / 2, -50, -620); // Z = -620
  topBank.receiveShadow = true;
  scene.add(topBank);

  const bottomBank = new THREE.Mesh(bankGeo, bankMat);
  bottomBank.position.set(COURSE_LENGTH / 2, -50, 620); // Z = 620
  bottomBank.receiveShadow = true;
  scene.add(bottomBank);

  // 6. Add Sky Dome / Background Plane
  const skyGeo = new THREE.PlaneGeometry(8000, 4000);
  const skyMat = new THREE.MeshBasicMaterial({ color: '#7ad1ec', side: THREE.DoubleSide });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(COURSE_LENGTH / 2, 800, -1500);
  scene.add(skyMesh);

  // Add realistic clouds
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
  for (let i = 0; i < 25; i++) {
    const cloud = new THREE.Group();
    const numSpheres = 3 + Math.floor(Math.random() * 4);
    for (let s = 0; s < numSpheres; s++) {
      const r = 30 + Math.random() * 40;
      const sphereGeo = new THREE.SphereGeometry(r, 8, 8);
      const sphere = new THREE.Mesh(sphereGeo, cloudMat);
      sphere.position.set(s * 35 - 50, Math.random() * 15 - 7, Math.random() * 15 - 7);
      cloud.add(sphere);
    }
    cloud.position.set(
      Math.random() * (COURSE_LENGTH + 1500) - 500,
      400 + Math.random() * 200,
      -900 - Math.random() * 300
    );
    scene.add(cloud);
  }

  // 7. Add Realistic Water Plane with low-poly undulating waves
  waterGeometry = new THREE.PlaneGeometry(COURSE_LENGTH + 2000, 640, 64, 16);
  waterGeometry.rotateX(-Math.PI / 2);
  waterMaterial = new THREE.MeshStandardMaterial({
    color: '#0077be',
    roughness: 0.08,
    metalness: 0.88,
    transparent: true,
    opacity: 0.88,
    flatShading: true
  });
  waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
  waterMesh.position.set(COURSE_LENGTH / 2, -4, 0);
  waterMesh.receiveShadow = true;
  scene.add(waterMesh);

  const posAttr = waterGeometry.attributes.position;
  waterGeometry.userData = {
    originalY: []
  };
  for (let i = 0; i < posAttr.count; i++) {
    waterGeometry.userData.originalY.push(posAttr.getY(i));
  }

  // 8. Add Finish Line Pillars and Checkered Banner
  const pillarGeo = new THREE.CylinderGeometry(8, 8, 260, 16);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.5 });
  
  const p1 = new THREE.Mesh(pillarGeo, pillarMat);
  p1.position.set(COURSE_LENGTH, 130, -310);
  p1.castShadow = true;
  scene.add(p1);
  finishPillars.push(p1);

  const p2 = new THREE.Mesh(pillarGeo, pillarMat);
  p2.position.set(COURSE_LENGTH, 130, 310);
  p2.castShadow = true;
  scene.add(p2);
  finishPillars.push(p2);

  const bannerGeo = new THREE.BoxGeometry(10, 30, 620);
  const bannerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(COURSE_LENGTH, 230, 0);
  bannerMesh.castShadow = true;
  scene.add(bannerMesh);

  for (let cz = -300; cz <= 300; cz += 20) {
    const boxGeo = new THREE.BoxGeometry(11, 31, 10);
    const boxMat = new THREE.MeshBasicMaterial({ color: (Math.round((cz + 300) / 20) % 2 === 0) ? '#000000' : '#ffffff' });
    const checkMesh = new THREE.Mesh(boxGeo, boxMat);
    checkMesh.position.set(COURSE_LENGTH, 230, cz);
    scene.add(checkMesh);
  }

  // 9. Plant Forest of 3D Trees
  plant3DForest();
}

function plant3DForest() {
  const treeCount = 60;
  for (let i = 0; i < treeCount; i++) {
    const x = (i / treeCount) * (COURSE_LENGTH + 1200) - 400;
    // Plant all trees on the top bank (background) for unobstructed side view
    const z = -340 - Math.random() * 200;
    const scale = 0.8 + Math.random() * 0.6;

    const tree = create3DTree(scale);
    tree.position.set(x, 0, z);
    scene.add(tree);
    treeMeshes.push({ mesh: tree, swayOffset: Math.random() * 100, scale: scale });
  }
}

function create3DTree(scale) {
  const treeGroup = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(8 * scale, 12 * scale, 70 * scale, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 35 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  treeGroup.add(trunk);

  // Foliage
  const foliageGroup = new THREE.Group();
  foliageGroup.name = 'foliage';
  foliageGroup.position.y = 60 * scale;

  const foliageMat = new THREE.MeshStandardMaterial({
    color: ['#2d6a4f', '#40916c', '#1b4332', '#52b788'][Math.floor(Math.random() * 4)],
    roughness: 0.85,
    metalness: 0.1
  });

  for (let f = 0; f < 3; f++) {
    const bottomRadius = (28 - f * 6) * scale;
    const height = (35 - f * 4) * scale;
    const coneGeo = new THREE.ConeGeometry(bottomRadius, height, 8);
    const cone = new THREE.Mesh(coneGeo, foliageMat);
    cone.position.y = (f * 20) * scale;
    cone.castShadow = true;
    cone.receiveShadow = true;
    foliageGroup.add(cone);
  }

  treeGroup.add(foliageGroup);
  return treeGroup;
}

function create3DDuck(duckData) {
  const duckGroup = new THREE.Group();
  
  const styleIdx = duckData.styleIndex !== undefined ? duckData.styleIndex : 0;
  const style = DUCK_STYLES[styleIdx] || DUCK_STYLES[0];
  const duckColor = duckData.color || style.color;
  const beakColor = duckData.beakColor || style.beakColor || '#ff6600';
  const wingColor = duckData.wingColor || style.wingColor || adjustBrightness(duckColor, -16);
  const accessory = duckData.accessory || style.accessory || 'none';
  const accessoryColor = duckData.accessoryColor || '#ffffff';
  const patternColor = duckData.patternColor || '#00e5ff';

  const pattern = duckData.pattern || 'solid';
  // Use pattern color for wing accent to make patterned ducks highly distinct!
  const finalWingColor = pattern !== 'solid' ? patternColor : wingColor;

  // 1. Torso/Body (Volumetric realistic duck body, slightly tilted upward)
  const torsoGeo = new THREE.SphereGeometry(15, 16, 16);
  torsoGeo.scale(1.6, 1.2, 1.4);
  const torsoMat = new THREE.MeshStandardMaterial({ color: duckColor, roughness: 0.25, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(-2, 9, 0);
  torso.rotation.z = -Math.PI / 20; // Natural chest-up swimming tilt
  torso.castShadow = true;
  torso.receiveShadow = true;
  duckGroup.add(torso);

  // 2. Neck
  const neckGeo = new THREE.CylinderGeometry(6, 8, 14, 12);
  const neck = new THREE.Mesh(neckGeo, torsoMat);
  neck.position.set(12, 18, 0);
  neck.rotation.z = -Math.PI / 6;
  neck.castShadow = true;
  neck.receiveShadow = true;
  duckGroup.add(neck);

  // 3. Head (Sphere with specular plastic highlight)
  const headGeo = new THREE.SphereGeometry(11, 16, 16);
  const head = new THREE.Mesh(headGeo, torsoMat);
  head.position.set(16, 26, 0);
  head.castShadow = true;
  head.receiveShadow = true;
  duckGroup.add(head);

  // 4. Tail (Flattened fan-like tail feathers)
  const tailGeo = new THREE.ConeGeometry(6, 14, 8);
  tailGeo.scale(1.6, 1.2, 0.6); // Thin side-to-side, wide front-to-back
  const tail = new THREE.Mesh(tailGeo, torsoMat);
  tail.position.set(-20, 13, 0);
  tail.rotation.z = Math.PI / 3;
  tail.castShadow = true;
  tail.receiveShadow = true;
  duckGroup.add(tail);

  // 5. Beak/Bill (Cute organic rounded duck bill)
  const beakGeo = new THREE.ConeGeometry(5, 12, 12);
  beakGeo.rotateZ(-Math.PI / 2); // Point forward
  beakGeo.scale(1.0, 0.7, 1.5); // Flatten to look like a bill!
  const beakMat = new THREE.MeshStandardMaterial({ color: beakColor, roughness: 0.3 });
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(26, 24, 0);
  beak.castShadow = true;
  duckGroup.add(beak);

  // 6. Eyes
  const eyeGeo = new THREE.SphereGeometry(1.8, 8, 8);
  eyeGeo.scale(1, 1, 0.5);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#111111' });
  
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(20, 28, 6.5);
  duckGroup.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(20, 28, -6.5);
  duckGroup.add(eyeR);

  // Eye highlights
  const sparkleGeo = new THREE.SphereGeometry(0.6, 8, 8);
  const sparkleMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const sparkleL = new THREE.Mesh(sparkleGeo, sparkleMat);
  sparkleL.position.set(21.2, 28.8, 6.7);
  duckGroup.add(sparkleL);

  const sparkleR = new THREE.Mesh(sparkleGeo, sparkleMat);
  sparkleR.position.set(21.2, 28.8, -6.7);
  duckGroup.add(sparkleR);

  // 7. Wings
  const wingGeo = new THREE.SphereGeometry(12, 8, 8);
  wingGeo.scale(1.4, 0.8, 0.3);
  const wingMat = new THREE.MeshStandardMaterial({ color: finalWingColor, roughness: 0.3 });
  
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-2, 9, 14);
  wingL.rotation.set(-Math.PI / 10, 0, Math.PI / 10);
  wingL.castShadow = true;
  duckGroup.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(-2, 9, -14);
  wingR.rotation.set(Math.PI / 10, 0, -Math.PI / 10);
  wingR.castShadow = true;
  duckGroup.add(wingR);

  // 8. Feet (Orange webbed feet floating under the duck)
  const footGeo = new THREE.BoxGeometry(12, 1.5, 10);
  const footMat = new THREE.MeshStandardMaterial({ color: '#ff6600', roughness: 0.8 });
  
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(6, -8, 13);
  footL.rotation.y = Math.PI / 8;
  duckGroup.add(footL);

  const footR = new THREE.Mesh(footGeo, footMat);
  footR.position.set(6, -8, -13);
  footR.rotation.y = -Math.PI / 8;
  duckGroup.add(footR);

  // 9. Accessories
  if (accessory === 'captain_hat') {
    const hatGroup = new THREE.Group();
    hatGroup.position.set(16, 35.5, 0);

    const domeGeo = new THREE.CylinderGeometry(8, 8, 6, 12);
    const domeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 3;
    dome.castShadow = true;
    hatGroup.add(dome);

    const brimGeo = new THREE.BoxGeometry(18, 2, 14);
    brimGeo.rotateY(Math.PI / 16);
    const brimMat = new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.3 });
    const brim = new THREE.Mesh(brimGeo, brimMat);
    brim.position.set(2, 0, 0);
    brim.castShadow = true;
    hatGroup.add(brim);

    duckGroup.add(hatGroup);
  }
  else if (accessory === 'glasses' || accessory === 'sunglasses' || accessory === 'neon_sunglasses') {
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(22, 28, 0);

    const lensGeo = new THREE.CylinderGeometry(4.5, 4.5, 1, 12);
    lensGeo.rotateX(Math.PI / 2);
    const isDarkLens = (accessory === 'sunglasses' || accessory === 'neon_sunglasses');
    const lensMat = new THREE.MeshStandardMaterial({
      color: isDarkLens ? '#111111' : '#a0d2eb',
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: isDarkLens ? 0.95 : 0.4
    });

    const lL = new THREE.Mesh(lensGeo, lensMat);
    lL.position.z = 5.5;
    glassesGroup.add(lL);

    const lR = new THREE.Mesh(lensGeo, lensMat);
    lR.position.z = -5.5;
    glassesGroup.add(lR);

    const frameGeo = new THREE.BoxGeometry(1.2, 1.2, 11);
    const frameColor = accessory === 'neon_sunglasses' ? '#39ff14' : (accessoryColor || '#ffd700');
    const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.2 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    glassesGroup.add(frame);

    duckGroup.add(glassesGroup);
  }
  else if (accessory === 'bandana') {
    const bandanaGeo = new THREE.SphereGeometry(11.3, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const bandanaMat = new THREE.MeshStandardMaterial({ color: accessoryColor, roughness: 0.7 });
    const bandana = new THREE.Mesh(bandanaGeo, bandanaMat);
    bandana.position.set(16, 26.5, 0);
    bandana.castShadow = true;
    duckGroup.add(bandana);
  }
  else if (accessory === 'mohawk') {
    const mohawkGeo = new THREE.BoxGeometry(16, 12, 2.5);
    const mohawkMat = new THREE.MeshStandardMaterial({ color: accessoryColor, roughness: 0.6 });
    const mohawk = new THREE.Mesh(mohawkGeo, mohawkMat);
    mohawk.position.set(12, 38, 0);
    mohawk.castShadow = true;
    duckGroup.add(mohawk);
  }
  else if (accessory === 'top_hat' || accessory === 'gentleman_hat') {
    const hatGroup = new THREE.Group();
    hatGroup.position.set(16, 36.5, 0);

    const brimGeo = new THREE.CylinderGeometry(13, 13, 1.2, 12);
    const brimMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
    const brim = new THREE.Mesh(brimGeo, brimMat);
    brim.castShadow = true;
    hatGroup.add(brim);

    const cylinderGeo = new THREE.CylinderGeometry(8, 8, 16, 12);
    const cylinder = new THREE.Mesh(cylinderGeo, brimMat);
    cylinder.position.y = 8;
    cylinder.castShadow = true;
    hatGroup.add(cylinder);

    const ribbonGeo = new THREE.CylinderGeometry(8.2, 8.2, 3, 12);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: accessoryColor, roughness: 0.5 });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.y = 1.5;
    hatGroup.add(ribbon);

    duckGroup.add(hatGroup);
  }
  else if (accessory === 'party_hat') {
    const coneGeo = new THREE.ConeGeometry(6.5, 20, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: accessoryColor, roughness: 0.5 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(16, 36, 0);
    cone.castShadow = true;
    duckGroup.add(cone);

    const pomGeo = new THREE.SphereGeometry(2.2, 8, 8);
    const pomMat = new THREE.MeshBasicMaterial({ color: '#ffd700' });
    const pom = new THREE.Mesh(pomGeo, pomMat);
    pom.position.set(16, 46, 0);
    duckGroup.add(pom);
  }
  else if (accessory === 'headphones') {
    const hpGroup = new THREE.Group();
    hpGroup.position.set(16, 26, 0);

    const bandGeo = new THREE.TorusGeometry(12, 1.8, 8, 24, Math.PI);
    bandGeo.rotateZ(Math.PI / 2);
    const hpMat = new THREE.MeshStandardMaterial({ color: accessoryColor, roughness: 0.3 });
    const band = new THREE.Mesh(bandGeo, hpMat);
    hpGroup.add(band);

    const cupGeo = new THREE.CylinderGeometry(4, 4, 3.5, 12);
    cupGeo.rotateX(Math.PI / 2);
    const cupL = new THREE.Mesh(cupGeo, hpMat);
    cupL.position.z = 12.5;
    hpGroup.add(cupL);

    const cupR = new THREE.Mesh(cupGeo, hpMat);
    cupR.position.z = -12.5;
    hpGroup.add(cupR);

    duckGroup.add(hpGroup);
  }
  else if (accessory === 'pirate_patch') {
    // Slanted strap around head
    const strapMat = new THREE.MeshBasicMaterial({ color: '#111111' });
    const strapGeo = new THREE.TorusGeometry(11.2, 0.6, 8, 24);
    strapGeo.rotateX(Math.PI / 2);
    strapGeo.rotateZ(Math.PI / 6);
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.position.set(16, 27.5, 0);
    duckGroup.add(strap);
    // Eyepatch disk on the left side eye (facing screen side profile)
    const patchGeo = new THREE.CylinderGeometry(2.5, 2.5, 1, 12);
    patchGeo.rotateX(Math.PI / 2);
    const patch = new THREE.Mesh(patchGeo, strapMat);
    patch.position.set(20.4, 28, 6.7);
    duckGroup.add(patch);
  }
  else if (accessory === 'unicorn_horn') {
    const hornGeo = new THREE.ConeGeometry(1.8, 12, 10);
    hornGeo.rotateZ(-Math.PI / 4); // Points forward/up
    const hornMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8, roughness: 0.2 });
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.set(24, 34, 0);
    duckGroup.add(horn);
  }
  else if (accessory === 'hero_mask') {
    const maskGroup = new THREE.Group();
    maskGroup.position.set(20.5, 28, 0);
    const maskMat = new THREE.MeshStandardMaterial({ color: accessoryColor || '#ef4444', roughness: 0.5 });
    // Thin box overlaying eye height
    const plateGeo = new THREE.BoxGeometry(1.2, 5.5, 14.5);
    const plate = new THREE.Mesh(plateGeo, maskMat);
    maskGroup.add(plate);
    duckGroup.add(maskGroup);
  }
  else if (accessory === 'diver_goggles') {
    // black frame
    const frameGeo = new THREE.BoxGeometry(2, 6, 14);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.5 });
    const visorFrame = new THREE.Mesh(frameGeo, frameMat);
    visorFrame.position.set(21.5, 27.8, 0);
    duckGroup.add(visorFrame);
    // blue transparent glass
    const glassGeo = new THREE.BoxGeometry(0.5, 4.5, 12.5);
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#00e5ff',
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.6
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(22.6, 27.8, 0);
    duckGroup.add(glass);
  }
  else if (accessory === 'gold_laurel') {
    const laurelGroup = new THREE.Group();
    laurelGroup.position.set(16, 33.5, 0);
    laurelGroup.rotation.x = Math.PI / 2;

    const ringGeo = new THREE.TorusGeometry(8.5, 0.8, 8, 24);
    const laurelMat = new THREE.MeshStandardMaterial({ color: '#ffd700', metalness: 0.8, roughness: 0.2 });
    const ring = new THREE.Mesh(ringGeo, laurelMat);
    laurelGroup.add(ring);

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const leafGeo = new THREE.SphereGeometry(1.2, 6, 6);
      leafGeo.scale(1.8, 0.8, 0.5);
      const leaf = new THREE.Mesh(leafGeo, laurelMat);
      leaf.position.set(Math.cos(a) * 8.5, Math.sin(a) * 8.5, 0);
      leaf.rotation.z = a + Math.PI / 2;
      laurelGroup.add(leaf);
    }
    duckGroup.add(laurelGroup);
  }

  duckGroup.userData = {
    id: duckData.id,
    name: duckData.name,
    accessory: accessory,
    torsoMesh: torso,
    wingL: wingL,
    wingR: wingR
  };

  create3DDuckTag(duckGroup, duckData.name, accessory);

  return duckGroup;
}

function create3DDuckTag(duckGroup, name, accessory) {
  if (!name) return;

  const textCanvas = document.createElement('canvas');
  textCanvas.width = 128;
  textCanvas.height = 32;
  const tCtx = textCanvas.getContext('2d');
  
  tCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 2;
  
  tCtx.beginPath();
  tCtx.roundRect(4, 4, 120, 24, 10);
  tCtx.fill();
  tCtx.stroke();

  tCtx.fillStyle = '#000000';
  tCtx.font = 'bold 16px "Outfit", "Inter", sans-serif';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText(name, 64, 16);

  const texture = new THREE.CanvasTexture(textCanvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  
  let tagY = 38;
  if (accessory === 'party_hat') tagY = 50;
  else if (accessory === 'top_hat' || accessory === 'mohawk' || accessory === 'captain_hat') tagY = 46;
  else if (accessory !== 'none') tagY = 42;
  
  sprite.position.set(16, tagY, 0);
  sprite.scale.set(45, 12, 1);
  sprite.name = 'tag';
  duckGroup.add(sprite);
}

function clear3DDucks() {
  if (typeof scene !== 'undefined' && duck3DGroups) {
    Object.keys(duck3DGroups).forEach(id => {
      scene.remove(duck3DGroups[id]);
    });
    duck3DGroups = {};
  }
}

function render3D() {
  const activeIds = new Set(ducks.map(d => d.id));
  
  Object.keys(duck3DGroups).forEach(id => {
    if (!activeIds.has(id)) {
      scene.remove(duck3DGroups[id]);
      delete duck3DGroups[id];
    }
  });

  ducks.forEach(d => {
    if (!duck3DGroups[d.id]) {
      const group = create3DDuck(d);
      scene.add(group);
      duck3DGroups[d.id] = group;
    }
  });

  ducks.forEach(d => {
    const group = duck3DGroups[d.id];
    if (!group) return;

    const targetZ = d.y - 425;
    
    group.position.x = d.x;
    group.position.z = targetZ;

    const bobbingVal = Math.sin(d.bobbingPhase) * 2;
    group.position.y = bobbingVal;
    
    const waddle = Math.sin(Date.now() * 0.015 + d.bobbingPhase) * 0.08;
    group.rotation.y = waddle;
    group.rotation.z = waddle * 0.5;

    const wingL = group.userData.wingL;
    const wingR = group.userData.wingR;
    if (wingL && wingR) {
      const flap = Math.sin(Date.now() * 0.025 + d.bobbingPhase) * 0.22;
      wingL.rotation.z = Math.PI / 12 + flap;
      wingR.rotation.z = -Math.PI / 12 - flap;
    }
  });

  if (waterGeometry) {
    const posAttr = waterGeometry.attributes.position;
    const originalY = waterGeometry.userData.originalY;
    const time = Date.now() * 0.002;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const wave = Math.sin(vx * 0.006 + time) * 6 + Math.sin(vz * 0.018 + time * 1.3) * 3;
      posAttr.setY(i, originalY[i] + wave);
    }
    posAttr.needsUpdate = true;
  }

  treeMeshes.forEach(t => {
    const foliage = t.mesh.getObjectByName('foliage');
    if (foliage) {
      foliage.rotation.z = Math.sin(Date.now() * 0.0016 + t.swayOffset) * 0.038 * t.scale;
      foliage.rotation.x = Math.sin(Date.now() * 0.0012 + t.swayOffset) * 0.026 * t.scale;
    }
  });

  let activeMaxX = 0;
  let activeMinX = Infinity;
  let activeDuckCount3D = 0;
  
  ducks.forEach(d => {
    if (d.rank === null) {
      if (d.x > activeMaxX) activeMaxX = d.x;
      if (d.x < activeMinX) activeMinX = d.x;
      activeDuckCount3D++;
    }
  });
  
  if (activeMaxX === 0) activeMaxX = COURSE_LENGTH;
  
  // Calculate center of all active ducks for 3D camera
  const duckCenterX3D = (activeMaxX + (activeMinX < Infinity ? activeMinX : activeMaxX)) / 2;
  
  // Follow the ducks up to the finish line, keeping them centered
  const targetCamX3D = Math.max(0, Math.min(COURSE_LENGTH + 200, duckCenterX3D - 100));

  const numDucks = ducks.length;
  // Calculate dynamic scale factor based on number of ducks (supporting 2 to 30)
  const tScale = Math.max(0, Math.min(1, (numDucks - 2) / 28)); // 0 for 2 ducks, 1 for 30 ducks
  const targetCamY = 120 + tScale * 180;
  const targetCamZ = 240 + tScale * 300;

  // Faster camera follow in 3D
  const camera3DSpeed = activeDuckCount3D > 0 ? 0.15 : 0.1;
  camera.position.x += (targetCamX3D - camera.position.x) * camera3DSpeed;
  camera.position.y += (targetCamY - camera.position.y) * camera3DSpeed;
  camera.position.z += (targetCamZ - camera.position.z) * camera3DSpeed;
  camera.lookAt(new THREE.Vector3(camera.position.x + 100, -20, 0));

  if (sunLight) {
    sunLight.position.x = camera.position.x + 300;
  }

  renderer.render(scene, camera);
}

function render2D() {
  if (!ctx) ctx = canvas.getContext('2d');
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
}

function updateAndRender() {
  if (gameStatus === 'racing') {
    updatePhysics();
    updateParticles();
  }

  if (is3DActive) {
    render3D();
  } else {
    render2D();
  }

  if (is3DActive) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(updateAndRender);
  } else {
    if (gameStatus === 'racing' || gameStatus === 'finished') {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateAndRender);
    }
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
  
  // 9. Straight Checkered starting line at X = 80
  const N = 26; // number of checkered segments
  const segHeight = 260 / N;
  const lineW = 10; // width of each checkered block
  for (let i = 0; i < N; i++) {
    const y1 = 285 + i * segHeight;
    const y2 = y1 + segHeight;
    const x1 = 80;
    const x2 = 80;
    
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
    const startX = 80;
    ctx.fillText(`${idx + 1}`, startX - 35, d.baseY + 5);
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

  // 2. Orange feet under the duck body
  ctx.save();
  ctx.fillStyle = '#ff6600';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.8;
  
  // Left foot
  ctx.beginPath();
  ctx.ellipse(-2, 13.5, 6, 3, Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Right foot
  ctx.beginPath();
  ctx.ellipse(6, 12.5, 6, 3, -Math.PI / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 3. Duck Torso/Body (Swimming directly in the water!)
  ctx.beginPath();
  ctx.moveTo(-10, -3);
  ctx.quadraticCurveTo(-18, -10, -22, -6); // upturned tail point
  ctx.quadraticCurveTo(-23, 0, -12, 5);    // back under-tail curve
  ctx.quadraticCurveTo(-2, 11, 8, 8);      // belly/bottom
  ctx.quadraticCurveTo(15, 3, 11, -4);     // chest curve
  ctx.quadraticCurveTo(3, -6, -10, -3);    // back line
  ctx.closePath();
  
  let bodyGrad = ctx.createRadialGradient(2, -2, 3, 2, -2, 18);
  bodyGrad.addColorStop(0, '#ffffff'); // bright light highlight
  bodyGrad.addColorStop(0.18, adjustBrightness(duckColor, 35));
  bodyGrad.addColorStop(0.55, duckColor);
  bodyGrad.addColorStop(1, adjustBrightness(duckColor, -35));
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Render patterns inside the duck torso (as realistic feather patterns)
  if (pattern === 'stripes') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = patternColor;
    for (let sx = -40; sx < 40; sx += 12) {
      ctx.fillRect(sx, -25, 6, 50);
    }
    ctx.restore();
  } else if (pattern === 'zigzag') {
    ctx.save();
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
    ctx.clip();
    ctx.fillStyle = patternColor;
    const dots = [
      {x: -12, y: -2}, {x: 0, y: -4}, {x: 12, y: 0},
      {x: -6, y: 4}, {x: 6, y: 4}, {x: -18, y: 2}
    ];
    dots.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }



  // 5. Duck Neck & Head (drawn rising from the body torso)
  ctx.beginPath();
  ctx.moveTo(11, -4);
  ctx.quadraticCurveTo(13, -10, 16, -12); // front neck
  ctx.lineTo(8, -12); // head base back
  ctx.quadraticCurveTo(5, -10, -2, -4); // back neck
  ctx.closePath();
  
  let neckGrad = ctx.createLinearGradient(5, -12, 10, -4);
  neckGrad.addColorStop(0, adjustBrightness(duckColor, 20));
  neckGrad.addColorStop(1, adjustBrightness(duckColor, -25));
  ctx.fillStyle = neckGrad;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.0;
  ctx.stroke();
  
  // Head with 3D radial gradient sphere shading
  let headGrad = ctx.createRadialGradient(9, -17, 2, 11, -14, 11.5);
  headGrad.addColorStop(0, '#ffffff'); // Glossy specular highlight
  headGrad.addColorStop(0.15, adjustBrightness(duckColor, 38));
  headGrad.addColorStop(0.55, duckColor); // Base color
  headGrad.addColorStop(1, adjustBrightness(duckColor, -38)); // Shadow
  
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(12, -14, 11.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  
  // 6. Eye & Blush (Disney/Anime style for extra premium look!)
  ctx.save();
  ctx.translate(15.5, -17.5);
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.ellipse(0, 0, 2.3, 3.8, Math.PI / 16, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-0.8, -1.3, 0.9, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(0.7, 1.3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Cheek blush
  ctx.fillStyle = 'rgba(255, 90, 110, 0.55)';
  ctx.beginPath();
  ctx.arc(9.5, -11, 2.8, 0, Math.PI * 2);
  ctx.fill();
  
  // 7. Beak (Volumetric bill with upper/lower parts and smile line)
  ctx.save();
  ctx.fillStyle = beakColor;
  ctx.beginPath();
  ctx.moveTo(21.5, -16.5);
  ctx.quadraticCurveTo(31, -18.5, 24, -11.5);
  ctx.quadraticCurveTo(17.5, -10.5, 15.5, -12.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.0;
  ctx.stroke();
  
  ctx.fillStyle = adjustBrightness(beakColor, -20);
  ctx.beginPath();
  ctx.moveTo(15.5, -12.5);
  ctx.quadraticCurveTo(21.5, -10.5, 22, -11.5);
  ctx.quadraticCurveTo(17.5, -8.5, 15, -11.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(21, -15.5, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 8. Wing (on side of the body, drawn with 3D feathered layers)
  ctx.save();
  ctx.translate(-2, 1);
  ctx.rotate(-Math.PI / 16);
  
  let wingGrad = ctx.createRadialGradient(-3, -1, 1, 0, 0, 11);
  wingGrad.addColorStop(0, '#ffffff'); // gloss highlight
  wingGrad.addColorStop(0.18, adjustBrightness(wingColor, 25));
  wingGrad.addColorStop(0.6, wingColor);
  wingGrad.addColorStop(1, adjustBrightness(wingColor, -30));
  ctx.fillStyle = wingGrad;
  
  ctx.beginPath();
  ctx.moveTo(-11, -1);
  ctx.quadraticCurveTo(-14, -3, -12, -6); // top feather tip
  ctx.quadraticCurveTo(-7, -8, 3, -6);    // wing top shoulder
  ctx.quadraticCurveTo(9, -1, 5, 5);      // front curve
  ctx.quadraticCurveTo(-2, 7, -8, 3);     // bottom curve
  ctx.quadraticCurveTo(-13, 3, -11, -1);  // bottom feather tip
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();

  // 9. Accessories relative to head center (12, -14)
  ctx.save();
  ctx.translate(12, -14);
  
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
  else if (accessory === 'sunglasses' || accessory === 'neon_sunglasses') {
    ctx.fillStyle = '#111';
    ctx.strokeStyle = accessory === 'neon_sunglasses' ? '#39ff14' : (accessoryColor || '#ffd700');
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
  else if (accessory === 'top_hat' || accessory === 'gentleman_hat') {
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
  else if (accessory === 'pirate_patch') {
    ctx.fillStyle = '#222222';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    // Strap
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(10, -1);
    ctx.stroke();
    // Patch
    ctx.beginPath();
    ctx.ellipse(5, -4, 4.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  else if (accessory === 'unicorn_horn') {
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#b89200';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -10);
    ctx.lineTo(12, -26);
    ctx.lineTo(7, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  else if (accessory === 'hero_mask') {
    ctx.fillStyle = accessoryColor || '#ef4444';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(4, -4.5, 7.5, 4.5, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Eye cutout
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(4.5, -4.5, 2.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(4.5, -4.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  else if (accessory === 'diver_goggles') {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2.0;
    // Strap
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.lineTo(4, -4);
    ctx.stroke();
    // Visor glass
    ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(5, -4, 7, 5, Math.PI / 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  else if (accessory === 'gold_laurel') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -9, 8, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // Leaves
    ctx.fillStyle = '#ffd700';
    const leafAngles = [Math.PI * 1.15, Math.PI * 1.35, Math.PI * 1.5, Math.PI * 1.65, Math.PI * 1.85];
    leafAngles.forEach(ang => {
      const lx = Math.cos(ang) * 8;
      const ly = -9 + Math.sin(ang) * 8;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 2.5, 1.5, ang + Math.PI/4, 0, Math.PI * 2);
      ctx.fill();
    });
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
    
    const rx = 12 - rectWidth / 2;
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

// ----------------------------------------------------
// 📢 DYNAMIC DUCK GOOGLE ADSENSE ROTATOR (Room-based dynamic sync)
// ----------------------------------------------------

function renderBanners(banners) {
  if (!banners) return;

  const slots = {
    top: document.getElementById('ad-top-slot'),
    left: document.getElementById('ad-left-slot'),
    right: document.getElementById('ad-right-slot'),
    bottom: document.getElementById('ad-bottom-slot')
  };

  Object.keys(slots).forEach(key => {
    const el = slots[key];
    if (!el) return;

    const config = banners[key];
    if (!config || !config.show) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';
    el.style.opacity = '1';

    if (key === 'bottom') {
      // Special styled container for the bottom banner
      const inner = el.querySelector('.bottom-ad-banner-inner') || el.querySelector('.ad-banner-inner') || el;
      if (config.type === 'image') {
        inner.innerHTML = `
          <a href="${config.link || '#'}" target="_blank" class="tikflow-banner-link">
            <div class="tikflow-banner-card" style="background: linear-gradient(rgba(15, 12, 27, 0.75), rgba(12, 8, 23, 0.85)), url('${config.content}') no-repeat center center; background-size: cover;">
              <span class="ads-badge">โปรโมชั่นพิเศษ</span>
              <div class="tikflow-content">
                <div class="tikflow-logo-group">
                  <span class="tikflow-brand">ADVERTISEMENT</span>
                </div>
                <p class="tikflow-headline">${config.content.includes('/') || config.content.includes('.') ? 'คลิกที่แบนเนอร์เพื่อดูโปรโมชั่นพิเศษ' : config.content}</p>
                <button class="tikflow-btn">ชมเว็บไซต์ 📈</button>
              </div>
            </div>
          </a>
        `;
      } else {
        inner.innerHTML = `
          <a href="${config.link || '#'}" target="_blank" class="tikflow-banner-link">
            <div class="tikflow-banner-card" style="background: linear-gradient(135deg, #0c0817 0%, #ff007f 100%);">
              <span class="ads-badge">ประกาศ</span>
              <div class="tikflow-content">
                <div class="tikflow-logo-group">
                  <span class="tikflow-brand">OFFICIAL</span>
                </div>
                <p class="tikflow-headline">${config.content}</p>
                <button class="tikflow-btn">ดูรายละเอียด 📈</button>
              </div>
            </div>
          </a>
        `;
      }
    } else {
      // Top, Left, Right banners
      if (config.type === 'image') {
        el.innerHTML = `
          <a href="${config.link || '#'}" target="_blank" style="display:block; width:100%; height:100%; text-decoration:none;">
            <img src="${config.content}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" alt="Sponsor Banner">
          </a>
        `;
      } else {
        // Custom HTML or text banner
        const isLeftOrRight = key === 'left' || key === 'right';
        if (isLeftOrRight) {
          el.innerHTML = `
            <div class="ad-google-card" style="background: linear-gradient(180deg, #0f0c1b 0%, #201335 100%); color: #fff; height: 100%; display:flex; flex-direction:column; padding:20px 14px; text-align:center; align-items:center;">
              <span class="ads-label" style="color: rgba(255,255,255,0.5)">SPONSORED</span>
              <p style="font-size: 0.82rem; line-height:1.5; color: #f1f5f9; margin-top: auto; margin-bottom: auto; white-space: pre-wrap;">${config.content}</p>
              <a href="${config.link || '#'}" target="_blank" style="width:100%; text-decoration:none; margin-top:auto;">
                <button style="width: 100%; padding: 10px; background:#ff007f; border:none; font-weight:800; font-size:0.75rem; border-radius:4px; cursor:pointer; color:#fff">${config.btnText || 'LEARN MORE'}</button>
              </a>
            </div>
          `;
        } else {
          // Top banner
          el.innerHTML = `
            <div class="ad-google-card" style="background: linear-gradient(90deg, #ff007f 0%, #7928ca 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; height:100%; width:100%; padding: 12px 20px;">
              <span class="ads-label" style="color: rgba(255,255,255,0.6)">ADVERTISEMENT</span>
              <p style="font-size: 1rem; font-weight:700; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${config.content}</p>
            </div>
          `;
        }
      }
    }
  });
}

// Receive dynamic updates from Socket.io
socket.on('sync_banners', (banners) => {
  renderBanners(banners);
});

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
    d.x = 100;
    d.speed = 0;
    d.rank = null;
    d.finishTime = null;
  });

  updateAndRender();
  socket.emit('client_status_update', { status: 'idle' });
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

  // Initialize Three.js 3D Engine
  tryInit3D();

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

