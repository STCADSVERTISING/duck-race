import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// We will keep a dictionary of room states loaded/saved on demand
const rooms = {};

// Default initial state template for any new room
function createInitialState() {
  return {
    ducks: [],
    status: 'idle', // idle, counting_down, racing, finished
    countdownDuration: 5,
    raceDuration: 15,
    riggedWinners: {
      first: null,
      second: null,
      third: null
    },
    // Upgraded structured banners configuration
    banners: {
      top: { show: true, type: 'text', content: '⚡ ปั้นเพจออโต้ & ปักตะกร้าติ๊กตอกออโต้ เริ่มต้นเพียง 10 บาท! ⚡ ระบบอัตโนมัติ 24 ชม. ดันยอดวิว ดันผู้ติดตาม เพิ่มการเข้าถึง มั่นใจได้ 100% ที่ TikFlow24.com', link: 'https://tikflow24.com' },
      left: { show: true, type: 'text', content: 'TIKFLOW24.COM 🤖\n\nหมดปัญหาปั้นช่องแล้วไม่ปัง! ระบบปั้นเพจ TikTok อัตโนมัติ ปักตะกร้าง่าย ๆ เริ่มต้นเพียง 10 บาท ดันยอดผู้ติดตาม & ดันยอดวิวครบวงจรในเว็บเดียว!', link: 'https://tikflow24.com', btnText: 'เริ่มปั้นช่อง' },
      right: { show: true, type: 'text', content: 'ปักตะกร้าติ๊กตอกออโต้ 🛒\n\nระบบปักตะกร้า TikTok Auto ดันยอดขายพุ่งแรงแบบไม่ต้องนั่งเฝ้า เริ่มต้นเพียง 10 บาท สมัครใช้งานเพื่อเพิ่มรายได้นายหน้าของคุณวันนี้!', link: 'https://tikflow24.com', btnText: 'เริ่มปักตะกร้า' },
      bottom: { show: true, type: 'image', content: 'tikflow_banner.png', link: 'https://tikflow24.com' }
    },
    history: []
  };
}

// Load state for a specific room ID
function getRoomState(roomId) {
  if (rooms[roomId]) {
    return rooms[roomId];
  }

  const cleanRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
  const stateFilePath = path.join(__dirname, `race_state_${cleanRoomId}.json`);
  let roomState = createInitialState();

  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf-8');
      const loaded = JSON.parse(data);
      roomState = { ...roomState, ...loaded };
      console.log(`Room state successfully loaded for [${cleanRoomId}]`);
    } else {
      // Write initial state immediately
      fs.writeFileSync(stateFilePath, JSON.stringify(roomState, null, 2), 'utf-8');
      console.log(`Created new initial state file for room [${cleanRoomId}]`);
    }
  } catch (err) {
    console.error(`Error loading state for room [${cleanRoomId}]:`, err);
  }

  rooms[roomId] = roomState;
  return roomState;
}

