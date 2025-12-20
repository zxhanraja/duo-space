
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
    // Strict sync: Calculate exact progress based on network latency
    const syncedProgress = remote.isPlaying ? remote.progress + (now - remote.timestamp) / 1000 : remote.progress;

    setPlayerState({ ...remote, progress: syncedProgress });

    // Force sync on remote device
    setTimeout(() => {
      if (remote.isPlaying) {
        sendYTCommand('seekTo', [syncedProgress, true]);
        sendYTCommand('playVideo');
      } else {
        sendYTCommand('pauseVideo');
      }
    }, 500);
  };

  const handleToggle = () => {
    const isNowPlaying = !playerState.isPlaying;
    const songToPlay = playerState.currentSongId || (queue.length > 0 ? queue[0].id : null);

    const next: PlayerState = {
      ...playerState,
      isPlaying: isNowPlaying,
      currentSongId: songToPlay,
      timestamp: Date.now()
    };

    setPlayerState(next);
    syncService.syncPlayer(next);

    if (isNowPlaying) sendYTCommand('playVideo');
    else sendYTCommand('pauseVideo');
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playerState.currentSongId);
    const nextIndex = (currentIndex + 1) % queue.length;
    const nextSong = queue[nextIndex];

    const next: PlayerState = {
      ...playerState,
      currentSongId: nextSong.id,
      progress: 0,
      isPlaying: true,
      timestamp: Date.now()
    };

    setPlayerState(next);
    syncService.syncPlayer(next);

    // Immediate local seek
    setTimeout(() => {
      sendYTCommand('seekTo', [0, true]);
      sendYTCommand('playVideo');
    }, 100);
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

    const next = [newSong, ...queue].slice(0, 15);
    setQueue(next);
    syncService.updatePlaylist(next);
    setUrlInput('');

    if (!playerState.currentSongId) {
      const pState = { ...playerState, currentSongId: newSong.id, isPlaying: true, timestamp: Date.now() };
      setPlayerState(pState);
      syncService.syncPlayer(pState);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <GlassPanel className="h-full flex flex-col min-h-0 border-none shadow-none p-0 overflow-hidden" title="AUDIO NODE 🎧">
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

      <div className="flex gap-1.5 mb-4 h-12 md:h-14">
        <div className={`flex-[6] flex border-2 ${theme.borderColor} rounded-xl overflow-hidden bg-current/[0.03]`}>
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="YT LINK..."
            className="flex-1 min-w-0 bg-transparent px-3 text-[8px] font-black focus:outline-none placeholder:opacity-20 uppercase"
          />
          <button onClick={addToSpace} className="px-3 bg-black text-white text-[7px] font-black uppercase active:bg-zinc-800 transition-colors">ADD</button>
        </div>

        <div className={`flex-[4] flex items-center gap-1.5 p-1 rounded-xl border-2 ${theme.borderColor} ${theme.cardBg} shadow-sm overflow-hidden`}>
          <button onClick={handleToggle} className="flex-1 h-full bg-black text-white rounded-lg flex items-center justify-center text-[10px] active:scale-90 transition-transform">
            {playerState.isPlaying ? '❙❙' : '▶'}
          </button>
          <button onClick={handleNext} className="flex-1 h-full bg-current/5 border border-current/10 rounded-lg flex items-center justify-center text-[10px] active:scale-90 transition-transform">
            ⏭️
          </button>
          <div className={`w-8 h-full shrink-0 rounded-lg border border-current/10 bg-black flex items-center justify-center overflow-hidden`}>
            <div className={`w-full h-full rounded-full border border-white/5 ${playerState.isPlaying ? 'animate-spin-slow' : 'grayscale opacity-30 scale-90'}`}>
              {activeSong ? <img src={activeSong.coverUrl} className="w-full h-full object-cover" alt="disc" /> : <div className="w-full h-full bg-zinc-900" />}
            </div>
          </div>
        </div>
      </div>

      <div className="px-1 mb-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <span className="block text-[6px] font-black opacity-30 uppercase tracking-[0.2em] mb-0.5">NOW_PLAYING</span>
          <span className="block text-[8px] font-black uppercase truncate italic">{activeSong?.title || 'STANDBY_MODE'}</span>
        </div>
        {playerState.isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></div>}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
        {queue.map(s => (
          <div
            key={s.id}
            onClick={() => {
              const next = { ...playerState, currentSongId: s.id, isPlaying: true, progress: 0, timestamp: Date.now() };
              setPlayerState(next);
              syncService.syncPlayer(next);
            }}
            className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer active:scale-[0.98] ${activeSong?.id === s.id ? `${theme.borderColor} bg-current/5` : 'border-transparent hover:bg-current/5'}`}
          >
            <img src={s.coverUrl} className={`w-7 h-7 rounded-md object-cover border border-current/5 ${activeSong?.id === s.id ? '' : 'grayscale opacity-30'}`} alt="T" />
            <span className="flex-1 text-[7px] font-black uppercase truncate tracking-tight">{s.title}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
};