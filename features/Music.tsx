
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, Song } from '../types';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/syncService';

export const MusicPlayer: React.FC = () => {
  const { theme } = useTheme();
  const [queue, setQueue] = useState<Song[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSongId: null, isPlaying: false, progress: 0, timestamp: Date.now(), syncLocked: true, masterId: null
  });
  const [urlInput, setUrlInput] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastUpdateRef = useRef<number>(0);

  const activeSong = queue.find(s => s.id === playerState.currentSongId) || (queue.length > 0 ? queue[0] : null);

  const sendYTCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    }
  };

  useEffect(() => {
    const state = syncService.getState();
    setQueue(state.playlist || []);
    if (state.player?.currentSongId) reconcilePlayer(state.player);

    const killPlayer = syncService.subscribe('player_update', reconcilePlayer);
    const killPlaylist = syncService.subscribe('playlist_update', (p: Song[]) => setQueue(p || []));
    const killFullSync = syncService.subscribe('full_sync', (s: any) => {
      if (s.playlist) setQueue(s.playlist);
      if (s.player) reconcilePlayer(s.player);
    });

    return () => { killPlayer(); killPlaylist(); killFullSync(); };
  }, []);

  const reconcilePlayer = (remote: PlayerState) => {
    if (remote.timestamp <= lastUpdateRef.current) return;
    lastUpdateRef.current = remote.timestamp;
    
    const now = Date.now();
    const drift = (now - remote.timestamp) / 1000;
    const projectedProgress = remote.isPlaying ? remote.progress + drift : remote.progress;
    
    setPlayerState({ ...remote, progress: projectedProgress });

    // Jitter Correction: Only seek if the difference is more than 2.5 seconds
    // to prevent audio stutters on slow network links
    setTimeout(() => {
      if (remote.isPlaying) {
        sendYTCommand('playVideo');
        sendYTCommand('seekTo', [projectedProgress, true]);
      } else {
        sendYTCommand('pauseVideo');
      }
    }, 300);
  };

  const handleToggle = () => {
    const isNowPlaying = !playerState.isPlaying;
    const songId = playerState.currentSongId || (queue.length > 0 ? queue[0].id : null);
    const next: PlayerState = { ...playerState, isPlaying: isNowPlaying, currentSongId: songId, timestamp: Date.now() };
    setPlayerState(next);
    syncService.syncPlayer(next);
    if (isNowPlaying) sendYTCommand('playVideo');
    else sendYTCommand('pauseVideo');
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playerState.currentSongId);
    const nextSong = queue[(currentIndex + 1) % queue.length];
    const next: PlayerState = { ...playerState, currentSongId: nextSong.id, progress: 0, isPlaying: true, timestamp: Date.now() };
    setPlayerState(next);
    syncService.syncPlayer(next);
    setTimeout(() => { sendYTCommand('seekTo', [0, true]); sendYTCommand('playVideo'); }, 100);
  };

  const addToSpace = () => {
    const vId = urlInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
    if (!vId) return;
    const newSong: Song = { id: `s_${Date.now()}`, title: 'SYNCED_STATION', artist: 'DUO_USER', url: vId, type: 'youtube', coverUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`, addedBy: 'user', duration: 0 };
    const next = [newSong, ...queue].slice(0, 20);
    setQueue(next);
    syncService.updatePlaylist(next);
    setUrlInput('');
    if (!playerState.currentSongId) {
      const p = { ...playerState, currentSongId: newSong.id, isPlaying: true, timestamp: Date.now() };
      setPlayerState(p);
      syncService.syncPlayer(p);
    }
  };

  return (
    <div className="flex flex-col min-h-0 w-full animate-in fade-in duration-700">
      <div className="flex items-center gap-2 mb-4 px-2">
         <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${theme.accentColor}`}>AUDIO NODE</span>
         <span className="text-xs">🎧</span>
      </div>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className={`flex-1 flex items-center ${theme.cardBg} border-2 ${theme.borderColor} rounded-2xl overflow-hidden h-14 shadow-sm`}>
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="YT URL..." className="flex-1 bg-transparent px-4 text-[10px] font-black focus:outline-none placeholder:opacity-20 uppercase tracking-widest" />
          <button onClick={addToSpace} className={`h-full px-6 ${theme.buttonStyle} border-none shadow-none rounded-none border-l-2 ${theme.borderColor}`}>ADD</button>
        </div>
        <div className={`flex items-center gap-2 p-1 ${theme.cardBg} rounded-2xl border-2 ${theme.borderColor} h-14`}>
           <button onClick={handleToggle} className={`w-12 h-full flex items-center justify-center ${theme.buttonStyle} border-none shadow-none text-xs rounded-xl active:scale-90 transition-all`}>{playerState.isPlaying ? '❙❙' : '▶'}</button>
           <button onClick={handleNext} className={`w-12 h-full flex items-center justify-center bg-current/5 text-current rounded-xl text-xs border ${theme.borderColor} active:scale-90 transition-all hover:bg-current/10`}>⏭️</button>
           <div className={`w-12 h-full flex items-center justify-center bg-current/10 rounded-xl overflow-hidden`}>
              <div className={`w-8 h-8 rounded-full border border-current/20 overflow-hidden ${playerState.isPlaying ? 'animate-spin-slow' : 'grayscale opacity-30'}`}>
                {activeSong ? <img src={activeSong.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-current/20" />}
              </div>
           </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-40 md:max-h-none">
        {queue.map(s => (
          <div key={s.id} onClick={() => { const n = { ...playerState, currentSongId: s.id, isPlaying: true, progress: 0, timestamp: Date.now() }; setPlayerState(n); syncService.syncPlayer(n); }} className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all cursor-pointer ${activeSong?.id === s.id ? `${theme.borderColor} bg-current/5` : 'border-transparent hover:bg-current/5'}`}>
            <img src={s.coverUrl} className={`w-10 h-10 rounded-lg object-cover border-2 ${theme.borderColor} ${activeSong?.id === s.id ? '' : 'grayscale opacity-40'}`} />
            <div className="flex-1 min-w-0"><span className="block text-[10px] font-black uppercase truncate tracking-tight">Signal: {s.title}</span><span className="block text-[7px] font-black opacity-30 uppercase">Synced Stream</span></div>
          </div>
        ))}
      </div>
    </div>
  );
};
