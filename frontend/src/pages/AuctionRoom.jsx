import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io('http://localhost:5001');

const AuctionRoom = () => {
  const navigate = useNavigate();
  const { user, login, logout } = useContext(AuthContext);
  const [auctionState, setAuctionState] = useState(null);
  const [soldEvent, setSoldEvent] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Real-time Chat and Logs
  const [chatMessage, setChatMessage] = useState('');
  const [activeTab, setActiveTab] = useState('teams');

  // Audio References
  const hammerSound = useRef(null);
  const tickSound = useRef(null);
  const bidSound = useRef(null);

  // Auto-scroll refs
  const chatEndRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    hammerSound.current = new Audio('/audio/hammer.mp3');
    tickSound.current = new Audio('/audio/tick.mp3');
    bidSound.current = new Audio('/audio/bid.mp3');

    tickSound.current.volume = 0.5;
    bidSound.current.volume = 0.8;
  }, []);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (activeTab === 'logs' && logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [auctionState?.chat, auctionState?.logs, activeTab]);

  useEffect(() => {
    if (!user || !user.roomId) {
      navigate('/');
      return;
    }

    socket.emit('joinRoom', { roomId: user.roomId, userId: user._id });

    socket.on('auctionStateUpdate', (state) => {
      console.log('[Socket] auctionStateUpdate received', state);
      setAuctionState(state);
      if (state.activePlayer) {
        console.log('[UI] Clearing soldEvent because new player is active');
        setSoldEvent(null);
      }
    });

    socket.on('auctionLog', (logs) => {
      console.log('[Socket] auctionLog received');
      setAuctionState(prev => prev ? { ...prev, logs } : null);
    });

    socket.on('chatUpdate', (chat) => {
      console.log('[Socket] chatUpdate received');
      setAuctionState(prev => prev ? { ...prev, chat } : null);
    });

    socket.on('timerUpdate', ({ timer }) => {
      if (timer === 0) console.log('[Socket] timerUpdate 0 received');
      setAuctionState((prev) => (prev ? { ...prev, timer } : null));
      if (timer > 0 && timer <= 3) {
        tickSound.current?.play().catch(() => {});
      }
    });

    socket.on('playerSold', ({ player, soldTo, price }) => {
      console.log('[Socket] playerSold received', { player: player?.name, soldTo: soldTo?.teamName, price });
      setSoldEvent({
        isSold: soldTo !== null,
        player,
        soldTo,
        price
      });
      if (soldTo !== null) {
        hammerSound.current?.play().catch(() => {});
      }
    });

    socket.on('auctionComplete', (data) => {
      console.log('[Socket] auctionComplete received', data);
      setSoldEvent({ isComplete: true, message: data.message });
    });

    socket.on('budgetUpdate', (data) => {
      const currentUserStr = localStorage.getItem('user');
      if (currentUserStr) {
        let currentUser = JSON.parse(currentUserStr);
        if (currentUser._id === data.teamId) {
          currentUser.budget = data.newBudget;
          login(currentUser);
        }
      }
    });

    socket.on('error', ({ message }) => {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(''), 3000);
    });

    const bidHandler = () => { bidSound.current?.play().catch(() => {}); };
    socket.on('bidRegistered', bidHandler);

    return () => {
      socket.off('auctionStateUpdate');
      socket.off('timerUpdate');
      socket.off('playerSold');
      socket.off('auctionComplete');
      socket.off('budgetUpdate');
      socket.off('error');
      socket.off('auctionLog');
      socket.off('chatUpdate');
      socket.off('bidRegistered', bidHandler);
    };
  }, [user, navigate, login]);

  const handleBid = () => {
    if (!auctionState?.activePlayer) return;
    
    // Bid increment logic: +5L up to 1Cr, +10L up to 2Cr, +20L up to 5Cr, +50L after
    const current = auctionState.highestBid;
    let increment = 500000; // 5 Lakh
    if (current >= 10000000 && current < 20000000) increment = 1000000;
    else if (current >= 20000000 && current < 50000000) increment = 2000000;
    else if (current >= 50000000) increment = 5000000;
    
    const nextBid = current + increment;
    socket.emit('placeBid', { roomId: user.roomId, userId: user._id, bidAmount: nextBid });
  };

  const startAuction = () => socket.emit('startAuction', { roomId: user.roomId, userId: user._id });
  const togglePause = () => socket.emit('togglePause', { roomId: user.roomId, userId: user._id });
  const nextPlayer = () => socket.emit('nextPlayer', { roomId: user.roomId, userId: user._id });
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (chatMessage.trim() !== '') {
      socket.emit('chatMessage', { roomId: user.roomId, userId: user._id, message: chatMessage });
      setChatMessage('');
    }
  };

  // UI Components
  const formatMoney = (val) => `₹ ${(val / 10000000).toFixed(2)} Cr`;

  // Overlay Screens
  if (soldEvent) {
    if (soldEvent.isComplete) {
       return (
         <div className="flex flex-col items-center justify-center min-h-[50vh] glassmorphism p-12 rounded-3xl">
           <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 mb-6 drop-shadow-2xl">
              AUCTION CONCLUDED
           </h1>
           <p className="text-2xl text-slate-300">{soldEvent.message}</p>
           <button onClick={handleLogout} className="mt-8 px-8 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase tracking-wider text-white shadow-lg">Leave Lobby</button>
         </div>
       );
    }

    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto glassmorphism border-2 border-indigo-500/30 p-12 rounded-3xl relative overflow-hidden"
        >
          {soldEvent.isSold && (
            <motion.div 
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute -rotate-12 bg-red-600 text-white font-black text-6xl tracking-widest py-2 px-10 border-4 border-white shadow-2xl z-20"
              style={{ top: '20%', left: '10%' }}
            >
              SOLD!
            </motion.div>
          )}

          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-slate-700 shadow-2xl mb-8 relative z-10">
            <img src={soldEvent.player.image} alt="Player" className="w-full h-full object-cover" />
          </div>

          <h2 className="text-5xl font-black text-white mb-4 tracking-tight relative z-10">{soldEvent.player.name}</h2>
          
          <div className="flex gap-4 mb-8 relative z-10">
            <span className="px-4 py-1.5 bg-slate-800 rounded-lg text-slate-300 font-medium uppercase tracking-wider text-sm border border-slate-700">{soldEvent.player.role}</span>
            <span className="px-4 py-1.5 bg-slate-800 rounded-lg text-slate-300 font-medium uppercase tracking-wider text-sm border border-slate-700">{soldEvent.player.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'}</span>
          </div>

          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 w-full max-w-xl text-center relative z-10">
            {soldEvent.isSold ? (
              <>
                <p className="text-slate-400 font-medium text-lg mb-2">Acquired By</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-6">{soldEvent.soldTo.teamName}</p>
                <p className="text-slate-400 font-medium text-lg mb-1">Final Price</p>
                <p className="text-4xl font-black text-white">{formatMoney(soldEvent.price)}</p>
              </>
            ) : (
              <p className="text-3xl font-black text-red-500 uppercase tracking-widest py-8">Unsold</p>
            )}
            
            {user?.isHost && (
              <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-center">
                <button onClick={nextPlayer} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-indigo-600/30 transition-all">
                  ⏭ Spawn Next Player
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!auctionState || !auctionState.activePlayer) {
    return (
      <div className="flex flex-col items-center justify-center glassmorphism p-12 rounded-3xl">
        <div className="w-16 h-16 border-4 border-t-indigo-500 border-slate-700 rounded-full animate-spin mb-6"></div>
        <p className="text-xl font-medium text-slate-300 tracking-wider">Lobby: {user?.roomId}</p>
        <p className="text-slate-400 mt-2">Waiting for Host to Start the Room...</p>
        
        <button 
          onClick={handleLogout} 
          className="mt-8 px-8 py-3 bg-red-600/10 hover:bg-red-600/30 border border-red-500/30 text-red-500 rounded-xl transition-all font-bold tracking-widest uppercase text-sm shadow-xl"
        >
          Disconnect & Return to Home
        </button>
        
        {user?.isHost && (
          <div className="mt-8 pt-8 border-t border-slate-700/50 flex flex-col sm:flex-row gap-4">
            <button 
              onClick={startAuction}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20"
            >
              ▶ Start Room Sequence
            </button>
          </div>
        )}
      </div>
    );
  }

  const { activePlayer, upcomingPlayers = [], highestBid, leadingTeam, timer, isPaused, logs = [], chat = [], teams = [] } = auctionState;

  return (
    <div className="w-full max-w-[1700px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 relative px-4">
      
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-8 left-1/2 z-50 bg-red-600/95 text-white px-8 py-4 rounded-xl shadow-2xl border border-red-400 font-bold tracking-wider uppercase flex items-center gap-3 backdrop-blur-md"
          >
            <span className="text-2xl">⚠️</span> {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 right-4 lg:-top-16 flex items-center gap-2 px-4 py-2 bg-slate-900/80 rounded-full border border-slate-800 shadow-xl z-10">
        <span className="text-sm font-black text-indigo-400 mr-2 tracking-widest border-r border-slate-700 pr-3 uppercase">ROOM {user?.roomId}</span>
        <div className={`w-2 h-2 ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'} rounded-full`}></div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isPaused ? 'Lobby Paused' : 'Live Room'}</span>
      </div>

      {/* 1. Left Side: Teams Panel (Span 3) */}
      <div className="xl:col-span-3 flex flex-col gap-4 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar hidden lg:flex">
        <div className="sticky top-0 bg-[#0f172a] pb-2 z-10 font-bold text-slate-400 uppercase tracking-widest text-sm pl-2">
          Franchises ({teams.length})
        </div>
        {teams.map(t => {
          const isLeading = leadingTeam?._id === t._id;
          return (
            <motion.div 
              key={t._id} 
              animate={{ scale: isLeading ? 1.02 : 1 }}
              className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${isLeading ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-indigo-900/20' : 'border-slate-800 bg-slate-900/40'}`}
            >
              {isLeading && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-xs font-bold px-3 py-1 rounded-bl-lg text-white">HIGHEST</div>
              )}
              <h3 className="font-extrabold text-white text-lg mb-3 tracking-tight">{t.teamName}</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg">
                  <span className="text-xs text-slate-400 uppercase font-bold">Purse</span>
                  <span className="text-sm text-indigo-300 font-bold font-mono">{formatMoney(t.budget)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/50 p-2 rounded-lg flex flex-col items-center">
                     <span className="text-[10px] text-slate-500 uppercase font-bold">Squad</span>
                     <span className={`text-sm font-bold ${t.playersBought.length >= 25 ? 'text-red-400' : 'text-slate-300'}`}>{t.playersBought.length}/25</span>
                  </div>
                  <div className="bg-slate-950/50 p-2 rounded-lg flex flex-col items-center">
                     <span className="text-[10px] text-slate-500 uppercase font-bold">OS</span>
                     <span className={`text-sm font-bold ${t.overseasCount >= 8 ? 'text-red-400' : 'text-slate-300'}`}>{t.overseasCount}/8</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 2. Center: Player Card & Bidding (Span 6) */}
      <div className="xl:col-span-6 flex flex-col gap-6">
        <div className="glassmorphism rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 border border-slate-700/50 shadow-2xl relative">
          
          <div className="absolute top-4 right-4 bg-slate-900 border border-slate-700 px-4 py-1.5 rounded-full text-xs font-bold text-slate-400 tracking-wider">
            BASE: {formatMoney(activePlayer.basePrice)}
          </div>

          <div className="w-40 h-40 md:w-56 md:h-56 shrink-0 rounded-full overflow-hidden border-4 border-slate-700 shadow-2xl relative group">
            <div className="absolute inset-0 bg-indigo-500/20 group-hover:bg-transparent transition-all z-10 pointer-events-none"></div>
            <img src={activePlayer.image} alt={activePlayer.name} className="w-full h-full object-cover" />
          </div>
          
          <div className="flex-1 flex flex-col text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight drop-shadow-lg pr-8">
              {activePlayer.name}
            </h2>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-8">
              <span className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg font-bold text-xs uppercase tracking-wider">{activePlayer.role}</span>
              <span className="px-4 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg font-bold text-xs uppercase tracking-wider">{activePlayer.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'}</span>
            </div>
            
            <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-inner">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Current Bid</p>
              <div className="flex items-baseline justify-center md:justify-start gap-3">
                <span className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-mono tracking-tight">
                  {formatMoney(highestBid)}
                </span>
                {leadingTeam && (
                  <span className="text-sm font-bold text-slate-400 uppercase bg-slate-800 px-3 py-1 rounded-full">
                    by {leadingTeam.teamName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bidding Console */}
        <div className="glassmorphism rounded-3xl p-6 md:p-8 flex items-center justify-between border border-slate-700/50 relative overflow-hidden">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
                <motion.circle
                  cx="40" cy="40" r="36"
                  stroke="currentColor" strokeWidth="6" fill="transparent"
                  strokeDasharray={226}
                  strokeDashoffset={226 - (226 * timer) / 10}
                  className={timer <= 3 ? 'text-red-500 transition-colors' : 'text-indigo-500 transition-colors'}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black tabular-nums ${timer <= 3 ? 'text-red-500' : 'text-white'}`}>{timer}</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Time Remaining</p>
              <p className="text-xs text-slate-500 mt-1">Clock resets on valid bids</p>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBid}
            disabled={isPaused}
            className={`px-10 py-5 rounded-2xl font-black text-xl uppercase tracking-widest shadow-2xl transition-all ${
              isPaused 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30'
            }`}
          >
            Place Bid
          </motion.button>
        </div>

        {user?.isHost && (
          <div className="glassmorphism rounded-3xl p-4 flex flex-wrap items-center justify-center gap-4 border border-indigo-500/30 bg-indigo-900/10">
             <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest border-r border-indigo-500/30 pr-4">Host Controls</span>
             <button onClick={togglePause} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors">
               {isPaused ? '▶ Resume Room' : '⏸ Pause Room'}
             </button>
             <button onClick={nextPlayer} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors">
               ⏭ Force Next Player
             </button>
          </div>
        )}
      </div>

      {/* 3. Right Side: Social Panel (Span 3) */}
      <div className="xl:col-span-3 h-[750px] flex flex-col glassmorphism rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
        <div className="flex bg-slate-900 border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'logs' ? 'text-indigo-400 bg-slate-800/50 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Activity Logs
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'chat' ? 'text-indigo-400 bg-slate-800/50 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'upcoming' ? 'text-indigo-400 bg-slate-800/50 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Upcoming
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-900/20">
          <AnimatePresence mode="popLayout">
            {activeTab === 'logs' && logs.map((log) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                layout
                className="mb-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-sm text-slate-300"
              >
                {log.text}
              </motion.div>
            ))}
            {activeTab === 'logs' && <div ref={logEndRef} />}

            {activeTab === 'chat' && chat.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                layout
                className={`mb-4 flex flex-col ${msg.sender === user?.teamName ? 'items-end' : 'items-start'}`}
              >
                <div className={`px-4 py-2.5 max-w-[85%] rounded-2xl text-sm ${
                  msg.sender === user?.teamName 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'
                }`}>
                  <span className="text-[10px] font-bold text-indigo-300 uppercase opacity-70 mb-1 block">{msg.sender}</span>
                  {msg.text}
                </div>
              </motion.div>
            ))}
            {activeTab === 'chat' && <div ref={chatEndRef} />}

            {activeTab === 'upcoming' && upcomingPlayers.map((player, idx) => (
              <motion.div 
                key={player._id || idx} 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-3 bg-slate-800/40 p-3 rounded-xl border border-slate-700 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold text-slate-200 text-sm">{player.name}</p>
                  <p className="text-xs text-slate-400">{player.role} • {player.isOverseas ? 'Overseas' : 'Indian'}</p>
                </div>
                <div className="text-xs font-black text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded">
                  {formatMoney(player.basePrice)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {activeTab === 'chat' && (
          <form onSubmit={handleChatSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
            <input 
              type="text" 
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type message..." 
              className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuctionRoom;
