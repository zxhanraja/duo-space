
import React, { useState, useEffect } from 'react';
import { GameState, User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/syncService';

interface GameProps {
  currentUser: User;
}

const MEMORY_SYMBOLS = ['🍎', '🍌', '🍇', '🍒', '🍓', '🥝', '🫐', '🥥', '🍍', '🥭', '🍑', '🍋'];
const RPS_MAP = { rock: '✊', paper: '✋', scissors: '✌️' };
const HANGMAN_WORDS = ['COFFEE', 'SPACE', 'GALAXY', 'DREAMS', 'REMOTE', 'VIRTUAL', 'SYNC', 'PLANET', 'MUSIC', 'SYSTEM', 'COUPLE', 'SECRET'];
const DUEL_WORDS = ['VELOCITY', 'CYBERSPACE', 'QUANTUM', 'SATELLITE', 'NEBULAS', 'ENCRYPTION', 'PROTOCOL', 'INFINITY'];

export const GameHub: React.FC<GameProps> = ({ currentUser }) => {
  const { theme } = useTheme();
  const [session, setSession] = useState<GameState>({ 
    type: 'none', status: 'lobby', turn: 'user_1', winner: null,
    sessionScores: { user_1: 0, user_2: 0 }, lastStarterId: 'user_1'
  });

  useEffect(() => {
    const startState = syncService.getState().game;
    if (startState) setSession(startState);
    const killGame = syncService.subscribe('game_update', (next: GameState) => setSession(next));
    const killFull = syncService.subscribe('full_sync', (state: any) => { if (state.game) setSession(state.game); });
    return () => { killGame(); killFull(); };
  }, []);

  const syncUpdate = (patch: Partial<GameState>) => {
    const next = { ...session, ...patch } as GameState;
    setSession(next);
    syncService.updateGame(next);
  };

  const calculateGlobalScore = (winId: string | null) => {
    const scores = { ...(session.sessionScores || { user_1: 0, user_2: 0 }) };
    if (winId && winId !== 'draw') scores[winId] = (scores[winId] || 0) + 1;
    return scores;
  };

  const backToLobby = () => syncUpdate({ type: 'none', status: 'lobby', winner: null, board: [], rpsChoices: {} });

  const playAgain = () => {
    const nextStarter = (session.lastStarterId || 'user_1') === 'user_1' ? 'user_2' : 'user_1';
    if (session.type === 'tictactoe') initTicTacToe(nextStarter);
    else if (session.type === 'memory') initMemory(nextStarter);
    else if (session.type === 'gomoku') initGomoku(nextStarter);
    else if (session.type === 'rps') initRPS();
    else if (session.type === 'hangman') initHangman(nextStarter);
    else if (session.type === 'wordduel') initWordDuel();
  };

  const initTicTacToe = (t: string) => syncUpdate({ type: 'tictactoe', status: 'playing', board: Array(9).fill(null), turn: t, winner: null, lastStarterId: t });
  const initMemory = (t: string) => {
    const cardsSet = [...MEMORY_SYMBOLS].slice(0, 8);
    const shuffled = [...cardsSet, ...cardsSet].sort(() => Math.random() - 0.5);
    syncUpdate({ type: 'memory', status: 'playing', turn: t, winner: null, lastStarterId: t, memoryCards: shuffled.map((c, i) => ({ id: i, content: c, isFlipped: false, isMatched: false })), memoryScores: { user_1: 0, user_2: 0 }, memoryFlippedIndices: [] });
  };
  const initGomoku = (t: string) => syncUpdate({ type: 'gomoku', status: 'playing', board: Array(100).fill(null), turn: t, winner: null, lastStarterId: t });
  const initRPS = () => syncUpdate({ type: 'rps', status: 'playing', rpsChoices: { user_1: null, user_2: null }, winner: null });
  const initHangman = (t: string) => {
    const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    syncUpdate({ type: 'hangman', status: 'playing', turn: t, word, guessedLetters: [], maxLives: 6, winner: null, lastStarterId: t });
  };
  const initWordDuel = () => {
    const word = DUEL_WORDS[Math.floor(Math.random() * DUEL_WORDS.length)];
    syncUpdate({ type: 'wordduel', status: 'playing', duelTarget: word, duelProgress: { user_1: '', user_2: '' }, winner: null });
  };

  const handleTTTClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    newBoard[i] = currentUser.id === 'user_1' ? 'X' : 'O';
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let win = null;
    for (let [a,b,c] of lines) if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) win = newBoard[a] === 'X' ? 'user_1' : 'user_2';
    if (!win && newBoard.every(c => c)) win = 'draw';
    syncUpdate({ board: newBoard, turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1', winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
  };

  const handleMemoryClick = (idx: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id) return;
    const cards = [...(session.memoryCards || [])];
    const flipped = [...(session.memoryFlippedIndices || [])];
    if (cards[idx].isFlipped || cards[idx].isMatched || flipped.length >= 2) return;
    cards[idx].isFlipped = true;
    const nextFlipped = [...flipped, idx];
    if (nextFlipped.length === 2) {
      const [f, s] = nextFlipped;
      if (cards[f].content === cards[s].content) {
        cards[f].isMatched = true; cards[s].isMatched = true;
        const mScores = { ...(session.memoryScores || { user_1: 0, user_2: 0 }), [currentUser.id]: (session.memoryScores?.[currentUser.id] || 0) + 1 };
        const allMatched = cards.every(c => c.isMatched);
        let win = allMatched ? (mScores.user_1 > mScores.user_2 ? 'user_1' : (mScores.user_2 > mScores.user_1 ? 'user_2' : 'draw')) : null;
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: [], memoryScores: mScores, winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
      } else {
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
        setTimeout(() => {
          const revert = [...cards]; revert[f].isFlipped = false; revert[s].isFlipped = false;
          syncUpdate({ memoryCards: revert, memoryFlippedIndices: [], turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1' });
        }, 800);
      }
    } else syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
  };

  const handleRPS = (choice: 'rock' | 'paper' | 'scissors') => {
    if (session.rpsChoices?.[currentUser.id]) return;
    const choices = { ...(session.rpsChoices || { user_1: null, user_2: null }), [currentUser.id]: choice };
    const both = !!(choices.user_1 && choices.user_2);
    let win = null;
    if (both) {
      const c1 = choices.user_1!, c2 = choices.user_2!;
      if (c1 === c2) win = 'draw';
      else if ((c1==='rock' && c2==='scissors') || (c1==='paper' && c2==='rock') || (c1==='scissors' && c2==='paper')) win = 'user_1';
      else win = 'user_2';
    }
    syncUpdate({ rpsChoices: choices, winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
  };

  const handleWordDuel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (session.status !== 'playing') return;
    const val = e.target.value.toUpperCase();
    const progress = { ...(session.duelProgress || { user_1: '', user_2: '' }), [currentUser.id]: val };
    let win = val === session.duelTarget ? currentUser.id : null;
    syncUpdate({ duelProgress: progress, winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
  };

  const handleGomokuClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    const symbol = currentUser.id === 'user_1' ? 'B' : 'W';
    newBoard[i] = symbol;
    const s = 10, r = Math.floor(i/s), c = i%s, dirs = [[1,0],[0,1],[1,1],[1,-1]];
    let win = false;
    for(let [dr,dc] of dirs){
      let count = 1;
      for(let d=1; d<5; d++){ const nr=r+dr*d, nc=c+dc*d; if(nr<0||nr>=s||nc<0||nr>=s||newBoard[nr*s+nc]!==symbol) break; count++; }
      for(let d=1; d<5; d++){ const nr=r-dr*d, nc=c-dc*d; if(nr<0||nr>=s||nc<0||nr>=s||newBoard[nr*s+nc]!==symbol) break; count++; }
      if(count>=5) win = true;
    }
    const winId = win ? currentUser.id : (newBoard.every(x => x) ? 'draw' : null);
    syncUpdate({ board: newBoard, turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1', winner: winId, status: winId ? 'ended' : 'playing', sessionScores: winId ? calculateGlobalScore(winId) : session.sessionScores });
  };

  const handleHangmanGuess = (l: string) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.guessedLetters?.includes(l)) return;
    const word = session.word || "";
    const guessed = [...(session.guessedLetters || []), l];
    const lives = !word.includes(l) ? (session.maxLives || 6) - 1 : (session.maxLives || 6);
    const win = word.split('').every(ch => guessed.includes(ch)) ? currentUser.id : (lives <= 0 ? (currentUser.id === 'user_1' ? 'user_2' : 'user_1') : null);
    syncUpdate({ guessedLetters: guessed, maxLives: lives, turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1', winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
  };

  if (session.type === 'none') return (
    <div className="h-full w-full flex flex-col items-center justify-start p-4 text-center">
      <h1 className="text-4xl md:text-7xl font-black italic mb-2 tracking-tighter">SELECT GAME</h1>
      <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em] mb-8">Competitive Mesh Active</p>
      <div className="w-full max-w-5xl grid grid-cols-2 grid-rows-3 gap-4 h-full max-h-[600px]">
        {[
          { icon: '❌', label: 'TIC-TAC-TOE', color: 'text-red-500', fn: () => initTicTacToe('user_1') },
          { icon: '❓', label: 'MEMORY', color: 'text-pink-500', fn: () => initMemory('user_1') },
          { icon: '▦', label: 'GOMOKU', color: 'text-zinc-500', fn: () => initGomoku('user_1') },
          { icon: '✊', label: 'R-P-S', color: 'text-yellow-500', fn: initRPS },
          { icon: '🪦', label: 'HANGMAN', color: 'text-purple-500', fn: () => initHangman('user_1') },
          { icon: '⚡', label: 'WORD DUEL', color: 'text-cyan-400', fn: initWordDuel },
        ].map((g, idx) => (
          <button key={idx} onClick={g.fn} className={`flex flex-col items-center justify-center rounded-[2.5rem] border-[4px] ${theme.borderColor} ${theme.cardBg} hover:-translate-y-1 transition-all active:scale-95 shadow-[4px_4px_0_0_#000]`}>
            <span className={`text-5xl sm:text-7xl mb-2 ${g.color}`}>{g.icon}</span>
            <span className="text-[12px] sm:text-[18px] font-black italic uppercase">{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex justify-between items-center p-4 border-b-2 border-current/10 bg-current/[0.03]">
        <div className="flex gap-8">
          <div className="text-left"><p className="text-[8px] opacity-30 font-black uppercase">Me</p><p className="text-2xl font-black italic">{session.sessionScores?.[currentUser.id] || 0}</p></div>
          <div className="text-left"><p className="text-[8px] opacity-30 font-black uppercase">Peer</p><p className="text-2xl font-black italic">{session.sessionScores?.[currentUser.id === 'user_1' ? 'user_2' : 'user_1'] || 0}</p></div>
        </div>
        <div className={`px-5 py-1.5 border-2 ${theme.borderColor} rounded-full bg-white text-black font-black text-[10px] uppercase flex items-center gap-2`}>
          <div className={`w-2 h-2 rounded-full ${session.turn === currentUser.id ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          {session.turn === currentUser.id ? 'Your Turn' : 'Waiting...'}
        </div>
        <button onClick={backToLobby} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 text-white font-black text-xl shadow-lg active:scale-90">×</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-current/[0.01]">
        {session.type === 'tictactoe' && (
          <div className="grid grid-cols-3 gap-4 w-full max-w-[400px] aspect-square">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleTTTClick(i)} className={`aspect-square border-[6px] ${theme.borderColor} ${theme.cardBg} flex items-center justify-center text-6xl sm:text-8xl font-black rounded-[2rem] active:scale-95 transition-all`}>
                <span className={cell === 'X' ? 'text-red-500' : 'text-blue-500'}>{cell}</span>
              </button>
            ))}
          </div>
        )}
        {session.type === 'memory' && (
          <div className="grid grid-cols-4 gap-3 w-full max-w-[480px]">
            {session.memoryCards?.map((card, i) => (
              <button key={i} onClick={() => handleMemoryClick(i)} className={`aspect-square border-4 ${theme.borderColor} flex items-center justify-center text-4xl rounded-2xl transition-all duration-500 ${card.isFlipped || card.isMatched ? 'bg-white text-black rotate-0 opacity-100' : 'bg-black/20 text-transparent rotate-180 opacity-40'}`}>
                {card.isFlipped || card.isMatched ? card.content : ''}
              </button>
            ))}
          </div>
        )}
        {session.type === 'rps' && (
          <div className="flex flex-col items-center gap-12">
            <div className="flex gap-6">
              {(['rock', 'paper', 'scissors'] as const).map(c => (
                <button key={c} onClick={() => handleRPS(c)} className={`w-28 h-28 sm:w-40 sm:h-40 flex flex-col items-center justify-center rounded-[3rem] border-8 ${theme.borderColor} ${session.rpsChoices?.[currentUser.id] === c ? 'bg-green-500 text-white translate-y-2' : 'bg-white text-black hover:-translate-y-2'} shadow-2xl transition-all`}>
                  <span className="text-6xl">{RPS_MAP[c]}</span>
                </button>
              ))}
            </div>
            {session.status === 'ended' && (
              <div className="flex items-center gap-20 text-9xl animate-in zoom-in duration-500">
                <div className="bg-white p-10 rounded-[4rem] border-8 border-black text-black">{RPS_MAP[session.rpsChoices?.user_1 as keyof typeof RPS_MAP]}</div>
                <div className="bg-white p-10 rounded-[4rem] border-8 border-black text-black">{RPS_MAP[session.rpsChoices?.user_2 as keyof typeof RPS_MAP]}</div>
              </div>
            )}
          </div>
        )}
        {session.type === 'wordduel' && (
          <div className="w-full max-w-lg space-y-8 text-center">
            <h2 className="text-6xl sm:text-9xl font-black text-cyan-400 italic uppercase">{session.duelTarget}</h2>
            <input type="text" autoFocus value={session.duelProgress?.[currentUser.id] || ''} onChange={handleWordDuel} placeholder="TYPE NOW!" className="w-full bg-black/10 border-b-8 border-current p-6 text-4xl sm:text-7xl font-black text-center uppercase outline-none" />
          </div>
        )}
        {session.type === 'hangman' && (
          <div className="flex flex-col items-center gap-12">
            <div className="text-3xl font-black">LIVES: {Array(session.maxLives).fill('❤️').join('')}</div>
            <div className="flex gap-4">
              {session.word?.split('').map((ch, i) => (
                <div key={i} className="w-10 h-16 border-b-8 border-current flex items-center justify-center text-4xl font-black">{session.guessedLetters?.includes(ch) ? ch : ''}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').map(l => (
                <button key={l} onClick={() => handleHangmanGuess(l)} disabled={session.guessedLetters?.includes(l) || session.turn !== currentUser.id} className={`w-10 h-10 font-black rounded-lg border-2 ${session.guessedLetters?.includes(l) ? 'opacity-10' : `${theme.borderColor} ${theme.cardBg} hover:bg-current hover:text-inherit`}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {session.status === 'ended' && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in duration-500">
          <h1 className="text-7xl sm:text-[12rem] font-black text-white italic uppercase tracking-tighter leading-none mb-10 animate-bounce">
            {session.winner === 'draw' ? 'DRAW' : (session.winner === currentUser.id ? 'VICTORY' : 'DEFEAT')}
          </h1>
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button onClick={playAgain} className="w-full bg-white text-black py-6 rounded-[2rem] font-black uppercase text-xl shadow-2xl active:scale-95">Rematch</button>
            <button onClick={backToLobby} className="w-full border-4 border-white/20 text-white/50 py-6 rounded-[2rem] font-black uppercase text-xl hover:text-white transition-all">Exit Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
};
