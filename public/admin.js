// Preset Color Palettes & 10 Beautifully Designed Custom Duck Styles
const DUCK_STYLES = [
  { name: 'Classic Yellow 💛', color: '#ffd700', wingColor: '#e5c100', beakColor: '#ff6600', accessory: 'none' },
  { name: 'Cool Captain 🧑‍✈️', color: '#f3f4f6', wingColor: '#cbd5e1', beakColor: '#ff6600', accessory: 'captain_hat' },
  { name: 'Rubber Pirate 🏴‍☠️', color: '#475569', wingColor: '#334155', beakColor: '#e11d48', accessory: 'pirate_patch' },
  { name: 'Neon Cyber ⚡', color: '#39ff14', wingColor: '#2bb50e', beakColor: '#ff007f', accessory: 'neon_sunglasses' },
  { name: 'Princess Pink 🌸', color: '#f72585', wingColor: '#b5179e', beakColor: '#ffd166', accessory: 'none' },
  { name: 'Gentleman Slate 🎩', color: '#1e293b', wingColor: '#0f172a', beakColor: '#d97706', accessory: 'gentleman_hat' },
  { name: 'Unicorn Pastel 🦄', color: '#c084fc', wingColor: '#a855f7', beakColor: '#fb7185', accessory: 'unicorn_horn' },
  { name: 'Super Hero Red 🦸', color: '#ef4444', wingColor: '#b91c1c', beakColor: '#fbbf24', accessory: 'hero_mask' },
  { name: 'Aqua Diver 🤿', color: '#06b6d4', wingColor: '#0891b2', beakColor: '#f97316', accessory: 'diver_goggles' },
  { name: 'Gold Laurel 🏆', color: '#fbbf24', wingColor: '#d97706', beakColor: '#ea580c', accessory: 'gold_laurel' }
];

const socket = io();

// Automatically re-identify on reconnect to keep room connection alive
socket.on('connect', () => {
  if (activeRoomId) {
    socket.emit('identify', { role: 'admin', roomId: activeRoomId });
    console.log(`Socket re-connected! Identified admin room: ${activeRoomId}`);
  }
});

// Get UI DOM Elements
const txtAdmins = document.getElementById('txt-admins');
const txtGames = document.getElementById('txt-games');
const statusBadge = document.getElementById('current-status-badge');
const inputCountdown = document.getElementById('input-countdown');
const inputDuration = document.getElementById('input-duration');
const duckSearch = document.getElementById('duck-search');
const duckRosterList = document.getElementById('duck-roster-list');
const historyLogList = document.getElementById('history-log-list');
const toastEl = document.getElementById('toast');
const soundSuccess = document.getElementById('sound-success');

// Dynamic Banners Manager Elements
const bannerSlotSelect = document.getElementById('banner-slot-select');
const bannerShow = document.getElementById('banner-show');
const bannerContent = document.getElementById('banner-content');
const bannerLink = document.getElementById('banner-link');
const bannerBtnText = document.getElementById('banner-btn-text');
const bannerBtnTextGroup = document.getElementById('banner-btn-text-group');

// Local State Copy
let localDucks = [];
let localRigged = { first: null, second: null, third: null };
let localStatus = 'idle';
let localBanners = {};
let activeRoomId = null;

// Initialize overlay & listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const roomInput = document.getElementById('input-room-id');
  if (roomInput) {
    // Pre-fill last room ID if exists in storage
    const cachedRoom = localStorage.getItem('duck_race_admin_roomId');
    if (cachedRoom && /^\d{4}$/.test(cachedRoom)) {
      roomInput.value = cachedRoom;
    }
    
    // Auto-focus room ID input
    roomInput.focus();
    
    // Allow pressing Enter key to submit
    roomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        connectToRoom();
      }
    });
  }
});

