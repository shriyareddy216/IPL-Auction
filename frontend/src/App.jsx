import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';

import Login from './pages/Login';
import AuctionRoom from './pages/AuctionRoom';
import Dashboard from './pages/Dashboard';

function App() {
  const { user, logout } = useContext(AuthContext);

  return (
    <Router>
      <div className="w-full h-full min-h-screen text-slate-100 bg-transparent flex flex-col">
        {/* Simple Navbar */}
        {user && (
          <nav className="w-full glassmorphism px-8 py-4 flex justify-between items-center sticky top-0 z-50">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              IPL Auction 2026
            </h1>
            <div className="flex items-center gap-4 md:gap-6 text-sm md:text-base">
              <span className="font-semibold hidden sm:inline">{user.teamName}</span>
              <div className="bg-slate-800/80 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-slate-700 font-mono text-indigo-300">
                ₹ {(user.budget || 0).toLocaleString('en-IN')}
              </div>
              <Link to="/dashboard" className="hover:text-purple-400 font-bold transition-colors">Dashboard</Link>
              <Link to="/auction" className="hover:text-purple-400 font-bold transition-colors">Auction</Link>
              <button 
                onClick={() => {
                  logout();
                  window.location.href = '/';
                }} 
                className="bg-red-500/20 text-red-400 hover:bg-red-500/40 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors font-bold text-xs uppercase tracking-wider"
              >
                Logout
              </button>
            </div>
          </nav>
        )}

        <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={!user ? <Login /> : <Navigate to="/auction" />} />
            <Route path="/auction" element={user ? <AuctionRoom /> : <Navigate to="/" />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
