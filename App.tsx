
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
  
  // Audio state managed at shell root
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useLayoutEffect(() => {
    document.body.style.setProperty('--theme-bg', theme.id === 'light' ? '#f4f4f5' : theme.id === 'soft' ? '#f0f4f0' : theme.id === 'espresso' ? '#1a0f0a' : '#000000');
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

    const handlePlayerUpdate = (p: PlayerState) => {
      const state = syncService.getState();
      const song = state.playlist.find(s => s.id === p.currentSongId);
      if (song && song.id !== activeSong?.id) setActiveSong(song);
      
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

    const initialState = syncService.getState();
    if (initialState.player?.currentSongId) {
      const song = initialState.playlist.find(s => s.id === initialState.player.currentSongId);
      if (song) setActiveSong(song);
    }

    return () => { unsubStatus(); unsubNudge(); unsubPlayer(); unsubFull(); };
  }, [activeSong?.id]);

  const cycleTheme = () => {
    const themeIds = Object.keys(THEMES) as ThemeId[];
    const nextIndex = (themeIds.indexOf(theme.id) + 1) % themeIds.length;
    setTheme(themeIds[nextIndex]);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={`fixed inset-0 w-full h-[100dvh] flex flex-col ${theme.bgGradient} ${theme.textColor} overflow-hidden font-mono ${isShaking ? 'animate-shake' : ''} transition-all duration-700`}>
      
      {/* PERSISTENT AUDIO ENGINE */}
      <div className="fixed -top-[1000px] -left-[1000px] w-1 h-1 pointer-events-none opacity-0">
        {activeSong && (
          <iframe 
            ref={iframeRef} 
            key={activeSong.id} 
            src={`https://www.youtube.com/embed/${activeSong.url}?enablejsapi=1&autoplay=1&controls=0&mute=0&rel=0&origin=${encodeURIComponent(currentOrigin)}&widget_referrer=${encodeURIComponent(currentOrigin)}`} 
            allow="autoplay; encrypted-media"
          />
        )}
      </div>

      <header className={`shrink-0 px-4 py-2 border-b-2 ${theme.borderColor} flex items-center justify-between z-[100] bg-inherit/90 backdrop-blur-2xl shadow-xl`}>
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => window.location.reload()}>
            <img src={user.avatar} className="w-8 h-8 rounded-full border-2 border-current/20 shadow-lg active:scale-95 transition-all" alt="U" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${isPeerActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[9px] font-black uppercase italic tracking-widest leading-none"> {isConnected ? 'SECURE_LINK' : 'MESH_BOOTING'} </h1>
            <span className="text-[6px] opacity-40 uppercase font-black tracking-tighter">{roomCode}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => syncService.sendShake()} className="w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 hover:bg-current/10 active:scale-90 transition-all">🔔</button>
          <button onClick={cycleTheme} className="w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 hover:bg-current/10 active:scale-90 transition-all">🌓</button>
          <button onClick={() => setShowPairDialog(true)} className="w-9 h-9 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 hover:bg-current/10 active:scale-90 transition-all">🔗</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative">
        {/* NAV BAR */}
        <nav className={`shrink-0 md:w-16 flex md:flex-col items-center justify-around md:justify-center py-2 md:py-0 gap-5 border-t-2 md:border-t-0 md:border-r-2 ${theme.borderColor} bg-current/[0.03] backdrop-blur-3xl z-50 order-3 md:order-1 transition-colors duration-700`}>
          {[
            { id: 'home', icon: '🏠' }, 
            { id: 'notes', icon: '📝' }, 
            { id: 'canvas', icon: '🎨' }, 
            { id: 'games', icon: '🎮' }
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`transition-all duration-500 ${view === v.id ? 'opacity-100 scale-125' : 'opacity-20 hover:opacity-60'}`}>
              <div className={`w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-2xl border-2 shadow-2xl ${view === v.id ? 'bg-white text-black border-white' : `${theme.borderColor} bg-transparent`}`}>
                 <span className="text-xl">{v.icon}</span>
              </div>
            </button>
          ))}
        </nav>

        <main className="flex-1 flex flex-col min-h-0 order-2 overflow-hidden bg-current/[0.01]">
          {/* MAIN VIEW AREA */}
          <div className="flex-1 min-h-0 h-full overflow-y-auto md:overflow-hidden custom-scrollbar relative">
            <div className="p-3 md:p-8 animate-in fade-in zoom-in-95 duration-700 h-full">
              {view === 'home' && <Chat currentUser={user} />}
              {view === 'notes' && <NotesBoard />}
              {view === 'canvas' && <CanvasBoard />}
              {view === 'games' && <GameHub currentUser={user} />}
            </div>
          </div>

          {/* AUDIO HUB - Persistent at bottom for mobile, sidebar for desktop */}
          <div className="shrink-0 md:flex-[1.8] md:h-full p-2 md:p-5 border-t-2 md:border-t-0 md:border-l-2 border-current/10 bg-current/[0.02] backdrop-blur-md">
            <MusicPlayer />
          </div>
        </main>
      </div>

      {/* PAIRING OVERLAY */}
      {showPairDialog && (
        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="relative w-full max-w-[340px] p-10 border-4 border-white/20 bg-zinc-950 text-white rounded-[3rem] shadow-2xl">
            <button onClick={() => setShowPairDialog(false)} className="absolute top-8 right-10 text-3xl opacity-30 hover:opacity-100 transition-opacity">×</button>
            <div className="space-y-8 text-center">
              <div className="p-8 border-2 border-white/10 rounded-3xl bg-black/50">
                <span className="block text-[10px] font-black opacity-30 uppercase mb-3 tracking-[0.8em]">Link Key</span>
                <span className="block text-4xl font-black italic tracking-[0.3em] text-white/90">{roomCode}</span>
              </div>
              <div className="space-y-4">
                <input 
                  type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="ENTER_PEER_KEY..." className="w-full py-5 bg-white/5 border-2 border-white/10 rounded-2xl px-6 text-center text-[12px] font-black outline-none uppercase"
                />
                <button 
                  onClick={() => { if (!joinInput.trim()) return; window.location.search = `?room=${joinInput.trim()}`; }} 
                  className="w-full py-5 rounded-2xl font-black uppercase text-[12px] bg-white text-black"
                >
                  Sync Space
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Login: React.FC<{ onEntry: (u: User) => void }> = ({ onEntry }) => (
  <div className="h-[100dvh] w-full flex items-center justify-center bg-black p-10 font-mono text-white overflow-hidden relative">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_100%)] animate-pulse"></div>
    <div className="w-full max-w-[320px] text-center z-10 animate-in zoom-in-90 duration-1000">
      <div className="inline-block px-6 py-2.5 bg-white text-black text-[10px] font-black uppercase tracking-[0.6em] mb-14 rounded-full shadow-2xl">DUO_SPACE_ULTRA</div>
      <h1 className="text-7xl font-black mb-14 uppercase italic tracking-tighter leading-[0.8]">DUO<br/><span style={{ WebkitTextStroke: '2px white', color: 'transparent' }}>SPACE</span></h1>
      <div className="space-y-5">
        {USERS.map((u) => (
          <button key={u.id} onClick={() => onEntry(u)} className="w-full flex items-center gap-5 p-6 border-2 border-white/10 hover:border-white hover:bg-white/5 transition-all rounded-[2rem] active:scale-95 group shadow-lg">
            <img src={u.avatar} className="w-12 h-12 rounded-full border-2 border-white/20 grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all" alt="P" />
            <span className="font-black text-2xl uppercase tracking-tighter transition-all">{u.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const handleEntry = (u: User) => setCurrentUser(u);
  return (
    <ThemeProvider>
      {currentUser ? <DuoSpaceShell user={currentUser} /> : <Login onEntry={handleEntry} />}
    </ThemeProvider>
  );
};

export default App;