function connectToRoom() {
  const roomInput = document.getElementById('input-room-id');
  const errorEl = document.getElementById('login-error');
  if (!roomInput) return;
  const roomId = roomInput.value.trim();
  
  if (!/^\d{4}$/.test(roomId)) {
    if (errorEl) errorEl.classList.remove('hidden');
    return;
  }
  
  if (errorEl) errorEl.classList.add('hidden');
  activeRoomId = roomId;
  
  // Cache the Room ID
  localStorage.setItem('duck_race_admin_roomId', roomId);
  
  // Identify to server
  socket.emit('identify', { role: 'admin', roomId: roomId });
  
  // Update admin header text to show the connected room
  const headerLogoSpan = document.querySelector('.header-logo span');
  if (headerLogoSpan) {
    headerLogoSpan.textContent = `ADMIN PORTAL - ROOM ${roomId}`;
  }
  
  // Hide overlay
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
  
  showToast(`🔒 Connected to Room ${roomId}`);
  playSuccessSound();
}

// Play confirmation sound
function playSuccessSound() {
  soundSuccess.currentTime = 0;
  soundSuccess.play().catch(e => console.log('Audio playback prevented by browser'));
}

// Show green action toast
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.style.background = isError ? '#ef4444' : '#00ff66';
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2200);
}

// ----------------------------------------------------
// 🌟 Socket.io Receivers
// ----------------------------------------------------

// Server connection initialized
socket.on('admin_init', (initData) => {
  console.log('Admin initialized:', initData);
  const state = initData.state;
  
  // Update admin count
  txtAdmins.textContent = `Admins Online: ${initData.connectedAdmins}`;
  
  // Update state values
  localDucks = state.ducks || [];
  localRigged = state.riggedWinners || { first: null, second: null, third: null };
  localStatus = state.status || 'idle';
  localBanners = state.banners || {};
  
  // Sync Settings Inputs
  inputCountdown.value = state.countdownDuration || 5;
  inputDuration.value = state.raceDuration || 15;
  
  // Sync Banners Editor UI
  syncBannerEditorUI();

  // Draw UI Components
  updateStatusUI(localStatus);
  renderRoster();
  updateRiggedPreviewBar();
  renderHistory(state.history || []);
});

// Telemetry Stats Syncing (online counts)
socket.on('online_stats', (stats) => {
  txtAdmins.textContent = `Admins Online: ${stats.adminsOnline}`;
  txtGames.textContent = `Game Screens: ${stats.gamesOnline}`;
});

// Sync status transitions from server
socket.on('admin_sync_status', (statusInfo) => {
  localStatus = statusInfo.status;
  updateStatusUI(localStatus);
  
  // If race completed, show notification
  if (localStatus === 'finished') {
    showToast('🏆 Race completed! History log saved.');
  }
});

function updateStatusUI(status) {
  statusBadge.textContent = status.toUpperCase();
  statusBadge.className = 'monitor-val'; // reset
  
  if (status === 'idle') {
    statusBadge.classList.add('idle-status');
    statusBadge.style.color = '#00f0ff';
    statusBadge.style.borderColor = 'rgba(0, 240, 255, 0.2)';
    statusBadge.style.backgroundColor = 'rgba(0, 240, 255, 0.05)';
  } else if (status === 'counting_down') {
    statusBadge.style.color = '#ffcc00';
    statusBadge.style.borderColor = 'rgba(255, 204, 0, 0.2)';
    statusBadge.style.backgroundColor = 'rgba(255, 204, 0, 0.05)';
  } else if (status === 'racing') {
    statusBadge.style.color = '#39ff14';
    statusBadge.style.borderColor = 'rgba(57, 255, 20, 0.2)';
    statusBadge.style.backgroundColor = 'rgba(57, 255, 20, 0.05)';
  } else if (status === 'finished') {
    statusBadge.style.color = '#ff007f';
    statusBadge.style.borderColor = 'rgba(255, 0, 127, 0.2)';
    statusBadge.style.backgroundColor = 'rgba(255, 0, 127, 0.05)';
  }
}

