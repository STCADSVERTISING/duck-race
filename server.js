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

const STATE_FILE_PATH = path.join(__dirname, 'race_state.json');

// Default initial state
let state = {
  ducks: [],
  status: 'idle', // idle, counting_down, racing, finished
  countdownDuration: 5,
  raceDuration: 15,
  riggedWinners: {
    first: null,  // ID or name of rigged 1st place
    second: null, // ID or name of rigged 2nd place
    third: null   // ID or name of rigged 3rd place
  },
  customAds: {
    left: '🔥 Quack-a-Lot Casino: Bet on your favorite duck! 100% Legit! 🔥',
    right: '💎 QuackCoin (QCK) to the Moon! Buy now and HODL! 💎'
  },
  history: []
};

// Load state from file if exists
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      const loaded = JSON.parse(data);
      state = { ...state, ...loaded };
      console.log('State successfully loaded from race_state.json');
    }
  } catch (err) {
    console.error('Error loading race state:', err);
  }
}

// Save state to file
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving race state:', err);
  }
}

loadState();

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Admin routes serve public/admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Socket.io Real-time logic
let connectedClients = {
  game: 0,
  admin: 0
};

io.on('connection', (socket) => {
  let role = null; // 'game' or 'admin'

  console.log(`New socket connected: ${socket.id}`);

  // Broadcast stats to all admins
  const sendAdminStats = () => {
    io.emit('online_stats', {
      adminsOnline: connectedClients.admin,
      gamesOnline: connectedClients.game
    });
  };

  // Identify client role
  socket.on('identify', (clientRole) => {
    role = clientRole;
    if (role === 'admin') {
      connectedClients.admin++;
      console.log(`Admin connected. Total admins: ${connectedClients.admin}`);
      
      // Immediately send current state & history to the newly connected admin
      socket.emit('admin_init', {
        state,
        connectedAdmins: connectedClients.admin
      });
    } else if (role === 'game') {
      connectedClients.game++;
      console.log(`Game screen connected. Total game screens: ${connectedClients.game}`);
      
      // Send initial settings/rigging to game screen
      socket.emit('game_init', state);
    }
    sendAdminStats();
  });

  // 1. Pre-race Roster Update from game client
  socket.on('client_roster_update', (newDucks) => {
    state.ducks = newDucks;
    // Keep rigged winners validated (if rigged duck is removed, clear its rigging)
    const duckIds = new Set(newDucks.map(d => d.id));
    if (state.riggedWinners.first && !duckIds.has(state.riggedWinners.first)) state.riggedWinners.first = null;
    if (state.riggedWinners.second && !duckIds.has(state.riggedWinners.second)) state.riggedWinners.second = null;
    if (state.riggedWinners.third && !duckIds.has(state.riggedWinners.third)) state.riggedWinners.third = null;
    
    saveState();
    
    // Broadcast roster & rigging update to all admins
    io.emit('admin_sync_roster', {
      ducks: state.ducks,
      riggedWinners: state.riggedWinners
    });
  });

  // 2. Race Status Update from game client
  socket.on('client_status_update', (statusInfo) => {
    state.status = statusInfo.status;
    saveState();
    // Broadcast status to admins
    io.emit('admin_sync_status', statusInfo);
  });

  // 3. Admin: Rig Winners Selection
  socket.on('admin_rig_winners', (rigInfo) => {
    state.riggedWinners = {
      first: rigInfo.first || null,
      second: rigInfo.second || null,
      third: rigInfo.third || null
    };
    saveState();
    
    // Send updated rigging settings to game screens and admins
    io.emit('sync_rigging', state.riggedWinners);
    console.log('Rigging updated:', state.riggedWinners);
  });

  // 4. Admin: Start Race Remote Trigger
  socket.on('admin_trigger_start', () => {
    console.log('Admin triggered START');
    io.emit('game_start_race');
  });

  // 5. Admin: Reset Race Remote Trigger
  socket.on('admin_trigger_reset', () => {
    console.log('Admin triggered RESET');
    io.emit('game_reset_race');
  });

  // 6. Admin: Update Ads Configuration
  socket.on('admin_update_ads', (adsInfo) => {
    state.customAds = {
      left: adsInfo.left || '',
      right: adsInfo.right || ''
    };
    saveState();
    io.emit('sync_ads', state.customAds);
    console.log('Ads updated:', state.customAds);
  });

  // 7. Admin: Update General Settings (Duration, etc.)
  socket.on('admin_update_settings', (settingsInfo) => {
    state.countdownDuration = settingsInfo.countdownDuration || 5;
    state.raceDuration = settingsInfo.raceDuration || 15;
    saveState();
    io.emit('sync_settings', {
      countdownDuration: state.countdownDuration,
      raceDuration: state.raceDuration
    });
    console.log('Settings updated:', settingsInfo);
  });

  // 8. Game client finished race and submits final official round results
  socket.on('client_race_finished', (resultData) => {
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
    saveState();

    // Broadcast to everyone
    io.emit('sync_rigging', state.riggedWinners);
    io.emit('admin_sync_history', state.history);
    io.emit('admin_sync_status', { status: 'finished' });
    console.log('Race finished. History logged:', newRound);
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (role === 'admin') {
      connectedClients.admin = Math.max(0, connectedClients.admin - 1);
      console.log(`Admin disconnected. Remaining admins: ${connectedClients.admin}`);
    } else if (role === 'game') {
      connectedClients.game = Math.max(0, connectedClients.game - 1);
      console.log(`Game screen disconnected. Remaining games: ${connectedClients.game}`);
    }
    sendAdminStats();
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
