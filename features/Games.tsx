
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

  // Locally track the starter of the current match to alternate for equality on next match
  const [currentMatchStarter, setCurrentMatchStarter] = useState<string>('user_1');

  useEffect(() => {
    const startState = syncService.getState().game;
    if (startState) setSession(startState);
    const killGame = syncService.subscribe('game_update', (next: GameState) => setSession(next));
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
    const scores = { ...(session.sessionScores || { user_1: 0, user_2: 0 }) };
    if (winnerId && winnerId !== 'draw') {
      scores[winnerId] = (scores[winnerId] || 0) + 1;
    }
    return scores;
  };

  const backToLobby = () => syncUpdate({ type: 'none', status: 'lobby', winner: null, board: [], rpsChoices: {} });

  const playAgain = () => {
    // EQUALITY LOGIC: Always alternate the starting player for the next round
    const nextFirstTurn = currentMatchStarter === 'user_1' ? 'user_2' : 'user_1';
    setCurrentMatchStarter(nextFirstTurn);

    if (session.type === 'tictactoe') initTicTacToe(nextFirstTurn);
    else if (session.type === 'memory') initMemory(nextFirstTurn);
    else if (session.type === 'gomoku') initGomoku(nextFirstTurn);
    else if (session.type === 'rps') initRPS();
  };

  const initTicTacToe = (t: string) => syncUpdate({ type: 'tictactoe', status: 'playing', board: Array(9).fill(null), turn: t, winner: null });
  const initMemory = (t: string) => {
    const cards = [...MEMORY_SYMBOLS].slice(0, 8);
    const shuffled = [...cards, ...cards].sort(() => Math.random() - 0.5);
    syncUpdate({
      type: 'memory', status: 'playing', turn: t, winner: null,
      memoryCards: shuffled.map((c, i) => ({ id: i, content: c, isFlipped: false, isMatched: false })),
      memoryScores: { user_1: 0, user_2: 0 },
      memoryFlippedIndices: []
    });
  };
  const initGomoku = (t: string) => syncUpdate({ type: 'gomoku', status: 'playing', board: Array(100).fill(null), turn: t, winner: null });
  const initRPS = () => syncUpdate({ type: 'rps', status: 'playing', rpsChoices: { user_1: null, user_2: null }, winner: null });

  const handleTTTClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    newBoard[i] = currentUser.id === 'user_1' ? 'X' : 'O';

    const winLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    let winnerId = null;
    for (let [a, b, c] of winLines) if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) winnerId = newBoard[a] === 'X' ? 'user_1' : 'user_2';
    if (!winnerId && newBoard.every(c => c)) winnerId = 'draw';

    syncUpdate({
      board: newBoard,
      turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1',
      winner: winnerId,
      status: winnerId ? 'ended' : 'playing',
      sessionScores: winnerId ? updateGlobalScore(winnerId) : session.sessionScores
    });
  };

  const handleMemoryClick = (idx: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id) return;
    const cards = [...(session.memoryCards || [])];
    const flipped = [...(session.memoryFlippedIndices || [])];

    if (cards[idx].isFlipped || cards[idx].isMatched || flipped.length >= 2) return;

    // Optimistic local flip
    cards[idx].isFlipped = true;
    const nextFlipped = [...flipped, idx];

    if (nextFlipped.length === 2) {
      const [f, s] = nextFlipped;
      if (cards[f].content === cards[s].content) {
        // MATCH FOUND
        cards[f].isMatched = true; cards[s].isMatched = true;
        const mScores = { ...(session.memoryScores || { user_1: 0, user_2: 0 }) };
        mScores[currentUser.id] = (mScores[currentUser.id] || 0) + 1;

        const allMatched = cards.every(c => c.isMatched);
        let winner = allMatched ? (mScores.user_1 > mScores.user_2 ? 'user_1' : (mScores.user_2 > mScores.user_1 ? 'user_2' : 'draw')) : null;

        syncUpdate({
          memoryCards: cards, memoryFlippedIndices: [], memoryScores: mScores,
          winner, status: winner ? 'ended' : 'playing',
          sessionScores: winner ? updateGlobalScore(winner) : session.sessionScores
        });
      } else {
        // NO MATCH: Show both, then flip back after delay
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
        setTimeout(() => {
          const revertCards = [...cards];
          revertCards[f].isFlipped = false;
          revertCards[s].isFlipped = false;
          syncUpdate({
            memoryCards: revertCards,
            memoryFlippedIndices: [],
            turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1'
          });
        }, 1000);
      }
    } else {
      syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
    }
  };

  const handleGomokuClick = (i: number) => {
    if (session.status !== 'playing' || session.turn !== currentUser.id || session.board?.[i]) return;
    const newBoard = [...(session.board || [])];
    const symbol = currentUser.id === 'user_1' ? 'B' : 'W';
    newBoard[i] = symbol;

    const checkWin = (idx: number) => {
      const s = 10, r = Math.floor(idx / s), c = idx % s, dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
      for (let [dr, dc] of dirs) {
        let count = 1;
        for (let d = 1; d < 5; d++) { const nr = r + dr * d, nc = c + dc * d; if (nr < 0 || nr >= s || nc < 0 || nc >= s || newBoard[nr * s + nc] !== symbol) break; count++; }
        for (let d = 1; d < 5; d++) { const nr = r - dr * d, nc = c - dc * d; if (nr < 0 || nr >= s || nc < 0 || nc >= s || newBoard[nr * s + nc] !== symbol) break; count++; }
        if (count >= 5) return true;
      }
      return false;
    };

    const winId = checkWin(i) ? currentUser.id : (newBoard.every(x => x) ? 'draw' : null);
    syncUpdate({
      board: newBoard,
      turn: currentUser.id === 'user_1' ? 'user_2' : 'user_1',
      winner: winId,
      status: winId ? 'ended' : 'playing',
      sessionScores: winId ? updateGlobalScore(winId) : session.sessionScores
    });
  };

  const handleRPS = (choice: 'rock' | 'paper' | 'scissors') => {
    if (session.rpsChoices?.[currentUser.id]) return;
    const choices = { ...(session.rpsChoices || { user_1: null, user_2: null }), [currentUser.id]: choice };
    const bothPicked = !!(choices.user_1 && choices.user_2);

    let winner = null;
    if (bothPicked) {
      const c1 = choices.user_1!, c2 = choices.user_2!;
      if (c1 === c2) winner = 'draw';
      else if ((c1 === 'rock' && c2 === 'scissors') || (c1 === 'paper' && c2 === 'rock') || (c1 === 'scissors' && c2 === 'paper')) winner = 'user_1';
      else winner = 'user_2';
    }

    syncUpdate({
      rpsChoices: choices,
      winner: winner,
      status: winner ? 'ended' : 'playing',
      sessionScores: winner ? updateGlobalScore(winner) : session.sessionScores
    });
  };

  if (session.type === 'none') return (
    <GlassPanel className="h-full flex flex-col items-center justify-center p-4 text-center border-none shadow-none" title="Gaming Lounge">
      <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
        {[
          { icon: '❌', label: 'TicTacToe', fn: () => initTicTacToe('user_1') },
          { icon: '❓', label: 'Memory', fn: () => initMemory('user_1') },
          { icon: '▦', label: 'Gomoku', fn: () => initGomoku('user_1') },
          { icon: '✊', label: 'R-P-S', fn: initRPS }
        ].map(g => (
          <button key={g.label} onClick={g.fn} className={`${theme.buttonStyle} py-3 flex flex-col items-center gap-1 rounded-lg active:scale-95`}>
            <span className="text-xl">{g.icon}</span>
            <span className="text-[6px] font-black uppercase tracking-widest">{g.label}</span>
          </button>
        ))}
      </div>
    </GlassPanel>
  );

  return (
    <GlassPanel className="h-full flex flex-col relative overflow-hidden border-none shadow-none p-0" title={`${session.type.toUpperCase()} PROTOCOL`}>
      <div className="flex justify-between items-center p-2 border-b-2 border-current/10 bg-current/[0.02] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[5px] font-black opacity-30">Me: {session.sessionScores?.user_1 || 0}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[5px] font-black opacity-30">Peer: {session.sessionScores?.user_2 || 0}</span>
          </div>
        </div>

        <div className={`px-2 py-0.5 border border-current/20 rounded-full text-[6px] font-black uppercase flex items-center gap-1.5`}>
          <div className={`w-1 h-1 rounded-full ${session.turn === currentUser.id ? 'bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]' : 'bg-red-500'}`}></div>
          {session.turn === currentUser.id ? 'My Turn' : 'Wait'}
        </div>

        <button onClick={backToLobby} className="text-sm opacity-30">×</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden bg-current/[0.01]">
        {session.type === 'tictactoe' && (
          <div className="grid grid-cols-3 gap-1.5 w-full max-w-[180px] aspect-square">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleTTTClick(i)} className={`aspect-square border-2 ${theme.borderColor} ${theme.cardBg} flex items-center justify-center text-xl font-black rounded-lg active:scale-95`}>
                <span className={cell === 'X' ? 'text-red-500' : 'text-blue-500'}>{cell}</span>
              </button>
            ))}
          </div>
        )}
        {session.type === 'memory' && (
          <div className="grid grid-cols-4 gap-1 w-full max-w-[240px] aspect-square">
            {session.memoryCards?.map((card, i) => (
              <button key={i} onClick={() => handleMemoryClick(i)} className={`aspect-square border border-current/20 flex items-center justify-center text-lg rounded-lg transition-all ${card.isFlipped || card.isMatched ? 'bg-white text-black' : 'bg-black/20 text-transparent'}`}>
                {card.isFlipped || card.isMatched ? card.content : ''}
              </button>
            ))}
          </div>
        )}
        {session.type === 'gomoku' && (
          <div className="grid grid-cols-10 gap-0 w-full max-w-[280px] aspect-square border border-black/40 bg-zinc-300">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleGomokuClick(i)} className={`aspect-square border border-black/5 flex items-center justify-center`}>
                {cell && <div className={`w-[80%] h-[80%] rounded-full ${cell === 'B' ? 'bg-black' : 'bg-white shadow'}`}></div>}
              </button>
            ))}
          </div>
        )}
        {session.type === 'rps' && (
          <div className="flex flex-col items-center gap-4 w-full">
            {session.status === 'playing' ? (
              <div className="flex gap-2">
                {(['rock', 'paper', 'scissors'] as const).map(c => (
                  <button key={c} onClick={() => handleRPS(c)} className={`${theme.buttonStyle} w-16 h-16 flex flex-col items-center justify-center rounded-xl border ${session.rpsChoices?.[currentUser.id] === c ? 'bg-green-500 text-white' : ''} active:scale-95`}>
                    <span className="text-3xl">{RPS_MAP[c]}</span>
                    <span className="text-[6px] font-black uppercase">{c}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-6 text-5xl animate-in zoom-in">
                <div className="bg-white p-4 rounded-2xl border-2 border-black">{RPS_MAP[session.rpsChoices?.user_1 as keyof typeof RPS_MAP]}</div>
                <div className="text-lg font-black opacity-10">VS</div>
                <div className="bg-white p-4 rounded-2xl border-2 border-black">{RPS_MAP[session.rpsChoices?.user_2 as keyof typeof RPS_MAP]}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {session.status === 'ended' && (
        <div className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-2xl">
          <h1 className="text-4xl font-black text-white italic mb-6 uppercase tracking-tighter">
            {session.winner === 'draw' ? 'STALEMATE' : (session.winner === currentUser.id ? 'VICTORY' : 'DEFEAT')}
          </h1>
          <div className="flex flex-col gap-2 w-44">
            <button onClick={playAgain} className="bg-white text-black py-3 rounded-lg font-black uppercase text-[8px] active:scale-95 transition-all">Re-Link Console</button>
            <button onClick={backToLobby} className="border border-white/20 text-white py-3 rounded-lg font-black uppercase text-[8px] hover:bg-white/5">Exit to Lobby</button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
};