// Live syncing of the typed/numbered roster *before* starting the race!
socket.on('admin_sync_roster', (syncData) => {
  console.log('Roster synced pre-race:', syncData);
  localDucks = syncData.ducks;
  localRigged = syncData.riggedWinners;
  
  renderRoster();
  updateRiggedPreviewBar();
});

// Sync rigging updates (from other admin sessions)
socket.on('sync_rigging', (newRigged) => {
  localRigged = newRigged;
  updateRiggedPreviewBar();
  updateRosterRiggingButtons();
});

// Sync history list from server
socket.on('admin_sync_history', (historyList) => {
  renderHistory(historyList);
});

// ----------------------------------------------------
// 🏁 Remote Command Actions
// ----------------------------------------------------

function remoteStart() {
  socket.emit('admin_trigger_start');
  showToast('🏁 Race started successfully!');
  playSuccessSound();
}

function remoteReset() {
  socket.emit('admin_trigger_reset');
  showToast('🔄 Race reset successfully');
  playSuccessSound();
}

function saveSettings() {
  const cd = parseInt(inputCountdown.value) || 5;
  const dur = parseInt(inputDuration.value) || 15;
  
  socket.emit('admin_update_settings', {
    countdownDuration: cd,
    raceDuration: dur
  });
  
  showToast('💾 Settings saved successfully!');
  playSuccessSound();
}

// ----------------------------------------------------
// 📢 DYNAMIC BANNER MANAGER CONTROL FUNCTIONS
// ----------------------------------------------------

socket.on('sync_banners', (newBanners) => {
  localBanners = newBanners;
  syncBannerEditorUI();
});

function syncBannerEditorUI() {
  if (!bannerSlotSelect) return;
  
  const slot = bannerSlotSelect.value;
  const config = localBanners[slot] || { show: false, type: 'text', content: '', link: '', btnText: '' };
  
  // Update visibility checkbox
  document.getElementById('banner-show').checked = !!config.show;
  
  // Update type radio
  const typeRadios = document.getElementsByName('banner-type');
  for (let radio of typeRadios) {
    radio.checked = (radio.value === config.type);
  }
  
  // Update content and link
  document.getElementById('banner-content').value = config.content || '';
  document.getElementById('banner-link').value = config.link || '';
  document.getElementById('banner-btn-text').value = config.btnText || '';
  
  // Toggle input visual helper labels
  updateBannerFormVisibility();
}

function updateBannerFormVisibility() {
  if (!bannerSlotSelect) return;
  const slot = bannerSlotSelect.value;
  const typeEl = document.querySelector('input[name="banner-type"]:checked');
  const selectedType = typeEl ? typeEl.value : 'text';
  
  // Change label and placeholder of content text area
  const contentLabel = document.getElementById('banner-content-label');
  const contentInput = document.getElementById('banner-content');
  if (contentLabel && contentInput) {
    if (selectedType === 'image') {
      contentLabel.textContent = '🖼️ Banner Image URL';
      contentInput.placeholder = 'Enter image filename or url (e.g. tikflow_banner.png or https://...)';
    } else {
      contentLabel.textContent = '📝 Banner Text / HTML Content';
      contentInput.placeholder = 'Enter scrolling ad text or html code...';
    }
  }
  
  // Show button text option only for left/right sidebars
  if (bannerBtnTextGroup) {
    if (slot === 'left' || slot === 'right') {
      bannerBtnTextGroup.style.display = 'block';
    } else {
      bannerBtnTextGroup.style.display = 'none';
    }
  }
}

function onBannerSlotChange() {
  syncBannerEditorUI();
}

function onBannerTypeChange() {
  updateBannerFormVisibility();
}

