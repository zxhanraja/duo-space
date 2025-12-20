
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { USERS, THEMES } from './constants';
import { Chat } from './features/Chat';
import { MusicPlayer } from './features/Music';
import { NotesBoard } from './features/Notes';
import { GameHub } from './features/Games';
import { CanvasBoard } from './features/Canvas';
import { User, ThemeId } from './types';
import { syncService } from './services/syncService';

const DuoSpaceShell: React.FC<{ user: User }> = ({ user }) => {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<'home' | 'notes' | 'canvas' | 'games'>('home');
  const [isPeerActive, setIsPeerActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(syncService.getRoom());
  const [showPairDialog, setShowPairDialog] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [repaintTrigger, setRepaintTrigger] = useState(0);

  // Sync theme to document body for global CSS variables/repaints
  useLayoutEffect(() => {
    document.body.style.setProperty('--theme-bg', theme.id === 'light' ? '#f4f4f5' : theme.id === 'soft' ? '#f0f4f0' : '#000000');
    document.body.style.setProperty('--theme-text', theme.id === 'light' ? '#000000' : '#ffffff');
    setRepaintTrigger(prev => prev + 1);
  }, [theme.id]);

  useEffect(() => {
    const unsubStatus = syncService.subscribeToStatus((active: boolean, code: string, connected: boolean) => {
      setIsPeerActive(active);
      setRoomCode(code);
      setIsConnected(connected);
    });
    const unsubNudge = syncService.subscribe('nudge_event', () => {
      setIsShaking(true);
      if (window.navigator.vibrate) window.navigator.vibrate([200, 100, 200]);
      setTimeout(() => setIsShaking(false), 800);
    });
    return () => { unsubStatus(); unsubNudge(); };
  }, []);

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    const newRoom = joinInput.trim().toUpperCase();
    try {
      localStorage.setItem('duo_last_room', newRoom);
    } catch (e) { }
    window.location.search = `?room=${newRoom}`;
  };

  const cycleTheme = () => {
    const themeIds = Object.keys(THEMES) as ThemeId[];
    const nextIndex = (themeIds.indexOf(theme.id) + 1) % themeIds.length;
    setTheme(themeIds[nextIndex]);
  };

  return (
    <div key={theme.id} className={`fixed inset-0 w-full h-[100dvh] flex flex-col ${theme.bgGradient} ${theme.textColor} overflow-hidden font-mono ${isShaking ? 'animate-shake' : ''} transition-colors duration-200 force-repaint`}>
      {/* HEADER */}
      <header className={`shrink-0 px-4 py-3 border-b-2 ${theme.borderColor} flex items-center justify-between z-[100] bg-inherit/95 backdrop-blur-xl shadow-sm transition-all`}>
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.location.reload()}>
          <div className="relative shrink-0">
            <img src={user.avatar} className={`w-8 h-8 rounded-full border-2 ${theme.borderColor} shadow-sm transition-transform active:scale-90`} alt="U" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isPeerActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-600'}`}></div>
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-[9px] font-black uppercase italic tracking-tighter leading-none mb-0.5">
              {isConnected ? '📡 SATELLITE_LINK' : '📶 MESH_LOCAL'}
            </h1>
            <span className="text-[7px] opacity-40 font-black uppercase tracking-[0.2em]">{roomCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => syncService.sendShake()} className={`w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 ${theme.borderColor} active:bg-current/10 active:scale-90 transition-all text-sm`}> 🔔 </button>
          <button onClick={cycleTheme} className={`w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 ${theme.borderColor} active:bg-current/10 active:scale-90 transition-all text-sm`}> {theme.id === 'light' ? '🌙' : '☀️'} </button>
          <button onClick={() => setShowPairDialog(true)} className={`w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 ${theme.borderColor} active:bg-current/10 active:scale-90 transition-all text-sm`}> 🔗 </button>
        </div>
      </header>

      {/* CORE WRAPPER */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        <nav className={`shrink-0 md:w-20 flex md:flex-col items-center justify-around md:justify-center py-2 md:py-0 gap-6 border-t-2 md:border-t-0 md:border-r-2 ${theme.borderColor} bg-current/[0.02] backdrop-blur-xl z-50 order-3 md:order-1 transition-all`}>
          {[
            { id: 'home', icon: '🏠', label: 'Chat' },
            { id: 'notes', icon: '📝', label: 'Notes' },
            { id: 'canvas', icon: '🎨', label: 'Draw' },
            { id: 'games', icon: '🎮', label: 'Games' }
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id as any)}
              className={`flex flex-col items-center gap-1 transition-all group ${view === v.id ? 'opacity-100' : 'opacity-20 hover:opacity-50'}`}
            >
              <div className={`w-11 h-11 flex items-center justify-center rounded-2xl border-2 transition-all ${view === v.id ? 'bg-white text-black border-white shadow-xl scale-110' : `${theme.borderColor} bg-transparent`}`}>
                <span className="text-xl">{v.icon}</span>
              </div>
            </button>
          ))}
        </nav>

        <main className="flex-1 flex flex-col md:flex-row min-h-0 order-2 overflow-hidden">
          <div className="flex-[8] min-h-0 h-full flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-current/10 overflow-hidden">
            {view === 'home' && <div className="flex-1 p-3 md:p-6 overflow-hidden"><Chat currentUser={user} /></div>}
            {view === 'notes' && <div className="flex-1 p-3 md:p-6 overflow-hidden"><NotesBoard /></div>}
            {view === 'canvas' && <div className="flex-1 p-3 md:p-6 overflow-hidden"><CanvasBoard /></div>}
            {view === 'games' && <div className="flex-1 p-3 md:p-6 overflow-hidden"><GameHub currentUser={user} /></div>}
          </div>

          <div className={`flex-[1.5] lg:flex-[1.3] min-h-0 p-3 md:p-4 h-full bg-current/[0.01]`}>
            <MusicPlayer />
          </div>
        </main>
      </div>

      {/* SATELLITE SYNC MODAL */}
      {showPairDialog && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
          <div className="relative w-full max-w-[360px] p-8 border-[3px] border-white/90 bg-black text-white rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <button onClick={() => setShowPairDialog(false)} className="absolute top-6 right-8 text-3xl opacity-30 hover:opacity-100">×</button>
            <h2 className="text-2xl font-black italic uppercase mb-12 tracking-tighter text-center">Satellite Sync</h2>
            <div className="space-y-8">
              <div className="text-center p-8 border-2 border-white/10 rounded-3xl bg-[#080808]">
                <span className="block text-[9px] font-black opacity-30 uppercase tracking-[0.5em] mb-4">Space Access Key</span>
                <span className="block text-4xl font-black tracking-[0.1em] text-white uppercase italic">{roomCode}</span>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="PEER_ACCESS_KEY..."
                  className="w-full py-6 bg-black border-2 border-white/10 rounded-2xl px-4 text-center text-[11px] font-black focus:border-white/40 transition-all uppercase tracking-[0.2em] outline-none"
                />
                <button
                  onClick={handleJoin}
                  className="w-full py-6 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] bg-white text-black active:scale-[0.98] transition-all"
                >
                  Initiate Link
                </button>
              </div>
              <button onClick={() => setShowPairDialog(false)} className="w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.1em] opacity-30 hover:opacity-100 transition-all">Close Console</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Login: React.FC<{ onEntry: (u: User) => void }> = ({ onEntry }) => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-black p-8 font-mono text-white overflow-hidden relative">
    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black z-10 pointer-events-none"></div>
    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

    <div className="w-full max-w-sm text-center z-20 animate-in fade-in zoom-in duration-500">
      <div className="inline-block px-5 py-2 bg-white text-black text-[9px] font-black uppercase tracking-[0.6em] mb-12 rounded-full">DUO_SPACE_V5.0</div>

      <h1 className="text-8xl font-black mb-16 uppercase italic tracking-tighter leading-[0.7] text-white select-none">
        DUO<br />
        <span style={{ WebkitTextStroke: '2px white', color: 'transparent' }}>SPACE</span>
      </h1>

      <div className="space-y-4">
        {USERS.map((u, idx) => (
          <button
            key={u.id}
            onClick={() => onEntry(u)}
            className={`w-full flex items-center gap-6 p-5 border-2 border-white/10 hover:border-white transition-all group active:scale-95 rounded-3xl bg-white/5 hover:bg-white/10 relative overflow-hidden animate-in slide-in-from-bottom-4 duration-700`}
            style={{ animationDelay: `${(idx + 1) * 100}ms` }}
          >
            <img src={u.avatar} className="w-14 h-14 rounded-full border-2 border-white/20 grayscale group-hover:grayscale-0 group-hover:border-white transition-all" alt="P" />
            <span className="font-black text-2xl uppercase tracking-tighter group-hover:text-white transition-colors">{u.name.split(' ')[0]}</span>
            <span className="ml-auto text-3xl opacity-30 group-hover:opacity-100 transition-all group-hover:translate-x-1">→</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleEntry = (u: User) => {
    try { localStorage.setItem('duospace_v5_active_user', u.id); } catch (e) { }
    setCurrentUser(u);
  };

  return (
    <ThemeProvider>
      {currentUser ? <DuoSpaceShell user={currentUser} /> : <Login onEntry={handleEntry} />}
    </ThemeProvider>
  );
};

export default App;