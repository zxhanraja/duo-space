
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
  const [hasUnlockedAudio, setHasUnlockedAudio] = useState(false);

  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // GLOBAL THEME SYNC ENGINE
  useLayoutEffect(() => {
    const root = document.documentElement;
    const bg = theme.id === 'light' ? '#f4f4f5' : theme.id === 'soft' ? '#f0f4f0' : theme.id === 'espresso' ? '#1a0f0a' : '#000000';
    const text = theme.id === 'light' ? '#000000' : '#ffffff';

    root.style.setProperty('--theme-bg', bg);
    root.style.setProperty('--theme-text', text);

    // Apply theme to body and root div to ensure global sync
    document.body.className = `${theme.bgGradient} transition-all duration-700`;
    const appRoot = document.getElementById('app-root');
    if (appRoot) appRoot.className = `fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden font-mono ${theme.bgGradient} ${theme.textColor}`;
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

      // Control the invisible global player
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

    return () => { unsubStatus(); unsubNudge(); unsubPlayer(); unsubFull(); };
  }, [activeSong?.id]);

  const cycleTheme = () => {
    const themeIds = Object.keys(THEMES) as ThemeId[];
    const nextIndex = (themeIds.indexOf(theme.id) + 1) % themeIds.length;
    setTheme(themeIds[nextIndex]);
  };

  const handleAudioUnlock = () => {
    setHasUnlockedAudio(true);
    // Force play on iframe if possible
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div id="app-root" className={`fixed inset-0 w-full h-[100dvh] flex flex-col overflow-hidden font-mono ${isShaking ? 'animate-shake' : ''} transition-all duration-700`}>

      {/* GLOBAL BACKGROUND AUDIO ENGINE */}
      <div className="fixed -top-[1000px] -left-[1000px] w-1 h-1 pointer-events-none opacity-0 overflow-hidden">
        {activeSong && (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${activeSong.url}?enablejsapi=1&autoplay=1&controls=0&mute=0&rel=0&origin=${encodeURIComponent(currentOrigin)}`}
            allow="autoplay; encrypted-media"
            onLoad={() => {
              // FORCE SYNC ON LOAD
              const state = syncService.getState();
              if (state.player && iframeRef.current?.contentWindow) {
                const func = state.player.isPlaying ? 'playVideo' : 'pauseVideo';
                iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
                if (state.player.isPlaying) {
                  // Calculate correct time based on timestamp + drift
                  const drift = (Date.now() - state.player.timestamp) / 1000;
                  const targetTime = state.player.progress + drift;
                  iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [targetTime, true] }), '*');
                }
              }
            }}
          />
        )}
      </div>

      {/* MOBILE AUDIO UNLOCK OVERLAY */}
      {!hasUnlockedAudio && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 mb-8 text-6xl animate-bounce">📻</div>
          <h2 className="text-xl font-black uppercase tracking-[0.3em] mb-4 text-white">Station Ready</h2>
          <p className="text-[10px] opacity-40 uppercase mb-10 max-w-[200px] leading-relaxed text-white">Mobile browsers require a touch to unlock the shared audio signal.</p>
          <button
            onClick={handleAudioUnlock}
            className="px-12 py-5 bg-white text-black font-black uppercase text-xs rounded-full shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-95 transition-all"
          >
            Join Audio Link
          </button>
        </div>
      )}

      {/* COMPACT HEADER */}
      <header className={`shrink-0 h-14 px-4 border-b-2 ${theme.borderColor} flex items-center justify-between z-[100] bg-inherit backdrop-blur-xl shadow-sm`}>
        <div className="flex items-center gap-3">
          <div className="relative cursor-pointer" onClick={() => window.location.reload()}>
            <img src={user.avatar} className="w-8 h-8 rounded-full border-2 border-current/20" alt="U" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${isPeerActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`}></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[10px] font-black uppercase italic tracking-widest leading-none"> {isConnected ? 'SECURE_LINK' : 'MESH_BOOTING'} </h1>
            <span className="text-[7px] opacity-40 uppercase font-black tracking-tighter">{roomCode}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => syncService.sendShake()} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 active:scale-90 transition-all">🔔</button>
          <button onClick={cycleTheme} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 active:scale-90 transition-all">🌓</button>
          <button onClick={() => setShowPairDialog(true)} className="w-8 h-8 flex items-center justify-center bg-current/5 rounded-xl border-2 border-current/10 active:scale-90 transition-all">🔗</button>
        </div>
      </header>

      {/* CORE CONTENT LAYOUT */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden relative bg-inherit">

        {/* SIDE NAV */}
        <nav className={`shrink-0 md:w-16 flex md:flex-col items-center justify-around md:justify-center p-2 gap-4 border-b-2 md:border-b-0 md:border-r-2 ${theme.borderColor} bg-inherit backdrop-blur-3xl z-[60]`}>
          {[
            { id: 'home', icon: '🏠' },
            { id: 'notes', icon: '📝' },
            { id: 'canvas', icon: '🎨' },
            { id: 'games', icon: '🎮' }
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id as any)} className={`transition-all duration-300 ${view === v.id ? 'opacity-100' : 'opacity-20 hover:opacity-50'}`}>
              <div className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 transition-all ${view === v.id ? 'bg-white text-black border-white shadow-lg scale-110' : `${theme.borderColor}`}`}>
                <span className="text-lg">{v.icon}</span>
              </div>
            </button>
          ))}
        </nav>

        {/* FEATURE VIEWPORT */}
        <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-current/[0.01]">
          <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-3 sm:p-6 md:p-8 bg-inherit">
            <div className="h-full max-w-5xl mx-auto animate-in fade-in duration-500">
              {view === 'home' && <Chat currentUser={user} />}
              {view === 'notes' && <NotesBoard />}
              {view === 'canvas' && <CanvasBoard />}
              {view === 'games' && <GameHub currentUser={user} />}
            </div>
          </div>
        </main>
      </div>

      {/* FOOTER AUDIO */}
      <footer className={`shrink-0 h-auto min-h-[140px] md:min-h-0 md:h-20 border-t-2 ${theme.borderColor} bg-inherit backdrop-blur-2xl z-[70] p-3 md:px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]`}>
        <MusicPlayer />
      </footer>

      {/* PAIRING OVERLAY */}
      {showPairDialog && (
        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative w-full max-w-[340px] p-10 border-4 border-white/20 bg-zinc-950 text-white rounded-[3rem] shadow-2xl">
            <button onClick={() => setShowPairDialog(false)} className="absolute top-8 right-10 text-3xl opacity-30 hover:opacity-100">×</button>
            <div className="space-y-8 text-center">
              <div className="p-8 border-2 border-white/10 rounded-3xl bg-black/50">
                <span className="block text-[10px] font-black opacity-30 uppercase mb-3 tracking-[0.8em]">Sync Key</span>
                <span className="block text-4xl font-black italic tracking-[0.3em]">{roomCode}</span>
              </div>
              <div className="space-y-4">
                <input
                  type="text" value={joinInput} onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="PEER_KEY..." className="w-full py-5 bg-white/5 border-2 border-white/10 rounded-2xl px-6 text-center text-[12px] font-black outline-none uppercase"
                />
                <button
                  onClick={() => { if (!joinInput.trim()) return; window.location.search = `?room=${joinInput.trim()}`; }}
                  className="w-full py-5 rounded-2xl font-black uppercase text-[12px] bg-white text-black active:scale-95 transition-all"
                >
                  Link Link
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
  <div className="h-[100dvh] w-full flex items-center justify-center bg-black p-10 font-mono text-white overflow-hidden">
    <div className="w-full max-w-[320px] text-center z-10">
      <div className="inline-block px-6 py-2 bg-white text-black text-[10px] font-black uppercase tracking-[0.6em] mb-12 rounded-full">DUO_SPACE_ULTRA</div>
      <h1 className="text-7xl font-black mb-14 uppercase italic tracking-tighter leading-[0.8]">DUO<br /><span style={{ WebkitTextStroke: '2px white', color: 'transparent' }}>SPACE</span></h1>
      <div className="space-y-4">
        {USERS.map((u) => (
          <button key={u.id} onClick={() => onEntry(u)} className="w-full flex items-center gap-5 p-5 border-2 border-white/10 hover:border-white transition-all rounded-[2rem] active:scale-95 group">
            <img src={u.avatar} className="w-10 h-10 rounded-full border-2 border-white/20 grayscale group-hover:grayscale-0 transition-all" alt="P" />
            <span className="font-black text-xl uppercase tracking-tighter">{u.name.split(' ')[0]}</span>
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