
import React, { useState, useEffect, useRef } from 'react';
import { PlayerState, Song } from '../types';
import { useTheme } from '../context/ThemeContext';
import { GlassPanel } from '../components/GlassPanel';
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
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  };

  useEffect(() => {
    const state = syncService.getState();
    setQueue(state.playlist || []);
    if (state.player?.currentSongId) reconcilePlayer(state.player);

    const killPlayer = syncService.subscribe('player_update', reconcilePlayer);
    const killPlaylist = syncService.subscribe('playlist_update', setQueue);
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
    const syncedProgress = remote.isPlaying ? remote.progress + (now - remote.timestamp) / 1000 : remote.progress;
    setPlayerState({ ...remote, progress: syncedProgress });

    setTimeout(() => {
      if (remote.isPlaying) {
        sendYTCommand('playVideo');
        sendYTCommand('seekTo', [syncedProgress, true]);
      } else {
        sendYTCommand('pauseVideo');
      }
    }, 500);
  };

  const handleToggle = () => {
    const next: PlayerState = { 
      ...playerState, 
      isPlaying: !playerState.isPlaying, 
      currentSongId: playerState.currentSongId || (queue.length > 0 ? queue[0].id : null),
      timestamp: Date.now()
    };
    setPlayerState(next);
    syncService.syncPlayer(next);
  };

  const addToSpace = () => {
    const vId = urlInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
    if (!vId) return;
    const newSong: Song = { 
      id: `s_${Date.now()}`, 
      title: 'RADIO_SIGNAL', 
      artist: 'DUO_SPACE', 
      url: vId, 
      type: 'youtube', 
      coverUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`, 
      addedBy: 'user', 
      duration: 0 
    };
    const next = [newSong, ...queue].slice(0, 10);
    setQueue(next);
    syncService.updatePlaylist(next);
    setUrlInput('');
    if (!playerState.currentSongId) {
      const pState = { ...playerState, currentSongId: newSong.id, isPlaying: true, timestamp: Date.now() };
      setPlayerState(pState);
      syncService.syncPlayer(pState);
    }
  };

  return (
    <GlassPanel className="h-full flex flex-col min-h-0 border-none shadow-none p-0 overflow-hidden" title="AUDIO NODE 🎧">
      <div className="absolute opacity-0 pointer-events-none w-0 h-0">
        {activeSong && (
          <iframe ref={iframeRef} key={activeSong.id} src={`https://www.youtube.com/embed/${activeSong.url}?enablejsapi=1&autoplay=1&controls=0&mute=0&rel=0`} />
        )}
      </div>

      {/* MICRO HUB: Height reduced to h-10/h-12 */}
      <div className="flex gap-1.5 mb-4 h-10 md:h-12">
        {/* Input Area (65%) */}
        <div className={`flex-[6.5] flex border-2 ${theme.borderColor} rounded-lg overflow-hidden bg-current/[0.03]`}>
          <input 
            value={urlInput} 
            onChange={e => setUrlInput(e.target.value)} 
            placeholder="LINK..." 
            className="flex-1 min-w-0 bg-transparent px-2 text-[7px] font-black focus:outline-none placeholder:opacity-20 uppercase" 
          />
          <button onClick={addToSpace} className="px-2 bg-black text-white text-[6px] font-black uppercase">ADD</button>
        </div>

        {/* Control Box (35%) */}
        <div className={`flex-[3.5] flex items-center gap-1 p-1 rounded-lg border-2 ${theme.borderColor} ${theme.cardBg} shadow-sm overflow-hidden`}>
           <button onClick={handleToggle} className="w-7 md:w-8 h-full bg-black text-white rounded-md flex items-center justify-center text-[10px] active:scale-90 transition-transform">
             {playerState.isPlaying ? '❙❙' : '▶'}
           </button>
           
           {/* Micro Disc Box */}
           <div className={`w-7 md:w-8 h-full shrink-0 rounded-md border border-current/10 bg-black flex items-center justify-center overflow-hidden`}>
              <div className={`w-full h-full rounded-full border border-white/5 ${playerState.isPlaying ? 'animate-spin-slow' : 'grayscale opacity-30 scale-90'}`}>
                {activeSong ? <img src={activeSong.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-900" />}
              </div>
           </div>
        </div>
      </div>

      {/* Minimal Label */}
      <div className="px-1 mb-3 flex items-center justify-between">
         <div className="min-w-0 flex-1">
            <span className="block text-[6px] font-black opacity-30 uppercase tracking-[0.2em]">NOW_LINK</span>
            <span className="block text-[7px] font-black uppercase truncate">{activeSong?.title || 'STANDBY'}</span>
         </div>
         {playerState.isPlaying && <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1">
        {queue.map(s => (
          <div 
            key={s.id} 
            onClick={() => {
              const next = { ...playerState, currentSongId: s.id, isPlaying: true, timestamp: Date.now() };
              setPlayerState(next); syncService.syncPlayer(next);
            }} 
            className={`flex items-center gap-1.5 p-1 rounded-md border transition-all cursor-pointer ${activeSong?.id === s.id ? `${theme.borderColor} bg-current/5` : 'border-transparent hover:bg-current/5'}`}
          >
            <div className="relative shrink-0">
               <img src={s.coverUrl} className={`w-6 h-6 rounded object-cover border border-current/5 ${activeSong?.id === s.id ? '' : 'grayscale opacity-30'}`} />
            </div>
            <span className="flex-1 text-[6.5px] font-black uppercase truncate tracking-tight">{s.title}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
};
