import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { motion } from 'framer-motion';
import axios from 'axios';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!user?.token) return;
      try {
        const { data } = await axios.get('http://localhost:5001/api/auth/me', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setTeam(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchTeam();
  }, [user]);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="w-full max-w-6xl">
      <div className="glassmorphism p-8 rounded-3xl mb-8 flex justify-between items-center bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-500/30">
        <div>
          <h2 className="text-3xl font-extrabold text-white mb-1">{team.teamName} Dashboard</h2>
          <p className="text-indigo-300 font-medium">Manager: {team.username}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 uppercase tracking-widest text-sm font-bold mb-1">Remaining Purse</p>
          <p className="text-4xl font-mono text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 font-bold drop-shadow-lg">
            ₹ {(team.budget || 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="glassmorphism p-8 rounded-3xl min-h-[400px]">
        <h3 className="text-2xl font-bold mb-6 text-slate-200 border-b border-slate-700 pb-4">Acquired Squad</h3>
        
        {team.playersBought && team.playersBought.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.playersBought.map((player) => (
              <motion.div 
                whileHover={{ y: -5 }}
                key={typeof player === 'string' ? player : player._id} 
                className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 shadow-xl flex gap-4 items-center"
              >
                <div className="w-16 h-16 rounded-xl bg-slate-700 shrink-0 overflow-hidden">
                  <img src={player.image || 'https://via.placeholder.com/150'} alt="player" className="w-full h-full object-cover opacity-80" />
                </div>
                <div>
                  <h4 className="font-bold text-lg leading-tight mb-1">{player.name || 'Player Name'}</h4>
                  <div className="flex gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{player.role || 'Role'}</span>
                  </div>
                  <p className="text-yellow-400 font-mono text-sm mt-2 font-bold opacity-0">₹ {player.soldPrice?.toLocaleString('en-IN')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xl">Your squad is currently empty.</p>
            <a href="/auction" className="mt-4 text-indigo-400 hover:text-indigo-300 underline font-semibold">Head to the Auction Room</a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
