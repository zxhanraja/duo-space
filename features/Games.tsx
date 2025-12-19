
import React, { useState, useEffect } from 'react';
import { GameState, User, MemoryCard } from '../types';
import { GlassPanel } from '../components/GlassPanel';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/syncService';

interface GameProps {
  currentUser: User;
}

const MEMORY_SYMBOLS = ['🍎', '🍌', '🍇', '🍒', '🍓', '🥝', '🫐', '🥥', '🍍', '🥭', '🍑', '🍋'];
const RPS_MAP = { rock: '✊', paper: '✋', scissors: '✌️' };

export const GameHub: React.FC<GameProps> = ({ currentUser }) => {
  const { theme } = useTheme();
  const [session, setSession] = useState<GameState>({ 
    type: 'none', 
    status: 'lobby', 
    turn: 'user_1', 
    winner: null,
    sessionScores: { user_1: 0, user_2: 0 }
  });

  useEffect(() => {
    const startState = syncService.getState().game;
    if (startState) setSession(startState);
    
    const killGame = syncService.subscribe('game_update', (next: GameState) => {
      setSession(next);
    });
    
    const killFull = syncService.subscribe('full_sync', (state: any) => {
      if (state.game) setSession(state.game);
    });

    return () => { killGame(); killFull(); };
  }, []);

  const syncUpdate = (patch: Partial<GameState>) => {
    const next = { ...session, ...patch } as GameState;
    setSession(next);
    syncService.updateGame(next);
  };

  const updateGlobalScore = (winnerId: string | null) => {
    if (!winnerId || winnerId === 'draw') return session.sessionScores;
    const scores = { ...session.sessionScores } || { user_1: 0, user_2: 0 };
    scores[winnerId] = (scores[winnerId] || 0) + 1;
    return scores;
  };

  const backToLobby = () => {
    syncUpdate({ type: 'none', status: 'lobby', winner: null, board: [], rpsChoices: {} });
  };

  const playAgain = () => {
    if (session.type === 'tictactoe') initTicTacToe();
    else if (session.type === 'memory') initMemory();
    else if (session.type === 'gomoku') initGomoku();
    else if (session.type === 'rps') initRPS();
  };

  // --- GAMES INIT ---
  const initTicTacToe = () => syncUpdate({ type: 'tictactoe', status: 'playing', board: Array(9).fill(null), turn: 'user_1', winner: null });
  const initMemory = () => {
    const cards = [...MEMORY_SYMBOLS].slice(0, 8);
    const shuffled = [...cards, ...cards].sort(() => Math.random() - 0.5);
    syncUpdate({ type: 'memory', status: 'playing', memoryCards: shuffled.map((c, i) => ({ id: i, content: c, isFlipped: false, isMatched: false })), memoryScores: { user_1: 0, user_2: 0 }, memoryFlippedIndices: [], turn: 'user_1', winner: null });
  };
  const initGomoku = () => syncUpdate({ type: 'gomoku', status: 'playing', board: Array(100).fill(null), turn: 'user_1', winner: null });
  const initRPS = () => syncUpdate({ type: 'rps', status: 'playing', rpsChoices: { user_1: null, user_2: null }, winner: null });

  // --- HANDLERS ---
  const handleTTTClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    newBoard[i] = currentUser.id === 'user_1' ? 'X' : 'O';
    const winLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winnerId = null;
    for (let [a,b,c] of winLines) if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) winnerId = newBoard[a] === 'X' ? 'user_1' : 'user_2';
    if (!winnerId && newBoard.every(c => c)) winnerId = 'draw';
    syncUpdate({ board: newBoard, turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1', winner: winnerId, status: winnerId ? 'ended' : 'playing', sessionScores: updateGlobalScore(winnerId) });
  };

  const handleMemoryClick = (idx: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id) return;
    const cards = [...(session.memoryCards || [])];
    const flipped = [...(session.memoryFlippedIndices || [])];
    if (cards[idx].isFlipped || cards[idx].isMatched || flipped.length >= 2) return;
    cards[idx].isFlipped = true;
    flipped.push(idx);
    if (flipped.length === 2) {
      const [f, s] = flipped;
      if (cards[f].content === cards[s].content) {
        cards[f].isMatched = true; cards[s].isMatched = true;
        const mScores = { ...session.memoryScores }; mScores[currentUser.id] = (mScores[currentUser.id] || 0) + 1;
        const allMatched = cards.every(c => c.isMatched);
        let winner = allMatched ? (mScores.user_1 > mScores.user_2 ? 'user_1' : (mScores.user_2 > mScores.user_1 ? 'user_2' : 'draw')) : null;
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: [], memoryScores: mScores, winner, status: winner ? 'ended' : 'playing', sessionScores: updateGlobalScore(winner) });
      } else {
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: flipped });
        setTimeout(() => {
          cards[f].isFlipped = false; cards[s].isFlipped = false;
          syncUpdate({ memoryCards: cards, memoryFlippedIndices: [], turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1' });
        }, 1000);
      }
    } else syncUpdate({ memoryCards: cards, memoryFlippedIndices: flipped });
  };

  const handleGomokuClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    const symbol = currentUser.id === 'user_1' ? 'B' : 'W';
    newBoard[i] = symbol;
    const checkWin = (idx: number) => {
      const s = 10, r = Math.floor(idx/s), c = idx%s, dirs = [[1,0],[0,1],[1,1],[1,-1]];
      for(let [dr,dc] of dirs){
        let count = 1;
        for(let d=1; d<5; d++){ const nr=r+dr*d, nc=c+dc*d; if(nr<0||nr>=s||nc<0||nc>=s||newBoard[nr*s+nc]!==symbol) break; count++; }
        for(let d=1; d<5; d++){ const nr=r-dr*d, nc=c-dc*d; if(nr<0||nr>=s||nc<0||nc>=s||newBoard[nr*s+nc]!==symbol) break; count++; }
        if(count>=5) return true;
      }
      return false;
    };
    const winId = checkWin(i) ? currentUser.id : (newBoard.every(x => x) ? 'draw' : null);
    syncUpdate({ board: newBoard, turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1', winner: winId, status: winId ? 'ended' : 'playing', sessionScores: updateGlobalScore(winId) });
  };

  const handleRPS = (choice: 'rock' | 'paper' | 'scissors') => {
    const choices = { ...(session.rpsChoices || { user_1: null, user_2: null }), [currentUser.id]: choice };
    const bothPicked = choices.user_1 && choices.user_2;
    let winner = null;
    if (bothPicked) {
      const c1 = choices.user_1, c2 = choices.user_2;
      if (c1 === c2) winner = 'draw';
      else if ((c1==='rock' && c2==='scissors') || (c1==='paper' && c2==='rock') || (c1==='scissors' && c2==='paper')) winner = 'user_1';
      else winner = 'user_2';
    }
    syncUpdate({ rpsChoices: choices, winner: winner, status: winner ? 'ended' : 'playing', sessionScores: updateGlobalScore(winner) });
  };

  if (session.type === 'none') return (
    <GlassPanel className="h-full flex flex-col items-center justify-center p-6 text-center" title="Gaming Lounge">
      <div className="mb-10">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Select Module</h2>
        <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Real-time Peer Interaction</p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {[
          { icon: '❌', label: 'TicTacToe', fn: initTicTacToe },
          { icon: '❓', label: 'Memory', fn: initMemory },
          { icon: '▦', label: 'Gomoku', fn: initGomoku },
          { icon: '✊', label: 'R-P-S', fn: initRPS }
        ].map(g => (
          <button key={g.label} onClick={g.fn} className={`${theme.buttonStyle} p-6 flex flex-col items-center gap-2 rounded-2xl border-[2.5px] active:scale-95 transition-all`}>
            <span className="text-3xl">{g.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{g.label}</span>
          </button>
        ))}
      </div>
    </GlassPanel>
  );

  return (
    <GlassPanel className="h-full flex flex-col relative" title={`${session.type.toUpperCase()} PROTOCOL`}>
      <div className="flex justify-between items-center p-3 border-b-[2px] border-current/10">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase opacity-40">Me</span>
            <span className="text-xl font-black">{session.sessionScores?.user_1 || 0}</span>
          </div>
          <div className="text-[10px] font-black opacity-20 italic">VS</div>
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black uppercase opacity-40">Peer</span>
            <span className="text-xl font-black">{session.sessionScores?.user_2 || 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className={`px-4 py-1.5 border-[2px] ${theme.borderColor} rounded-full text-[8px] font-black uppercase flex items-center gap-2`}>
              <div className={`w-2 h-2 rounded-full ${session.turn === currentUser.id ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              {session.turn === currentUser.id ? 'My Turn' : 'Waiting'}
           </div>
           <button onClick={backToLobby} className="w-8 h-8 flex items-center justify-center text-lg hover:bg-current/10 rounded-full transition-all">×</button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {session.type === 'tictactoe' && (
          <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] aspect-square">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleTTTClick(i)} className={`aspect-square border-[2px] ${theme.borderColor} ${theme.cardBg} flex items-center justify-center text-4xl font-black rounded-xl hover:bg-current/5 transition-all`}>
                <span className={cell === 'X' ? 'text-red-500' : 'text-blue-500'}>{cell}</span>
              </button>
            ))}
          </div>
        )}
        {session.type === 'memory' && (
          <div className="grid grid-cols-4 gap-2 w-full max-w-[320px]">
            {session.memoryCards?.map((card, i) => (
              <button key={i} onClick={() => handleMemoryClick(i)} className={`aspect-square border-[2px] ${theme.borderColor} flex items-center justify-center text-2xl rounded-lg transition-all shadow-sm ${card.isFlipped || card.isMatched ? 'bg-white text-black' : 'bg-zinc-800 text-transparent'}`}>
                {card.isFlipped || card.isMatched ? card.content : '?'}
              </button>
            ))}
          </div>
        )}
        {session.type === 'gomoku' && (
          <div className="grid grid-cols-10 gap-0 w-full max-w-[320px] aspect-square border-2 border-black bg-zinc-200">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleGomokuClick(i)} className={`aspect-square border border-black/10 flex items-center justify-center ${cell ? (cell==='B'?'bg-black text-white':'bg-white text-black') : 'hover:bg-black/5'}`}>
                {cell && '⬤'}
              </button>
            ))}
          </div>
        )}
        {session.type === 'rps' && (
          <div className="flex flex-col items-center gap-8 w-full max-w-sm">
             {session.status === 'playing' ? (
                <div className="flex gap-4">
                   {(['rock', 'paper', 'scissors'] as const).map(c => (
                     <button key={c} onClick={() => handleRPS(c)} className={`${theme.buttonStyle} w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-2xl border-[2.5px] ${session.rpsChoices?.[currentUser.id] === c ? 'bg-green-500 text-white' : ''}`}>
                        <span className="text-3xl">{RPS_MAP[c]}</span>
                        <span className="text-[8px] font-black uppercase">{c}</span>
                     </button>
                   ))}
                </div>
             ) : (
                <div className="flex items-center gap-10 text-6xl animate-in zoom-in duration-500">
                   <div className="flex flex-col items-center gap-4">
                      <span className="bg-white p-4 rounded-full border-4 border-black">{RPS_MAP[session.rpsChoices?.user_1 as keyof typeof RPS_MAP]}</span>
                      <span className="text-[9px] font-black opacity-30 uppercase">ME</span>
                   </div>
                   <div className="text-xl font-black italic opacity-10">VS</div>
                   <div className="flex flex-col items-center gap-4">
                      <span className="bg-white p-4 rounded-full border-4 border-black">{RPS_MAP[session.rpsChoices?.user_2 as keyof typeof RPS_MAP]}</span>
                      <span className="text-[9px] font-black opacity-30 uppercase">PEER</span>
                   </div>
                </div>
             )}
             {session.status === 'playing' && session.rpsChoices?.[currentUser.id] && (
               <div className="text-[9px] font-black uppercase tracking-[0.2em] animate-pulse">Waiting for Peer...</div>
             )}
          </div>
        )}
      </div>

      {session.status === 'ended' && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-3xl animate-in fade-in duration-300">
          <h1 className="text-5xl md:text-8xl font-black text-white italic mb-10 md:mb-14 uppercase tracking-tighter">
            {session.winner === 'draw' ? 'DRAW' : (session.winner === currentUser.id ? 'VICTORY' : 'PEER WON')}
          </h1>
          <div className="flex flex-col md:flex-row gap-3 md:gap-5 w-full max-w-[240px] md:max-w-none">
            <button onClick={playAgain} className="bg-white text-black py-4 md:px-12 md:py-5 font-black uppercase text-[10px] md:text-[11px] tracking-[0.2em] rounded-xl md:rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">Play Again</button>
            <button onClick={backToLobby} className="border-2 border-white/20 text-white py-4 md:px-12 md:py-5 font-black uppercase text-[10px] md:text-[11px] tracking-[0.2em] rounded-xl md:rounded-2xl hover:bg-white/5 transition-all">Lobby</button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
};
