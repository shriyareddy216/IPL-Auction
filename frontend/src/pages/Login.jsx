import { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const TEAMS = [
  'Chennai Super Kings (CSK)',
  'Mumbai Indians (MI)',
  'Royal Challengers Bengaluru (RCB)',
  'Kolkata Knight Riders (KKR)',
  'Sunrisers Hyderabad (SRH)',
  'Delhi Capitals (DC)',
  'Punjab Kings (PBKS)',
  'Rajasthan Royals (RR)',
  'Lucknow Super Giants (LSG)',
  'Gujarat Titans (GT)'
];

const Login = () => {
  const [activeTab, setActiveTab] = useState('join'); // 'join' or 'create'
  const [selectedTeam, setSelectedTeam] = useState(TEAMS[0]);
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      return setErrorMsg('Player Name is absolutely required!');
    }
    setErrorMsg('');

    try {
      const endpoint = activeTab === 'join' ? '/api/auth/join-room' : '/api/auth/create-room';
      const payload = { username: username.trim(), teamName: selectedTeam, ...(activeTab === 'join' && { roomId }) };
      
      const { data } = await axios.post(`http://localhost:5001${endpoint}`, payload);
      login(data);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || `Failed to ${activeTab} room`);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glassmorphism max-w-lg w-full p-8 md:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 z-0" pointerEvents="none" />
        
        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-3 text-center bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
            IPL Auction
          </h2>
          <p className="text-slate-400 text-center font-medium mb-8">
            The Ultimate Real-Time Bidding Engine
          </p>

          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl mb-8 relative">
            <button
              onClick={() => setActiveTab('join')}
              className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all z-10 ${activeTab === 'join' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Join Room
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-xl transition-all z-10 ${activeTab === 'create' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Host Room
            </button>
            <motion.div 
              layout
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] bg-indigo-600 rounded-xl shadow-lg z-0"
              initial={false}
              animate={{ x: activeTab === 'join' ? 0 : '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm font-medium text-center"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">Your Name</label>
              <input
                type="text"
                placeholder="Manager Name"
                className="w-full bg-slate-900/50 border border-slate-700/50 placeholder-slate-600 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {activeTab === 'join' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">Room Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-Digit Code"
                    className="w-full bg-slate-900/50 border border-slate-700/50 placeholder-slate-600 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium uppercase text-center tracking-widest"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">Choose Franchise</label>
              <select 
                className="w-full bg-slate-900/50 border border-slate-700/50 placeholder-slate-600 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none font-medium"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                {TEAMS.map(team => (
                  <option key={team} value={team} className="bg-slate-900 py-2">
                    {team}
                  </option>
                ))}
              </select>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all text-sm uppercase tracking-[0.2em]"
            >
              {activeTab === 'join' ? 'Enter Room' : 'Deploy Room'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
