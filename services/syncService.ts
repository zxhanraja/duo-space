
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Message, Note, PlayerState, GameState, Song, DrawingLine, SpaceState } from '../types';

const getSupabaseConfig = () => {
  try {
    const metaEnv = (import.meta as any).env || {};
    const procEnv = (process.env as any) || {};
    const envUrl = (metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || '').trim();
    const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY || metaEnv.VITE_SUPABASE_KEY || procEnv.VITE_SUPABASE_KEY || procEnv.SUPABASE_ANON_KEY || '').trim();
    return { url: envUrl, key: envKey, isDetected: envUrl.startsWith('http') && envKey.length > 20 };
  } catch (e) { return { url: '', key: '', isDetected: false }; }
};

class SyncService {
  private supabase: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private localBus: BroadcastChannel | null = null;
  private listeners: Record<string, Function[]> = {};
  private statusListeners: Function[] = [];
  private myUserId: string = '';
  private currentRoomCode: string = '';
  private isPeerOnline: boolean = false;
  private isConnected: boolean = false;
  private reconnectInterval: any = null;

  private state = {
    messages: [] as Message[],
    notes: [] as Note[],
    playlist: [] as Song[],
    player: { currentSongId: null, isPlaying: false, progress: 0, timestamp: Date.now(), syncLocked: true, masterId: null } as PlayerState,
    game: { type: 'none', status: 'lobby', turn: 'user_1', winner: null, board: [], sessionScores: { user_1: 0, user_2: 0 } } as GameState,
    drawing: [] as DrawingLine[],
    space: { vibe: 'Chilling 🧊', intensity: 1, isLocked: false, lastSync: Date.now(), moodColor: '#ffffff' } as SpaceState
  };

  constructor() {
    this.initSession();
    if (typeof window !== 'undefined') {
      setTimeout(() => this.setupCommunication(), 0);
    }
  }

