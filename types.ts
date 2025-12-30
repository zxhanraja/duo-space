
export type ThemeId = 'light' | 'dark' | 'soft' | 'cyberpunk' | 'minimalist' | 'ocean' | 'espresso' | 'midnight' | 'emerald' | 'amber' | 'berry';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  bgGradient: string;
  glassPanel: string;
  accentColor: string;
  textColor: string;
  secondaryTextColor: string;
  buttonStyle: string;
  fontMain: string;
  fontNote: string;
  borderColor: string;
  glowColor: string;
  cardBg: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  lastSeen?: number;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'reaction' | 'system' | 'ai_suggestion' | 'meme';
  metadata?: {
    sentiment?: 'positive' | 'neutral' | 'negative' | 'chaotic';
    replyToId?: string;
    vibeImpact?: number;
  };
}

export interface Note {
  id: string;
  content: string;
  x: number;
  y: number;
  rotation: number;
  color: string;
  lastEditedBy: string;
  timestamp: number;
  zIndex: number;
  isPinned?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  url: string;
  type: 'youtube' | 'mp3';
  addedBy: string;
}

export interface PlayerState {
  currentSongId: string | null;
  isPlaying: boolean;
  progress: number;
  timestamp: number;
  syncLocked: boolean;
  masterId: string | null;
}

export interface MemoryCard {
  id: number;
  content: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface GameState {
  type: 'none' | 'tictactoe' | 'memory' | 'gomoku' | 'rps' | 'hangman' | 'wordduel';
  status: 'lobby' | 'playing' | 'ended';
  turn: string;
  winner: string | null;
  board?: (string | null)[];
  memoryCards?: MemoryCard[];
  memoryScores?: Record<string, number>;
  memoryFlippedIndices?: number[];
  rpsChoices?: Record<string, 'rock' | 'paper' | 'scissors' | null>;
  sessionScores?: Record<string, number>;
  lastStarterId?: string;
  // Game specific
  word?: string;
  guessedLetters?: string[];
  maxLives?: number;
  duelTarget?: string;
  duelProgress?: Record<string, string>;
}

export type ToolType = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface DrawingLine {
  id: string;
  points: Point[];
  color: string;
  width: number;
  type: ToolType;
  opacity: number;
  timestamp: number;
}

export interface SpaceState {
  vibe: string;
  intensity: number;
  isLocked: boolean;
  lastSync: number;
  moodColor: string;
}
