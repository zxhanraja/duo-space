
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { USERS, THEMES } from './constants';
import { Chat } from './features/Chat';
import { MusicPlayer } from './features/Music';
import { NotesBoard } from './features/Notes';
import { GameHub } from './features/Games';
import { CanvasBoard } from './features/Canvas';
import { User, ThemeId, Song, PlayerState } from './types';
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

  // Persistent Audio State for the Iframe
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

    // Persistent Audio Logic: Keep the iframe in sync regardless of which view or theme is active
    const handlePlayerUpdate = (p: PlayerState) => {
      const state = syncService.getState();
      const song = state.playlist.find(s => s.id === p.currentSongId);
      if (song && song.id !== activeSong?.id) {
        setActiveSong(song);
      }

      // Send commands to iframe if it exists
      if (iframeRef.current?.contentWindow) {
        const func = p.isPlaying ? 'playVideo' : 'pauseVideo';
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
        if (p.isPlaying) {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [p.progress, true] }), '*');
        }
      }
    };

    const unsubPlayer = syncService.subscribe('player_update', handlePlayerUpdate);
    const unsubFull = syncService.subscribe('full_sync', (state: any) => {
      if (state.player) handlePlayerUpdate(state.player);
    });

    // Initial load for audio
    const initialState = syncService.getState();
    if (initialState.player?.currentSongId) {
      const song = initialState.playlist.find(s => s.id === initialState.player.currentSongId);
      if (song) setActiveSong(song);
    }

    return () => { unsubStatus(); unsubNudge(); unsubPlayer(); unsubFull(); };
  }, [activeSong?.id]);

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    const newRoom = joinInput.trim().toUpperCase();
    try { localStorage.setItem('duo_last_room', newRoom); } catch (e) { }
    window.location.search = `?room=${newRoom}`;
  };

  const cycleTheme = () => {
    const themeIds = Object.keys(THEMES) as ThemeId[];
    const nextIndex = (themeIds.indexOf(theme.id) + 1) % themeIds.length;
    setTheme(themeIds[nextIndex]);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] flex flex-col ${theme.bgGradient} ${theme.textColor} overflow-hidden font-mono ${isShaking ? 'animate-shake' : ''} transition-colors duration-300`}>

      {/* PERSISTENT HIDDEN AUDIO ENGINE - Placed at root to survive all UI changes */}
      <div className="fixed -top-[1000px] -left-[1000px] w-1 h-1 pointer-events-none overflow-hidden">
        {activeSong && (
          <iframe
            ref={iframeRef}
            key={activeSong.id}
            src={`https://www.youtube.com/embed/${activeSong.url}?enablejsapi=1&autoplay=1&controls=0&mute=0&rel=0&origin=${encodeURIComponent(currentOrigin)}&widget_referrer=${encodeURIComponent(currentOrigin)}`}
            allow="autoplay; encrypted-media"
          />
        )}
      </div>

      <header className={`shrink-0 px-4 py-1.5 border-b-2 ${theme.borderColor} flex items-center justify-between z-[100] bg-inherit/95 backdrop-blur-xl shadow-sm`}>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="relative shrink-0">
            <img src={user.avatar} className={`w-6 h-6 rounded-full border border-current/20 active:scale-90`} alt="U" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white ${isPeerActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-600'}`}></div>
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-[7px] font-black uppercase italic leading-none tracking-tighter"> {isConnected ? '📡 LINK' : '📶 MESH'} </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => syncService.sendShake()} className="w-7 h-7 flex items-center justify-center bg-current/5 rounded border border-current/10 active:scale-90 text-[10px]"> 🔔 </button>
          <button onClick={cycleTheme} className="w-7 h-7 flex items-center justify-center bg-current/5 rounded border border-current/10 active:scale-90 text-[10px]"> {theme.id === 'light' ? '🌙' : '☀️'} </button>
          <button onClick={() => setShowPairDialog(true)} className="w-7 h-7 flex items-center justify-center bg-current/5 rounded border border-current/10 active:scale-90 text-[10px]"> 🔗 </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* NAV (5%) */}
        <nav className={`shrink-0 md:w-14 flex md:flex-col items-center justify-around md:justify-center py-1 md:py-0 gap-3 border-t-2 md:border-t-0 md:border-r-2 ${theme.borderColor} bg-current/[0.01] backdrop-blur-xl z-50 order-3 md:order-1`}>
          {[
            { id: 'home', icon: '🏠' },
            { id: 'notes', icon: '📝' },
            { id: 'canvas', icon: '🎨' },
            { id: 'games', icon: '🎮' }
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`transition-all ${view === v.id ? 'opacity-100 scale-105' : 'opacity-20 hover:opacity-50'}`}>
              <div className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg border ${view === v.id ? 'bg-white text-black border-white' : `${theme.borderColor} bg-transparent`}`}>
                <span className="text-sm md:text-base">{v.icon}</span>
              </div>
            </button>
          ))}
        </nav>

        <main className="flex-1 flex flex-col md:flex-row min-h-0 order-2 overflow-hidden">
          {/* CONTENT (80%) */}
          <div className="flex-[8] min-h-0 h-full flex flex-col border-b-2 md:border-b-0 md:border-r-2 border-current/10 overflow-hidden">
            <div className="flex-1 p-2 md:p-3 overflow-hidden">
              {view === 'home' && <Chat currentUser={user} />}
              {view === 'notes' && <NotesBoard />}
              {view === 'canvas' && <CanvasBoard />}
              {view === 'games' && <GameHub currentUser={user} />}
            </div>
          </div>

          {/* AUDIO (15%) */}
          <div className="flex-[1.5] min-h-0 p-2 md:p-3 h-full bg-current/[0.01] overflow-hidden">
            <MusicPlayer />
          </div>
        </main>
      </div>

      {showPairDialog && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[280px] p-6 border-2 border-white/90 bg-black text-white rounded-3xl">
            <button onClick={() => setShowPairDialog(false)} className="absolute top-4 right-6 text-xl opacity-30">×</button>
            <div className="space-y-5">
              <div className="text-center p-5 border border-white/10 rounded-xl bg-[#080808]">
                <span className="block text-[7px] font-black opacity-30 uppercase mb-1 tracking-widest">Key</span>
                <span className="block text-xl font-black italic tracking-widest">{roomCode}</span>
              </div>
              <input
                type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                placeholder="PEER_KEY..." className="w-full py-3 bg-black border border-white/10 rounded-lg px-4 text-center text-[9px] font-black outline-none uppercase"
              />
              <button onClick={handleJoin} className="w-full py-3 rounded-lg font-black uppercase text-[9px] bg-white text-black active:scale-95 transition-all">Link Space</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Login: React.FC<{ onEntry: (u: User) => void }> = ({ onEntry }) => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-black p-8 font-mono text-white overflow-hidden">
    <div className="w-full max-w-[260px] text-center">
      <div className="inline-block px-4 py-1.5 bg-white text-black text-[7px] font-black uppercase tracking-[0.4em] mb-10 rounded-full">DUO_SPACE</div>
      <h1 className="text-5xl font-black mb-10 uppercase italic tracking-tighter leading-[0.8]">DUO<br /><span style={{ WebkitTextStroke: '1.2px white', color: 'transparent' }}>SPACE</span></h1>
      <div className="space-y-3">
        {USERS.map((u) => (
          <button key={u.id} onClick={() => onEntry(u)} className="w-full flex items-center gap-3 p-3.5 border border-white/10 hover:border-white transition-all rounded-xl bg-white/5 active:scale-95">
            <img src={u.avatar} className="w-8 h-8 rounded-full border border-white/20 grayscale" alt="P" />
            <span className="font-black text-lg uppercase tracking-tighter">{u.name.split(' ')[0]}</span>
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