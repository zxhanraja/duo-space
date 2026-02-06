
import React, { useState, useEffect } from 'react';
import { GameState, User } from '../types';
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
    type: 'none', status: 'lobby', turn: 'user_1', winner: null,
    sessionScores: { user_1: 0, user_2: 0 }, lastStarterId: 'user_1'
  });

  useEffect(() => {
    const startState = syncService.getState().game;
    if (startState) setSession(startState);
    const killGame = syncService.subscribe('game_update', (next: GameState) => setSession(next));
    const killFull = syncService.subscribe('full_sync', (state: any) => { if (state.game) setSession(state.game); });
    // Fix: Removed undefined 'killTyping' call which was likely a copy-paste artifact from the Chat feature's useEffect
    return () => { killGame(); killFull(); };
  }, []);

  const syncUpdate = (patch: Partial<GameState>) => {
    const next = { ...session, ...patch } as GameState;
    setSession(next);
    syncService.updateGame(next);
  };

  const calculateGlobalScore = (winId: string | null) => {
    const scores = { ...(session.sessionScores || {}) };
    if (winId && winId !== 'draw') scores[winId] = (scores[winId] || 0) + 1;
    return scores;
  };

  const backToLobby = () => syncUpdate({ type: 'none', status: 'lobby', winner: null, board: [], rpsChoices: {} });

  const playAgain = () => {
    // If I was the starter last time, let the peer start (by setting turn to 'PEER')
    // If 'PEER' started, I start.
    // Actually, simple rotation: Swap based on who started previous session.
    // For now, let's just default to current user restarts or keep same starter.
    // Better: Winner starts? Or Alternate.
    // Let's keep it simple: The person clicking 'Rematch' starts the new game.
    const starter = currentUser.id;
    if (session.type === 'tictactoe') initTicTacToe(starter);
    else if (session.type === 'memory') initMemory(starter);
    else if (session.type === 'rps') initRPS();
    else if (session.type === 'hangman') initHangman(starter);
  };

  // Turn Logic: 'PEER' is a wildcard for "Not the Host"
  // If turn == lastStarterId -> Host's turn
  // If turn == 'PEER' -> Peer's turn
  const isMyTurn = session.turn === currentUser.id || (session.turn === 'PEER' && currentUser.id !== session.lastStarterId);
  const getNextTurn = () => (currentUser.id === session.lastStarterId ? 'PEER' : session.lastStarterId!);

  const initTicTacToe = (t: string) => syncUpdate({ type: 'tictactoe', status: 'playing', board: Array(9).fill(null), turn: t, winner: null, lastStarterId: t });

  const initMemory = (t: string) => {
    const cardsSet = [...MEMORY_SYMBOLS].slice(0, 8);
    const shuffled = [...cardsSet, ...cardsSet].sort(() => Math.random() - 0.5);
    syncUpdate({ type: 'memory', status: 'playing', turn: t, winner: null, lastStarterId: t, memoryCards: shuffled.map((c, i) => ({ id: i, content: c, isFlipped: false, isMatched: false })), memoryScores: {}, memoryFlippedIndices: [] });
  };

  const initRPS = () => syncUpdate({ type: 'rps', status: 'playing', rpsChoices: {}, winner: null });

  const handleTTTClick = (i: number) => {
    if (session.status !== 'playing' || !isMyTurn || session.board?.[i]) return;

    const newBoard = [...(session.board || [])];
    newBoard[i] = currentUser.id === session.lastStarterId ? 'X' : 'O'; // Host is always X

    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    let win = null;
    for (let [a, b, c] of lines) if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) win = currentUser.id;

    if (!win && newBoard.every(c => c)) win = 'draw';

    syncUpdate({
      board: newBoard,
      turn: win ? session.turn : getNextTurn(),
      winner: win,
      status: win ? 'ended' : 'playing',
      sessionScores: win ? calculateGlobalScore(win) : session.sessionScores
    });
  };

  const handleMemoryClick = (idx: number) => {
    if (session.status !== 'playing' || !isMyTurn) return;
    const cards = [...(session.memoryCards || [])];
    const flipped = [...(session.memoryFlippedIndices || [])];
    if (cards[idx].isFlipped || cards[idx].isMatched || flipped.length >= 2) return;

    cards[idx].isFlipped = true;
    const nextFlipped = [...flipped, idx];

    if (nextFlipped.length === 2) {
      const [f, s] = nextFlipped;
      if (cards[f].content === cards[s].content) {
        cards[f].isMatched = true; cards[s].isMatched = true;
        const mScores = { ...(session.memoryScores || {}), [currentUser.id]: (session.memoryScores?.[currentUser.id] || 0) + 1 };

        const allMatched = cards.every(c => c.isMatched);
        // Calculate winner based on scores
        let win = null;
        if (allMatched) {
          const myScore = mScores[currentUser.id] || 0;
          const peerId = Object.keys(mScores).find(id => id !== currentUser.id);
          const peerScore = peerId ? (mScores[peerId] || 0) : 0;
          win = myScore > peerScore ? currentUser.id : (peerScore > myScore ? peerId : 'draw');
        }

        syncUpdate({ memoryCards: cards, memoryFlippedIndices: [], memoryScores: mScores, winner: win, status: win ? 'ended' : 'playing', sessionScores: win && typeof win === 'string' ? calculateGlobalScore(win) : session.sessionScores });
      } else {
        syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
        setTimeout(() => {
          const revert = [...cards]; revert[f].isFlipped = false; revert[s].isFlipped = false;
          syncUpdate({ memoryCards: revert, memoryFlippedIndices: [], turn: getNextTurn() });
        }, 800);
      }
    } else syncUpdate({ memoryCards: cards, memoryFlippedIndices: nextFlipped });
  };

  const handleRPS = (choice: 'rock' | 'paper' | 'scissors') => {
    if (session.rpsChoices?.[currentUser.id]) return;
    const choices = { ...(session.rpsChoices || {}), [currentUser.id]: choice };
    const playerIds = Object.keys(choices);
    const both = playerIds.length === 2;

    let win = null;
    if (both) {
      const p1 = playerIds[0];
      const p2 = playerIds[1];
      const c1 = choices[p1];
      const c2 = choices[p2];

      if (c1 === c2) win = 'draw';
      else if ((c1 === 'rock' && c2 === 'scissors') || (c1 === 'paper' && c2 === 'rock') || (c1 === 'scissors' && c2 === 'paper')) win = p1;
      else win = p2;
    }
    syncUpdate({ rpsChoices: choices, winner: win, status: win ? 'ended' : 'playing', sessionScores: win ? calculateGlobalScore(win) : session.sessionScores });
  };

  const HANGMAN_WORDS = ['REACT', 'TYPESCRIPT', 'TAILWIND', 'COMPONENT', 'HOOK', 'STATE', 'EFFECT', 'SUPABASE', 'VITE', 'DEBUG', 'COMPILE', 'RENDER', 'INTERFACE', 'PROMISE', 'ASYNC', 'AWAIT'];

  const initHangman = (t: string) => {
    const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    syncUpdate({ type: 'hangman', status: 'playing', turn: t, winner: null, lastStarterId: t, word: word, guessedLetters: [], maxLives: 6 });
  };

  const handleHangmanGuess = (letter: string) => {
    if (session.status !== 'playing' || !isMyTurn || session.type !== 'hangman') return;
    if ((session.guessedLetters || []).includes(letter)) return;

    const nextGuessed = [...(session.guessedLetters || []), letter];
    const word = session.word || '';
    const wrongGuesses = nextGuessed.filter(l => !word.includes(l)).length;

    let win: string | null = null;
    let status: 'playing' | 'ended' = 'playing';

    const isWin = word.split('').every(l => nextGuessed.includes(l));
    const isLoss = wrongGuesses >= (session.maxLives || 6);

    if (isWin) {
      win = currentUser.id; // Correct guesser wins? Or shared? Let's say last guesser wins.
      status = 'ended';
    } else if (isLoss) {
      win = getNextTurn(); // Opponent wins if we run out of lives
      status = 'ended';
    }

    syncUpdate({
      guessedLetters: nextGuessed,
      turn: status === 'ended' ? session.turn : getNextTurn(),
      winner: win,
      status: status,
      sessionScores: win ? calculateGlobalScore(win) : session.sessionScores
    });
  };

  if (session.type === 'none') return (
    <div className="h-full flex flex-col items-center justify-start py-4">
      <h1 className="text-4xl md:text-6xl font-black italic mb-2 tracking-tighter uppercase">SELECT GAME</h1>
      <p className="text-[9px] font-black opacity-30 uppercase tracking-[0.4em] mb-10">COMPETITIVE MESH ACTIVE</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-3xl px-2">
        {[
          { icon: '❌', label: 'TIC-TAC-TOE', color: 'text-red-500', fn: () => initTicTacToe(currentUser.id) },
          { icon: '❓', label: 'MEMORY', color: 'text-pink-500', fn: () => initMemory(currentUser.id) },
          { icon: '✊', label: 'R-P-S', color: 'text-yellow-500', fn: initRPS },
          { icon: '🪦', label: 'HANGMAN', color: 'text-purple-500', fn: () => initHangman(currentUser.id) },
        ].map((g, idx) => (
          <button key={idx} onClick={g.fn} className={`flex flex-col items-center justify-center p-6 rounded-[2rem] border-4 ${theme.borderColor} ${theme.cardBg} hover:-translate-y-1 active:scale-95 transition-all shadow-[4px_4px_0_0_#000]`}>
            <span className={`text-5xl mb-2 ${g.color}`}>{g.icon}</span>
            <span className="text-[12px] font-black italic uppercase">{g.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative max-w-4xl mx-auto overflow-hidden bg-inherit">
      <div className="flex justify-between items-center p-3 border-b-2 border-current/10 bg-current/[0.03] rounded-t-3xl">
        <div className="flex gap-6">
          <div className="text-left">
            <p className="text-[8px] opacity-30 font-black uppercase">Me</p>
            <p className="text-xl font-black italic">{session.sessionScores?.[currentUser.id] || 0}</p>
          </div>
          <div className="text-left">
            <p className="text-[8px] opacity-30 font-black uppercase">Peer</p>
            <p className="text-xl font-black italic">
              {Object.entries(session.sessionScores || {}).find(([k]) => k !== currentUser.id)?.[1] || 0}
            </p>
          </div>
        </div>
        <button onClick={backToLobby} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500 text-white font-black text-xl active:scale-90">×</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
        {session.type === 'tictactoe' && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-[320px] aspect-square">
            {session.board?.map((cell, i) => (
              <button key={i} onClick={() => handleTTTClick(i)} className={`aspect-square border-[6px] ${theme.borderColor} ${theme.cardBg} flex items-center justify-center text-6xl font-black rounded-[2rem] active:scale-95 shadow-md`}>
                <span className={cell === 'X' ? 'text-red-500' : 'text-blue-500'}>{cell}</span>
              </button>
            ))}
          </div>
        )}
        {session.type === 'memory' && (
          <div className="grid grid-cols-4 gap-2 w-full max-w-[360px]">
            {session.memoryCards?.map((card, i) => (
              <button key={i} onClick={() => handleMemoryClick(i)} className={`aspect-square border-4 ${theme.borderColor} flex items-center justify-center text-2xl rounded-2xl transition-all duration-500 ${card.isFlipped || card.isMatched ? 'bg-white text-black opacity-100' : 'bg-black/20 text-transparent opacity-40'}`}>
                {card.isFlipped || card.isMatched ? card.content : ''}
              </button>
            ))}
          </div>
        )}
        {session.type === 'rps' && (
          <div className="flex flex-col items-center gap-12">
            <div className="flex gap-4">
              {(['rock', 'paper', 'scissors'] as const).map(c => (
                <button key={c} onClick={() => handleRPS(c)} className={`w-28 h-28 flex flex-col items-center justify-center rounded-[2.5rem] border-8 ${theme.borderColor} ${session.rpsChoices?.[currentUser.id] === c ? 'bg-green-500 text-white' : 'bg-white text-black'} shadow-xl active:scale-95 transition-all`}>
                  <span className="text-5xl">{RPS_MAP[c]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {session.type === 'hangman' && (
          <div className="flex flex-col items-center w-full max-w-2xl gap-8">
            <div className="flex flex-col items-center">
              <div className="text-6xl mb-4 text-red-500">
                {['❤️', '❤️❤️', '❤️❤️❤️', '❤️❤️❤️❤️', '❤️❤️❤️❤️❤️', '❤️❤️❤️❤️❤️❤️', '❤️❤️❤️❤️❤️❤️❤️'][6 - (session.guessedLetters?.filter(l => !session.word?.includes(l)).length || 0)] || '💀'}
              </div>
              <div className="flex gap-2 flex-wrap justify-center mb-8">
                {session.word?.split('').map((char, i) => (
                  <div key={i} className={`w-10 h-12 md:w-14 md:h-16 border-b-4 ${theme.borderColor} flex items-end justify-center text-3xl md:text-5xl font-black uppercase`}>
                    {session.guessedLetters?.includes(char) ? char : ''}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-1 flex-wrap justify-center max-w-md">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
                const isGuessed = session.guessedLetters?.includes(letter);
                const isRight = session.word?.includes(letter);
                return (
                  <button
                    key={letter}
                    disabled={isGuessed || session.turn !== currentUser.id}
                    onClick={() => handleHangmanGuess(letter)}
                    className={`w-8 h-10 md:w-10 md:h-12 rounded-lg font-black text-sm md:text-lg transition-all ${isGuessed
                      ? (isRight ? 'bg-green-500 text-white opacity-50' : 'bg-red-500 text-white opacity-20')
                      : `bg-current/10 hover:bg-current/20 ${session.turn === currentUser.id ? 'active:scale-90 cursor-pointer' : 'cursor-not-allowed opacity-50'}`
                      }`}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] font-black uppercase opacity-40 mt-4 tracking-widest">{session.turn === currentUser.id ? 'YOUR TURN' : 'OPPONENT TURN'}</p>
          </div>
        )}

        {session.status === 'ended' && (
          <div className="absolute inset-0 z-[50] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 rounded-3xl">
            <h1 className="text-6xl md:text-8xl font-black text-white italic uppercase tracking-tighter mb-10 text-center leading-none">
              {session.winner === 'draw' ? 'DRAW' : (session.winner === currentUser.id ? 'VICTORY' : 'DEFEAT')}
            </h1>
            {session.type === 'hangman' && <p className="text-white opacity-50 text-xl font-black uppercase mb-8 tracking-widest">WORD WAS: {session.word}</p>}
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button onClick={playAgain} className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase text-lg shadow-2xl active:scale-95">Rematch</button>
              <button onClick={backToLobby} className="w-full border-4 border-white/20 text-white/50 py-5 rounded-[2rem] font-black uppercase text-lg hover:text-white transition-all">Exit Lobby</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};