  private initSession() {
    try {
      this.myUserId = localStorage.getItem('duo_v5_uid') || `u_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('duo_v5_uid', this.myUserId);
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get('room');
      const savedRoom = localStorage.getItem('duo_last_room');
      this.currentRoomCode = (urlRoom || savedRoom || 'SYNC-NOW').toUpperCase();
      localStorage.setItem('duo_last_room', this.currentRoomCode);
      if (!urlRoom) {
        window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}?room=${this.currentRoomCode}`);
      }
    } catch (e) { this.currentRoomCode = 'SYNC-NOW'; }
  }

  private async fetchHistory() {
    if (!this.supabase) return;
    const { data } = await this.supabase
      .from('messages')
      .select('*')
      .eq('room_id', this.currentRoomCode)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      this.state.messages = data.map(m => ({
        id: m.id,
        senderId: m.sender_id,
        text: m.text,
        timestamp: new Date(m.created_at).getTime(),
        type: m.type as any
      }));
      this.notify('full_sync', this.state);
    }
  }

  private setupCommunication() {
    try {
      this.localBus = new BroadcastChannel(`duospace_v5_${this.currentRoomCode}`);
      this.localBus.onmessage = (event) => this.handleIncoming(event.data);
    } catch (e) { }

    const config = getSupabaseConfig();
    if (config.isDetected) {
      this.supabase = createClient(config.url, config.key);
      this.connectWithRetry();
      this.fetchHistory();
    } else {
      this.emitPresence();
    }
  }

  private connectWithRetry() {
    if (!this.supabase) return;
    if (this.channel) this.supabase.removeChannel(this.channel);

    this.channel = this.supabase.channel(`room_${this.currentRoomCode}`, {
      config: { presence: { key: this.myUserId } }
    });

    this.channel
      .on('broadcast', { event: 'sync' }, ({ payload }) => this.handleIncoming(payload))
      .on('presence', { event: 'sync' }, () => {
        const presenceState = this.channel?.presenceState() || {};
        const onlineCount = Object.keys(presenceState).length;
        this.isPeerOnline = onlineCount > 1;
        this.emitPresence();
      })
      .subscribe(status => {
        this.isConnected = status === 'SUBSCRIBED';
        this.emitPresence();
        if (this.isConnected) {
          clearInterval(this.reconnectInterval);
          this.broadcast('REQUEST_SYNC', null);
          this.channel?.track({ online_at: new Date().toISOString() });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => this.connectWithRetry(), 5000);
          }
        }
      });
  }

  private handleIncoming(envelope: any) {
    if (!envelope || envelope.senderId === this.myUserId) return;
    const { type, payload } = envelope;

    if (type === 'REQUEST_SYNC') this.broadcastFullState();
    if (type === 'FULL_SYNC_PAYLOAD') { this.state = { ...this.state, ...payload }; this.notify('full_sync', this.state); }
    if (type === 'MSG') { this.state.messages.push(payload); this.notify('message', payload); }
    if (type === 'SHAKE') this.notify('nudge_event', null);
    if (type === 'PLAY') { this.state.player = payload; this.notify('player_update', payload); }
    if (type === 'NOTE') { this.state.notes = payload; this.notify('note_update', payload); }
    if (type === 'GAME') { this.state.game = payload; this.notify('game_update', payload); }
    if (type === 'DRAW') { this.state.drawing.push(payload); this.notify('draw_line', payload); }
    if (type === 'CLR') { this.state.drawing = []; this.notify('clear_canvas', null); }
    if (type === 'PLST') { this.state.playlist = payload; this.notify('playlist_update', payload); }
    if (type === 'THEME') this.notify('theme_change', payload);
    if (type === 'TYPING') this.notify('typing_status', payload);
  }

  private async broadcast(type: string, payload: any) {
    const envelope = { type, payload, senderId: this.myUserId, ts: Date.now() };
    if (this.channel && this.isConnected) this.channel.send({ type: 'broadcast', event: 'sync', payload: envelope });
    if (this.localBus) this.localBus.postMessage(envelope);

    // Persist messages to DB if type is MSG
    if (type === 'MSG' && this.supabase) {
      await this.supabase.from('messages').insert({
        room_id: this.currentRoomCode,
        sender_id: payload.senderId,
        text: payload.text,
        type: payload.type
      });
    }
  }

  public broadcastFullState() { this.broadcast('FULL_SYNC_PAYLOAD', this.state); }
  public sendMessage(msg: Message) { this.state.messages.push(msg); this.broadcast('MSG', msg); }
  public sendShake() { this.broadcast('SHAKE', null); }
  public syncPlayer(player: PlayerState) { this.state.player = player; this.broadcast('PLAY', player); }
  public updateNotes(notes: Note[]) { this.state.notes = notes; this.broadcast('NOTE', notes); }
  public updateGame(game: GameState) { this.state.game = game; this.broadcast('GAME', game); }
  public sendVector(line: DrawingLine) { this.state.drawing.push(line); this.broadcast('DRAW', line); }
  public clearCanvas() { this.state.drawing = []; this.broadcast('CLR', null); }
  public pushTheme(id: string) { this.broadcast('THEME', id); }
  public sendTyping(isTyping: boolean) { this.broadcast('TYPING', { userId: this.myUserId, isTyping }); }
  public updatePlaylist(playlist: Song[]) { this.state.playlist = playlist; this.broadcast('PLST', playlist); }

  public subscribe(event: string, cb: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return () => { this.listeners[event] = this.listeners[event].filter(l => l !== cb); };
  }

  private notify(event: string, payload: any) {
    if (this.listeners[event]) this.listeners[event].forEach(cb => { try { cb(payload); } catch (e) { } });
  }

  public subscribeToStatus(cb: Function) {
    this.statusListeners.push(cb);
    this.emitPresence();
    return () => { this.statusListeners = this.statusListeners.filter(l => l !== cb); };
  }

  private emitPresence() {
    this.statusListeners.forEach(cb => { try { cb(this.isPeerOnline, this.currentRoomCode, this.isConnected); } catch (e) { } });
  }

  public getState() { return this.state; }
  public getRoom() { return this.currentRoomCode; }
}

export const syncService = new SyncService();