function saveBannerConfig() {
  if (!bannerSlotSelect) return;
  const slot = bannerSlotSelect.value;
  const show = document.getElementById('banner-show').checked;
  const typeEl = document.querySelector('input[name="banner-type"]:checked');
  const type = typeEl ? typeEl.value : 'text';
  const content = document.getElementById('banner-content').value.trim();
  const link = document.getElementById('banner-link').value.trim();
  const btnText = document.getElementById('banner-btn-text').value.trim();
  
  // Emit banner update event to server
  socket.emit('admin_update_banners', {
    slot,
    show,
    type,
    content,
    link,
    btnText
  });
  
  showToast(`📢 Updated banner config for slot [${slot}]!`);
  playSuccessSound();
}

// ----------------------------------------------------
// 🕵️ Rigging Core Engine Mechanics
// ----------------------------------------------------

function renderRoster() {
  const searchVal = duckSearch.value.toLowerCase().trim();
  
  // Filter active list based on search term
  const filtered = localDucks.filter(d => {
    return d.name.toLowerCase().includes(searchVal) || d.id.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    duckRosterList.innerHTML = `<div class="empty-state">${searchVal ? '❌ No ducks found matching search' : '🦆 No ducks in roster'}</div>`;
    return;
  }

  duckRosterList.innerHTML = '';
  
  filtered.forEach(d => {
    const row = document.createElement('div');
    row.className = 'duck-row';
    row.id = `duck-row-${d.id}`;
    
    // Status color
    const color = d.color || '#ffcc00';
    
    // Check current rigged status
    const is1st = localRigged.first === d.id;
    const is2nd = localRigged.second === d.id;
    const is3rd = localRigged.third === d.id;

    // Render 10 custom style options dynamically
    let styleOptions = '';
    DUCK_STYLES.forEach((style, idx) => {
      const selected = (d.styleIndex === idx) ? 'selected' : '';
      styleOptions += `<option value="${idx}" ${selected}>${style.name}</option>`;
    });

    row.innerHTML = `
      <div class="duck-info">
        <div class="duck-color-dot" id="dot-color-${d.id}" style="background-color: ${color}"></div>
        <div class="duck-text-details">
          <span class="duck-name">${d.name}</span>
          <select class="duck-style-select" onchange="changeDuckStyle('${d.id}', this.value)">
            ${styleOptions}
          </select>
        </div>
      </div>
      <div class="rigging-actions">
        <button class="rig-action-btn ${is1st ? 'active-1st' : ''}" id="rig-1st-${d.id}" onclick="toggleRig('${d.id}', 1)">🥇 1st</button>
        <button class="rig-action-btn ${is2nd ? 'active-2nd' : ''}" id="rig-2nd-${d.id}" onclick="toggleRig('${d.id}', 2)">🥈 2nd</button>
        <button class="rig-action-btn ${is3rd ? 'active-3rd' : ''}" id="rig-3rd-${d.id}" onclick="toggleRig('${d.id}', 3)">🥉 3rd</button>
      </div>
    `;
    duckRosterList.appendChild(row);
  });
}

function changeDuckStyle(duckId, styleIndex) {
  const idx = parseInt(styleIndex);
  const style = DUCK_STYLES[idx];
  
  // Update duck in local memory
  const duck = localDucks.find(d => d.id === duckId);
  if (duck) {
    duck.styleIndex = idx;
    duck.color = style.color;
    
    // Dynamically update color dot locally for instant visual feedback
    const dot = document.getElementById(`dot-color-${duckId}`);
    if (dot) dot.style.backgroundColor = style.color;
    
    // Sync updated roster to server so everyone receives the new colors/styles
    socket.emit('client_roster_update', localDucks.map(d => ({
      id: d.id,
      name: d.name,
      color: d.color,
      styleIndex: d.styleIndex
    })));
    
    showToast(`🎨 Changed style of ${duck.name} to ${style.name}`);
    playSuccessSound();
  }
}

function filterRoster() {
  renderRoster();
}

function toggleRig(duckId, rank) {
  // Toggle placement logic
  if (rank === 1) {
    if (localRigged.first === duckId) {
      localRigged.first = null; // deselect
    } else {
      // Clear from other ranks first to prevent double-placements
      if (localRigged.second === duckId) localRigged.second = null;
      if (localRigged.third === duckId) localRigged.third = null;
      localRigged.first = duckId;
    }
  } else if (rank === 2) {
    if (localRigged.second === duckId) {
      localRigged.second = null;
    } else {
      if (localRigged.first === duckId) localRigged.first = null;
      if (localRigged.third === duckId) localRigged.third = null;
      localRigged.second = duckId;
    }
  } else if (rank === 3) {
    if (localRigged.third === duckId) {
      localRigged.third = null;
    } else {
      if (localRigged.first === duckId) localRigged.first = null;
      if (localRigged.second === duckId) localRigged.second = null;
      localRigged.third = duckId;
    }
  }

  // Submit rigging changes to server
  socket.emit('admin_rig_winners', localRigged);

  // Play indicator
  playSuccessSound();
  showToast('🕵️ Secret rigging updated!');
  
  // Render updates
  updateRiggedPreviewBar();
  updateRosterRiggingButtons();
}

function clearAllRigging() {
  localRigged = { first: null, second: null, third: null };
  socket.emit('admin_rig_winners', localRigged);
  
  playSuccessSound();
  showToast('❌ Cleared all rigged positions');
  
  updateRiggedPreviewBar();
  updateRosterRiggingButtons();
}

function updateRiggedPreviewBar() {
  const fDuck = localDucks.find(d => d.id === localRigged.first);
  const sDuck = localDucks.find(d => d.id === localRigged.second);
  const tDuck = localDucks.find(d => d.id === localRigged.third);

  document.getElementById('preview-1st-name').textContent = fDuck ? fDuck.name : 'Not Rigged (Random)';
  document.getElementById('preview-2nd-name').textContent = sDuck ? sDuck.name : 'Not Rigged (Random)';
  document.getElementById('preview-3rd-name').textContent = tDuck ? tDuck.name : 'Not Rigged (Random)';
}

function updateRosterRiggingButtons() {
  // Loop through ducks in memory and update button active classes
  localDucks.forEach(d => {
    const btn1 = document.getElementById(`rig-1st-${d.id}`);
    const btn2 = document.getElementById(`rig-2nd-${d.id}`);
    const btn3 = document.getElementById(`rig-3rd-${d.id}`);
    
    if (btn1) btn1.className = `rig-action-btn ${localRigged.first === d.id ? 'active-1st' : ''}`;
    if (btn2) btn2.className = `rig-action-btn ${localRigged.second === d.id ? 'active-2nd' : ''}`;
    if (btn3) btn3.className = `rig-action-btn ${localRigged.third === d.id ? 'active-3rd' : ''}`;
  });
}

// ----------------------------------------------------
// 📜 History Rendering logs
// ----------------------------------------------------

function renderHistory(history) {
  if (history.length === 0) {
    historyLogList.innerHTML = `<div class="empty-state">No history recorded yet</div>`;
    return;
  }

  historyLogList.innerHTML = '';
  
  history.forEach((round, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // Calculate round numbering
    const roundNum = history.length - index;

    item.innerHTML = `
      <div class="hist-top">
        <span>Round #${roundNum} (${round.duckCount} ducks)</span>
        <span>⏱️ ${round.timestamp}</span>
      </div>
      <div class="hist-winners">
        <span class="hist-winner-tag ht-1st">🥇 ${round.winners.first}</span>
        <span class="hist-winner-tag ht-2nd">🥈 ${round.winners.second}</span>
        <span class="hist-winner-tag ht-3rd">🥉 ${round.winners.third}</span>
      </div>
    `;
    historyLogList.appendChild(item);
  });
}
