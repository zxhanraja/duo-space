
import { ThemeConfig, Song, User, ThemeId } from './types';

export const USERS: User[] = [
  { id: 'user_1', name: 'Felix (Me)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix', status: 'online' },
  { id: 'user_2', name: 'Aneka (Bestie)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka', status: 'offline' }
];

export const THEMES: Record<ThemeId, ThemeConfig> = {
  light: {
    id: 'light',
    name: 'Paper White',
    bgGradient: 'bg-zinc-100',
    glassPanel: 'bg-white backdrop-blur-md border-[2.5px] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
    accentColor: 'text-black',
    textColor: 'text-black',
    secondaryTextColor: 'text-zinc-800',
    glowColor: 'rgba(0,0,0,0.4)',
    cardBg: 'bg-white',
    buttonStyle: 'bg-white text-black border-[2.5px] border-black hover:bg-black hover:text-white transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase text-[9px]',
    fontMain: 'font-sans',
    fontNote: 'font-mono',
    borderColor: 'border-black'
  },
  dark: {
    id: 'dark',
    name: 'Neo Tokyo',
    bgGradient: 'bg-[#0a0a0a]',
    glassPanel: 'bg-zinc-900/60 backdrop-blur-xl border-2 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.05)]',
    accentColor: 'text-purple-400',
    textColor: 'text-zinc-100',
    secondaryTextColor: 'text-zinc-400',
    glowColor: 'rgba(168,85,247,0.4)',
    cardBg: 'bg-zinc-900',
    buttonStyle: 'bg-zinc-800 text-white border border-white/20 hover:bg-white hover:text-black transition-all font-black uppercase text-[9px]',
    fontMain: 'font-mono',
    fontNote: 'font-mono',
    borderColor: 'border-white/20'
  },
  soft: {
    id: 'soft',
    name: 'Matcha Bliss',
    bgGradient: 'bg-[#f0f4f0]',
    glassPanel: 'bg-[#e0e8e0]/90 backdrop-blur-md border border-[#4a5d4a]/30 shadow-lg',
    accentColor: 'text-[#2d3a2d]',
    textColor: 'text-[#1a231a]',
    secondaryTextColor: 'text-[#4a5d4a]',
    glowColor: 'rgba(74,93,74,0.2)',
    cardBg: 'bg-[#e0e8e0]',
    buttonStyle: 'bg-[#c8d6c8] text-[#1a231a] border border-[#4a5d4a]/30 hover:bg-[#b0c4b0] font-black uppercase text-[9px]',
    fontMain: 'font-sans',
    fontNote: 'font-handwriting',
    borderColor: 'border-[#4a5d4a]/20'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Night City',
    bgGradient: 'bg-[#000000]',
    glassPanel: 'bg-black/80 border-2 border-yellow-400 shadow-[4px_4px_20px_rgba(250,204,21,0.5)]',
    accentColor: 'text-yellow-400',
    textColor: 'text-cyan-400',
    secondaryTextColor: 'text-pink-500',
    glowColor: 'rgba(250,204,21,0.6)',
    cardBg: 'bg-zinc-950',
    buttonStyle: 'bg-yellow-400 text-black font-black hover:bg-cyan-400 transition-all font-black uppercase text-[9px]',
    fontMain: 'font-mono',
    fontNote: 'font-mono',
    borderColor: 'border-yellow-400'
  },
  minimalist: {
    id: 'minimalist',
    name: 'Empty Room',
    bgGradient: 'bg-white',
    glassPanel: 'bg-transparent border-b-2 border-zinc-200',
    accentColor: 'text-zinc-900',
    textColor: 'text-zinc-800',
    secondaryTextColor: 'text-zinc-400',
    glowColor: 'rgba(0,0,0,0.05)',
    cardBg: 'bg-white',
    buttonStyle: 'text-zinc-900 border-zinc-900 border p-2 hover:bg-zinc-900 hover:text-white font-black uppercase text-[9px]',
    fontMain: 'font-sans',
    fontNote: 'font-sans',
    borderColor: 'border-zinc-200'
  }
};

export const INITIAL_PLAYLIST: Song[] = [];
