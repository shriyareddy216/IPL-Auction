require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const authRoutes = require('./routes/auth');
const seedPlayers = require('./seed');
const User = require('./models/User');
const Player = require('./models/Player');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

const io = socketIo(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// --- MULTI-ROOM STATE MAP ---
const activeRooms = new Map();

// Helper to shuffle the immutable MongoDB array natively per room
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

// Spawn a freshly isolated Memory Room for a Lobby
const initializeRoom = async (roomId, hostUserId) => {
  // Fetch pristine immutable player catalog from Database
  let catalog = await Player.find({}).lean();
  catalog = shuffleArray(catalog);

  const newRoom = {
    roomId,
    hostId: hostUserId,
    isPaused: true,
    playerQueue: catalog, 
    activePlayer: null,
    highestBid: 0,
    leadingTeam: null,
    timer: 10,
    intervalId: null,
    logs: [{ id: Date.now(), text: `🏟️ Room ${roomId} Instantiated Successfully` }],
    chat: []
  };

  activeRooms.set(roomId, newRoom);
  return newRoom;
};

// Strips out backend functions to a clean frontend readable packet
const getEmitState = async (room) => {
  if (!room) return null;
  const teams = await User.find({ roomId: room.roomId });
  return {
    isPaused: room.isPaused,
    activePlayer: room.activePlayer,
    upcomingPlayers: room.playerQueue.slice(0, 20),
    highestBid: room.highestBid,
    leadingTeam: room.leadingTeam,
    timer: room.timer,
    logs: room.logs,
    chat: room.chat,
    teams
  };
};

const internalAddLog = (room, text) => {
  room.logs.unshift({ id: Date.now(), text });
  if (room.logs.length > 50) room.logs.pop();
  io.to(room.roomId).emit('auctionLog', room.logs);
};

// --- CORE ASYNC GAME TICK LOGIC (ISOLATED BY ROOM) ---
const startNextAuction = async (roomId) => {
  const room = activeRooms.get(roomId);
  if (!room || room.isPaused) return;

  if (room.playerQueue.length === 0) {
    internalAddLog(room, `🏆 AUCTION OVER! All players have been drawn!`);
    io.to(roomId).emit('auctionComplete', { message: 'The Action has officially ended!' });
    return;
  }

  // Dequeue the next player locally
  const nextPlayer = room.playerQueue.shift();

  if (room.intervalId) clearInterval(room.intervalId);

  room.activePlayer = nextPlayer;
  room.highestBid = nextPlayer.basePrice;
  room.leadingTeam = null;
  room.timer = 10;
  
  // Attach isolated isolated interval TICK to memory room
  room.intervalId = setInterval(() => auctionTick(roomId), 1000);
  
  internalAddLog(room, `New Player Up: ${nextPlayer.name} (Base Price: ${nextPlayer.basePrice / 10000000} Cr)`);
  io.to(roomId).emit('auctionStateUpdate', await getEmitState(room));
};

const auctionTick = async (roomId) => {
  const room = activeRooms.get(roomId);
  if (!room || room.isPaused) return;

  if (room.timer > 0) {
    room.timer -= 1;
    io.to(roomId).emit('timerUpdate', { timer: room.timer });
  } else {
    // Timer expired
    console.log(`[Timer 0] Room ${roomId} processing sale for ${room.activePlayer?.name}`);
    
    // Explicitly sync all clients to 0 before processing
    io.to(roomId).emit('timerUpdate', { timer: 0 });
    
    clearInterval(room.intervalId);
    room.intervalId = null;
    await processSoldPlayer(roomId);
  }
};

const processSoldPlayer = async (roomId) => {
  const room = activeRooms.get(roomId);
  if (!room || !room.activePlayer) return;

  try {
    console.log(`[Sale Info] Starting processSoldPlayer for Room ${roomId}. Player: ${room.activePlayer.name}`);
    if (room.leadingTeam) {
      const winner = await User.findById(room.leadingTeam._id);
      if (winner) {
        winner.budget -= room.highestBid;
        winner.playersBought.push(room.activePlayer._id);
        if (room.activePlayer.isOverseas) winner.overseasCount += 1;
        await winner.save();
        io.to(roomId).emit('budgetUpdate', { teamId: winner._id, newBudget: winner.budget });
      }
      internalAddLog(room, `🔨 SOLD! ${room.activePlayer.name} goes to ${room.leadingTeam.teamName} for ₹ ${(room.highestBid / 10000000).toFixed(2)} Cr!`);
    } else {
      internalAddLog(room, `❌ UNSOLD: ${room.activePlayer.name} found no takers.`);
    }

    let safeSoldTo = null;
    if (room.leadingTeam) {
      safeSoldTo = {
        _id: room.leadingTeam._id,
        teamName: room.leadingTeam.teamName
      };
    }

    console.log(`[Event Sent] Emitting playerSold to room ${roomId}`);
    io.to(roomId).emit('playerSold', { 
      player: room.activePlayer, 
      soldTo: safeSoldTo, 
      price: room.highestBid 
    });

    // --- AUTO-ADVANCE LOGIC ---
    // 1. Clear current round state immediately so new joiners don't see old player
    room.activePlayer = null;
    room.leadingTeam = null;
    room.highestBid = 0;

    // 2. Trigger Next Player automatically after 5 seconds
    setTimeout(async () => {
      console.log(`[Auto-Advance] Triggering next player for Room ${roomId}`);
      const freshRoom = activeRooms.get(roomId);
      // Only advance if host hasn't manually skipped and and room isn't paused
      if (freshRoom && !freshRoom.activePlayer && !freshRoom.isPaused) { 
         await startNextAuction(roomId);
      }
    }, 5000);

  } catch (error) {
    console.error("Sold Player Processor Error:", error);
    io.to(roomId).emit('error', { message: 'Database failed to save the sale perfectly. The backend recovered.' });
  }
};

// --- WEB SOCKET COMMANDS (ISOLATED) ---
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('joinRoom', async ({ roomId, userId }) => {
    socket.join(roomId);
    
    // Check if lobby is physically active in our RAM Array, if not generate it!
    if (!activeRooms.has(roomId)) {
       await initializeRoom(roomId, userId);
    }
    
    const room = activeRooms.get(roomId);
    const user = await User.findById(userId);
    internalAddLog(room, `🛬 ${user ? user.teamName : 'A user'} has joined the lobby!`);
    
    // Inject the current state to newly joined clients securely seamlessly
    const emitState = await getEmitState(room);
    socket.emit('auctionStateUpdate', emitState);
  });

  socket.on('startAuction', async ({ roomId, userId }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    
    // Strictly Host Verification natively
    const requestUser = await User.findById(userId);
    if (!requestUser || !requestUser.isHost) return;

    room.isPaused = false;
    internalAddLog(room, `▶ The Host (${requestUser.teamName}) has officially STARTED the Auction!`);

    if (!room.activePlayer) {
      await startNextAuction(roomId);
    } else {
      // It was paused mid-player. Resume interval identically.
      if (room.intervalId) clearInterval(room.intervalId);
      room.intervalId = setInterval(() => auctionTick(roomId), 1000);
      io.to(roomId).emit('auctionStateUpdate', await getEmitState(room));
    }
  });

  socket.on('togglePause', async ({ roomId, userId }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    
    const requestUser = await User.findById(userId);
    if (!requestUser || !requestUser.isHost) return;

    room.isPaused = !room.isPaused;
    internalAddLog(room, room.isPaused ? `⏸ Host Paused the Room` : `▶ Host Resumed the Room`);
    
    if (!room.isPaused && !room.activePlayer) {
      await startNextAuction(roomId);
    } else if (!room.isPaused && room.activePlayer && !room.intervalId) {
      room.intervalId = setInterval(() => auctionTick(roomId), 1000);
    } else if (room.isPaused && room.intervalId) {
      clearInterval(room.intervalId);
      room.intervalId = null;
    }
    io.to(roomId).emit('auctionStateUpdate', await getEmitState(room));
  });

  socket.on('nextPlayer', async ({ roomId, userId }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    
    const requestUser = await User.findById(userId);
    if (!requestUser || !requestUser.isHost) return;

    if (room.activePlayer) {
      internalAddLog(room, `⏭ The Host Skipped Player: ${room.activePlayer.name}`);
    }
    await startNextAuction(roomId);
  });

  socket.on('placeBid', async ({ roomId, userId, bidAmount }) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.activePlayer || room.isPaused || room.timer === 0) return;

    if (bidAmount > room.highestBid || (!room.leadingTeam && bidAmount === room.highestBid)) {
      const user = await User.findById(userId);
      
      if (!user) {
        return socket.emit('error', { message: 'Invalid User Token. Please Re-login.' });
      }

      // --- SQUAD RULES EXPERTISE (Rule 20) ---
      if (user.playersBought.length >= 25) {
        return socket.emit('error', { message: '⚠ SQUAD FULL: You cannot exceed 25 players natively!' });
      }
      if (room.activePlayer.isOverseas && user.overseasCount >= 8) {
        return socket.emit('error', { message: '⚠ OVERSEAS LIMIT REACHED: You cannot exceed 8 Overseas Players!' });
      }
      if (user.budget < bidAmount) {
        return socket.emit('error', { message: '⚠ WALLET EXHAUSTED: You do not have enough Cr to execute this bid!' });
      }

      // Valid Bid execution
      room.highestBid = bidAmount;
      room.leadingTeam = user;
      room.timer = 10; // Rule 8: If New Bid -> Timer 10
      
      internalAddLog(room, `💰 ${user.teamName} bravely bid ₹ ${(bidAmount / 10000000).toFixed(2)} Cr!`);
      
      io.to(roomId).emit('auctionStateUpdate', await getEmitState(room));
      io.to(roomId).emit('bidRegistered'); 
    } else {
      socket.emit('error', { message: 'Bid mathematical condition failed securely.' });
    }
  });

  socket.on('chatMessage', async ({ roomId, userId, message }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    
    const user = await User.findById(userId);
    if (user && message.trim().length > 0) {
      const chatObject = {
        id: Date.now(),
        sender: user.teamName,
        text: message
      };
      room.chat.push(chatObject);
      if (room.chat.length > 150) room.chat.shift();
      io.to(roomId).emit('chatUpdate', room.chat);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User physically disconnected: ${socket.id}`);
  });
});

let mongoServer;
const PORT = process.env.PORT || 5001;

const bootEngine = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  await mongoose.connect(uri);
  console.log('Connected natively to MongoDB Engine Realm.');

  console.log('Populating the CSV Catalog ...');
  await seedPlayers();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Multi-Room Engine deployed and securely listening against Port ${PORT}`);
  });
};

bootEngine();
