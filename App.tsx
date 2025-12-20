
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

  useLayoutEffect(() => {
    document.body.style.setProperty('--theme-bg', theme.id === 'light' ? '#f4f4f5' : theme.id === 'soft' ? '#f0f4f0' : '#000000');
    document.body.style.setProperty('--theme-text', theme.id === 'light' ? '#000000' : '#ffffff');
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
    try { localStorage.setItem('duo_last_room', newRoom); } catch(e) {}
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
      <header className={`shrink-0 px-4 py-2 border-b-2 ${theme.borderColor} flex items-center justify-between z-[100] bg-inherit/95 backdrop-blur-xl shadow-sm`}>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="relative shrink-0">
            <img src={user.avatar} className={`w-7 h-7 rounded-full border-2 ${theme.borderColor} shadow-sm active:scale-90`} alt="U" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${isPeerActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-600'}`}></div>
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-[8px] font-black uppercase italic tracking-tighter leading-none"> {isConnected ? '📡 LINKED' : '📶 MESH'} </h1>
            <span className="text-[6px] opacity-40 font-black uppercase tracking-[0.2em]">{roomCode}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => syncService.sendShake()} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-lg border border-current/20 active:scale-90 text-xs"> 🔔 </button>
          <button onClick={cycleTheme} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-lg border border-current/20 active:scale-90 text-xs"> {theme.id === 'light' ? '🌙' : '☀️'} </button>
          <button onClick={() => setShowPairDialog(true)} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-lg border border-current/20 active:scale-90 text-xs"> 🔗 </button>
        </div>
      </header>

      {/* CORE WRAPPER - PROPORTIONS: Nav(5%) | Main(80%) | Music(15%) */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* NAV (approx 5% space) */}
        <nav className={`shrink-0 md:w-14 flex md:flex-col items-center justify-around md:justify-center py-1 md:py-0 gap-4 border-t-2 md:border-t-0 md:border-r-2 ${theme.borderColor} bg-current/[0.02] backdrop-blur-xl z-50 order-3 md:order-1`}>
          {[
            { id: 'home', icon: '🏠' }, 
            { id: 'notes', icon: '📝' }, 
            { id: 'canvas', icon: '🎨' }, 
            { id: 'games', icon: '🎮' }
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`transition-all ${view === v.id ? 'opacity-100 scale-110' : 'opacity-20 hover:opacity-50'}`}>
              <div className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl border ${view === v.id ? 'bg-white text-black border-white shadow-md' : `${theme.borderColor} bg-transparent`}`}>
                 <span className="text-base">{v.icon}</span>
              </div>
            </button>
          ))}
        </nav>

        <main className="flex-1 flex flex-col md:flex-row min-h-0 order-2 overflow-hidden">
          {/* CHAT/CONTENT (80% space) */}
          <div className="flex-[8] min-h-0 h-full flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-current/10 overflow-hidden">
            {view === 'home' && <div className="flex-1 p-2 md:p-4 overflow-hidden"><Chat currentUser={user} /></div>}
            {view === 'notes' && <div className="flex-1 p-2 md:p-4 overflow-hidden"><NotesBoard /></div>}
            {view === 'canvas' && <div className="flex-1 p-2 md:p-4 overflow-hidden"><CanvasBoard /></div>}
            {view === 'games' && <div className="flex-1 p-2 md:p-4 overflow-hidden"><GameHub currentUser={user} /></div>}
          </div>

          {/* AUDIO NODE (15% space) */}
          <div className="flex-[1.5] min-h-0 p-2 md:p-3 h-full bg-current/[0.01]">
            <MusicPlayer />
          </div>
        </main>
      </div>

      {/* SYNC MODAL */}
      {showPairDialog && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-[320px] p-6 border-2 border-white/90 bg-black text-white rounded-[2rem]">
            <button onClick={() => setShowPairDialog(false)} className="absolute top-4 right-6 text-2xl opacity-30 hover:opacity-100">×</button>
            <h2 className="text-xl font-black italic uppercase mb-8 text-center tracking-tighter">Sync Link</h2>
            <div className="space-y-6">
              <div className="text-center p-6 border border-white/10 rounded-2xl bg-[#080808]">
                <span className="block text-[8px] font-black opacity-30 uppercase tracking-[0.4em] mb-2">Access Key</span>
                <span className="block text-2xl font-black tracking-[0.1em] italic">{roomCode}</span>
              </div>
              <input 
                type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="PEER_KEY..." className="w-full py-4 bg-black border border-white/10 rounded-xl px-4 text-center text-[10px] font-black focus:border-white/40 outline-none uppercase"
              />
              <button onClick={handleJoin} className="w-full py-4 rounded-xl font-black uppercase text-[10px] bg-white text-black">Link Space</button>
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
    <div className="w-full max-w-xs text-center z-20">
      <div className="inline-block px-4 py-1.5 bg-white text-black text-[8px] font-black uppercase tracking-[0.4em] mb-12 rounded-full">DUO_SPACE</div>
      <h1 className="text-6xl font-black mb-12 uppercase italic tracking-tighter leading-[0.8] text-white">DUO<br/><span style={{ WebkitTextStroke: '1.5px white', color: 'transparent' }}>SPACE</span></h1>
      <div className="space-y-3">
        {USERS.map((u) => (
          <button key={u.id} onClick={() => onEntry(u)} className="w-full flex items-center gap-4 p-4 border border-white/10 hover:border-white transition-all rounded-2xl bg-white/5 active:scale-95">
            <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/20 grayscale" alt="P" />
            <span className="font-black text-xl uppercase tracking-tighter">{u.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const handleEntry = (u: User) => { setCurrentUser(u); };
  return (
    <ThemeProvider>
      {currentUser ? <DuoSpaceShell user={currentUser} /> : <Login onEntry={handleEntry} />}
    </ThemeProvider>
  );
};

export default App;