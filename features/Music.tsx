
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
  const lastUpdateRef = useRef<number>(0);

  const activeSong = queue.find(s => s.id === playerState.currentSongId) || (queue.length > 0 ? queue[0] : null);

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

    const drift = (Date.now() - remote.timestamp) / 1000;
    const projectedProgress = remote.isPlaying ? remote.progress + drift : remote.progress;

    setPlayerState({ ...remote, progress: projectedProgress });
  };

  const handleToggle = () => {
    const isNowPlaying = !playerState.isPlaying;
    const songId = playerState.currentSongId || (queue.length > 0 ? queue[0].id : null);
    const next: PlayerState = { ...playerState, isPlaying: isNowPlaying, currentSongId: songId, timestamp: Date.now() };
    setPlayerState(next);
    syncService.syncPlayer(next);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === playerState.currentSongId);
    const nextSong = queue[(currentIndex + 1) % queue.length];
    const next: PlayerState = { ...playerState, currentSongId: nextSong.id, progress: 0, isPlaying: true, timestamp: Date.now() };
    setPlayerState(next);
    syncService.syncPlayer(next);
  };

  const addToSpace = () => {
    const vId = urlInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/)?.[1];
    if (!vId) return;
    const newSong: Song = { id: `s_${Date.now()}`, title: 'STATION_SIGNAL', artist: 'DUO_SPACE', url: vId, type: 'youtube', coverUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`, addedBy: 'user', duration: 0 };
    const next = [newSong, ...queue].slice(0, 5);
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
    <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-2 md:gap-8">

      {/* Search Input Row - Slim */}
      <div className={`w-full md:max-w-sm flex items-center border-2 ${theme.borderColor} ${theme.cardBg} rounded-xl h-9 md:h-11 overflow-hidden transition-all shadow-sm`}>
        <input
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          placeholder="YT LINK..."
          className="flex-1 bg-transparent px-3 text-[9px] font-black focus:outline-none placeholder:opacity-30 uppercase tracking-widest"
        />
        <button onClick={addToSpace} className={`h-full px-4 ${theme.buttonStyle} border-none shadow-none rounded-none border-l-2 ${theme.borderColor} text-[9px]`}>ADD</button>
      </div>

      {/* Controls & Track Info - Ultra Slim */}
      <div className="flex-1 flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button onClick={handleToggle} className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 ${theme.borderColor} bg-current/5 hover:bg-current/10 active:scale-90 transition-all text-xs`}>
            {playerState.isPlaying ? '❙❙' : '▶'}
          </button>
          <button onClick={handleNext} className={`w-9 h-9 flex items-center justify-center rounded-xl border-2 ${theme.borderColor} bg-current/5 hover:bg-current/10 active:scale-90 transition-all text-[10px]`}>
            ⏭️
          </button>
        </div>

        {/* Track Title - Responsive Hidden */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`w-8 h-8 rounded-full border-2 ${theme.borderColor} overflow-hidden shrink-0 ${playerState.isPlaying ? 'animate-spin-slow' : 'grayscale opacity-30'}`}>
            {activeSong ? <img src={activeSong.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-current/10" />}
          </div>
          <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-[180px]">
            <span className="text-[10px] font-black uppercase truncate leading-none mb-1">{activeSong?.title || 'SILENCE'}</span>
            <span className="text-[7px] opacity-40 font-black uppercase tracking-tighter">SIGNAL_SYNCED</span>
          </div>
        </div>

      </div>
    </div>
  );
};