// Save state for a specific room ID
function saveRoomState(roomId) {
  const roomState = rooms[roomId];
  if (!roomState) return;

  const cleanRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
  const stateFilePath = path.join(__dirname, `race_state_${cleanRoomId}.json`);

  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(roomState, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving state for room [${cleanRoomId}]:`, err);
  }
}

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Admin routes serve public/admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Track room-specific active connections
const roomConnections = {};

function getRoomConnections(roomId) {
  if (!roomConnections[roomId]) {
    roomConnections[roomId] = { game: 0, admin: 0 };
  }
  return roomConnections[roomId];
}

// Socket.io Real-time logic
io.on('connection', (socket) => {
  let socketRoomId = null;
  let socketRole = null;

  console.log(`New socket connected: ${socket.id}`);

  // Broadcast stats to all admins in the specific room
  const sendRoomAdminStats = (roomId) => {
    const conn = getRoomConnections(roomId);
    io.to(roomId).emit('online_stats', {
      adminsOnline: conn.admin,
      gamesOnline: conn.game
    });
  };

  // Identify client role and room ID
  socket.on('identify', (data) => {
    // Gracefully handle string-only identification (legacy fallback) or structured object
    let role = typeof data === 'string' ? data : data.role;
    let roomId = (data && data.roomId) ? String(data.roomId) : 'default';

    socketRoomId = roomId;
    socketRole = role;

    socket.join(roomId);
    const state = getRoomState(roomId);
    const conn = getRoomConnections(roomId);

    if (role === 'admin') {
      conn.admin++;
      console.log(`Admin connected to Room [${roomId}]. Total admins: ${conn.admin}`);
      
      // Send current room state to the newly connected admin
      socket.emit('admin_init', {
        state,
        connectedAdmins: conn.admin
      });
    } else if (role === 'game') {
      conn.game++;
      console.log(`Game screen connected to Room [${roomId}]. Total games: ${conn.game}`);
      
      // Send initial room settings/rigging/banners to game screen
      socket.emit('game_init', state);
    }

    sendRoomAdminStats(roomId);
  });

  // 1. Pre-race Roster Update from game client
  socket.on('client_roster_update', (newDucks) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    state.ducks = newDucks;
    
    // Keep rigged winners validated
    const duckIds = new Set(newDucks.map(d => d.id));
    if (state.riggedWinners.first && !duckIds.has(state.riggedWinners.first)) state.riggedWinners.first = null;
    if (state.riggedWinners.second && !duckIds.has(state.riggedWinners.second)) state.riggedWinners.second = null;
    if (state.riggedWinners.third && !duckIds.has(state.riggedWinners.third)) state.riggedWinners.third = null;
    
    saveRoomState(socketRoomId);
    
    // Broadcast roster & rigging update to all admins in the room
    io.to(socketRoomId).emit('admin_sync_roster', {
      ducks: state.ducks,
      riggedWinners: state.riggedWinners
    });
    
    // Also broadcast to game screens!
    io.to(socketRoomId).emit('game_sync_roster', state.ducks);
  });

  // 2. Race Status Update from game client
  socket.on('client_status_update', (statusInfo) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    state.status = statusInfo.status;
    saveRoomState(socketRoomId);
    
    // Broadcast status to admins in the room
    io.to(socketRoomId).emit('admin_sync_status', statusInfo);
  });

  // 3. Admin: Rig Winners Selection
  socket.on('admin_rig_winners', (rigInfo) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    state.riggedWinners = {
      first: rigInfo.first || null,
      second: rigInfo.second || null,
      third: rigInfo.third || null
    };
    saveRoomState(socketRoomId);
    
    // Send updated rigging settings to game screens and admins in the room
    io.to(socketRoomId).emit('sync_rigging', state.riggedWinners);
    console.log(`[Room ${socketRoomId}] Rigging updated:`, state.riggedWinners);
  });

  // 4. Admin: Start Race Remote Trigger
  socket.on('admin_trigger_start', () => {
    if (!socketRoomId) return;
    console.log(`[Room ${socketRoomId}] Admin triggered START`);
    io.to(socketRoomId).emit('game_start_race');
  });

  // 5. Admin: Reset Race Remote Trigger
  socket.on('admin_trigger_reset', () => {
    if (!socketRoomId) return;
    console.log(`[Room ${socketRoomId}] Admin triggered RESET`);
    io.to(socketRoomId).emit('game_reset_race');
  });

  // 6. Admin: Update Dynamic Banners Configuration
  socket.on('admin_update_banners', (bannerInfo) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    
    // Merge target slot settings
    const slot = bannerInfo.slot; // 'top', 'left', 'right', 'bottom'
    if (state.banners[slot]) {
      state.banners[slot] = {
        show: bannerInfo.show,
        type: bannerInfo.type,
        content: bannerInfo.content || '',
        link: bannerInfo.link || '',
        btnText: bannerInfo.btnText || state.banners[slot].btnText || ''
      };
      saveRoomState(socketRoomId);
      io.to(socketRoomId).emit('sync_banners', state.banners);
      console.log(`[Room ${socketRoomId}] Banner updated for slot [${slot}]:`, state.banners[slot]);
    }
  });

  // 7. Admin: Update General Settings (Duration, etc.)
  socket.on('admin_update_settings', (settingsInfo) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    state.countdownDuration = settingsInfo.countdownDuration || 5;
    state.raceDuration = settingsInfo.raceDuration || 15;
    saveRoomState(socketRoomId);
    
    io.to(socketRoomId).emit('sync_settings', {
      countdownDuration: state.countdownDuration,
      raceDuration: state.raceDuration
    });
    console.log(`[Room ${socketRoomId}] Settings updated:`, settingsInfo);
  });

  // 8. Game client finished race and submits final official round results
  socket.on('client_race_finished', (resultData) => {
    if (!socketRoomId) return;
    const state = getRoomState(socketRoomId);
    const newRound = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      duckCount: resultData.duckCount,
      winners: {
        first: resultData.winners.first,
        second: resultData.winners.second,
        third: resultData.winners.third
      }
    };
    
    state.history.unshift(newRound); // add to top of history
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50); // limit to last 50 races
    }
    
    // Reset rigging for the next round automatically so it doesn't look suspicious!
    state.riggedWinners = { first: null, second: null, third: null };
    state.status = 'finished';
    saveRoomState(socketRoomId);

    // Broadcast to the room
    io.to(socketRoomId).emit('sync_rigging', state.riggedWinners);
    io.to(socketRoomId).emit('admin_sync_history', state.history);
    io.to(socketRoomId).emit('admin_sync_status', { status: 'finished' });
    console.log(`[Room ${socketRoomId}] Race finished. History logged:`, newRound);
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (socketRoomId && socketRole) {
      const conn = getRoomConnections(socketRoomId);
      if (socketRole === 'admin') {
        conn.admin = Math.max(0, conn.admin - 1);
        console.log(`Admin disconnected from Room [${socketRoomId}]. Remaining: ${conn.admin}`);
      } else if (socketRole === 'game') {
        conn.game = Math.max(0, conn.game - 1);
        console.log(`Game disconnected from Room [${socketRoomId}]. Remaining: ${conn.game}`);
      }
      sendRoomAdminStats(socketRoomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`🦆 Duck Race Game & Admin server running on port ${PORT}`);
  console.log(`👉 Game Client: http://localhost:${PORT}`);
  console.log(`👉 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`===========================================================`);
});

