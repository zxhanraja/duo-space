
import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from '../types';
import { useTheme } from '../context/ThemeContext';
import { GlassPanel } from '../components/GlassPanel';
import { syncService } from '../services/syncService';
import { GoogleGenAI } from "@google/genai";

interface ChatProps {
  currentUser: User;
}

const COUPLE_VIBE_EMOJIS = [
  '❤️', '💖', '😘', '🥰', '💏', '👩‍❤️', '🥺', '😭', '🌹', '🧸', '🤣', '💀', '😤', '😡', '🤔', '💤',
  '💍', '🫂', '💌', '🎁', '🍕', '🍿', '🍫', '🥂', '🍿', '🎡', '🏡', '🌙', '🪐', '✨', '🌈', '😻',
  '🙈', '🦋', '🐥', '🦊', '🤞', '🤌', '🔥', '🎀', '☁️', '🫧', '🍓', '🍒', '🍡', '🎮', '🎧', '📸'
];

export const Chat: React.FC<ChatProps> = ({ currentUser }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([...syncService.getState().messages]);
    const killMsg = syncService.subscribe('message', (msg: Message) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });
    const killTyping = syncService.subscribe('typing_status', (status: any) => {
      if (status.userId !== currentUser.id) setIsPeerTyping(status.isTyping);
    });
    const killFull = syncService.subscribe('full_sync', (state: any) => {
      if (state.messages) setMessages([...state.messages]);
    });
    return () => { killMsg(); killTyping(); killFull(); };
  }, [currentUser.id]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages, isPeerTyping]);

  const dispatchMessage = (textOverride?: string, type: Message['type'] = 'text') => {
    const text = textOverride || inputText;
    if (!text.trim()) return;
    const newMsg: Message = { 
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`, 
      senderId: type === 'ai_suggestion' ? 'system_ai' : currentUser.id, 
      text, 
      timestamp: Date.now(), 
      type 
    };
    setMessages(prev => [...prev, newMsg]);
    syncService.sendMessage(newMsg);
    if (!textOverride) setInputText('');
    syncService.sendTyping(false);
    if (textOverride) setShowEmojis(false); 
  };

  const getAiSuggestion = async () => {
    if (isAiLoading) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const recentHistory = messages.slice(-5).map(m => `${m.senderId === currentUser.id ? 'Self' : 'Peer'}: ${m.text}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Chat History:\n${recentHistory}\n\nSuggest one short, charming, or playful message for this couple. Only text.`,
        config: {
          systemInstruction: "You are a playful assistant for a couple. Keep it short.",
          temperature: 0.8,
        }
      });
      
      const suggestion = response.text?.trim();
      if (suggestion) dispatchMessage(suggestion, 'ai_suggestion');
    } catch (error) { console.error(error); } finally { setIsAiLoading(false); }
  };

  return (
    <GlassPanel className="h-full flex flex-col min-h-0 border-none shadow-none" title="SPACE TRANSMISSION 🛰️">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-1 space-y-3 mb-3 custom-scrollbar min-h-0">
        {messages.map((m) => {
          const isMe = m.senderId === currentUser.id;
          const isAi = m.type === 'ai_suggestion';
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`
                max-w-[85%] px-3 py-2.5 rounded-2xl text-[13px] md:text-[14px] border-2 shadow-sm
                ${isAi ? 'bg-purple-500/10 border-purple-500/30 italic text-purple-400' : 
                  isMe ? `bg-current/10 ${theme.textColor} ${theme.borderColor} rounded-tr-none` : 
                  `${theme.cardBg} ${theme.textColor} ${theme.borderColor} rounded-tl-none`}
              `}>
                {m.text}
              </div>
            </div>
          );
        })}
        {isPeerTyping && <div className="text-[8px] font-black opacity-30 animate-pulse uppercase px-1">Linking...</div>}
      </div>

      <div className="relative mt-auto">
        {showEmojis && (
          <div className={`absolute bottom-full mb-3 left-0 right-0 p-3 border-2 ${theme.borderColor} ${theme.cardBg} rounded-[1.5rem] shadow-2xl z-50 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-4`}>
            {COUPLE_VIBE_EMOJIS.map(e => (
              <button key={e} onClick={() => dispatchMessage(e)} className="aspect-square flex items-center justify-center bg-current/5 hover:bg-current/10 rounded-lg text-lg active:scale-90 transition-transform">{e}</button>
            ))}
          </div>
        )}

        <div className={`flex items-center border-2 ${theme.borderColor} rounded-full ${theme.cardBg} overflow-hidden h-12 md:h-14 shadow-md`}>
          <button onClick={() => setShowEmojis(!showEmojis)} className={`w-12 md:w-14 h-full flex items-center justify-center border-r-2 ${theme.borderColor} text-lg active:bg-current/10`}> 💌 </button>
          <input 
            type="text" value={inputText}
            onChange={(e) => { setInputText(e.target.value); syncService.sendTyping(e.target.value.length > 0); }}
            onKeyDown={(e) => e.key === 'Enter' && dispatchMessage()}
            placeholder="SIGNAL..."
            className="flex-1 min-w-0 bg-transparent px-4 text-[13px] font-black uppercase tracking-tight focus:outline-none placeholder:opacity-20"
          />
          <button 
            onClick={getAiSuggestion} 
            disabled={isAiLoading}
            className={`w-12 md:w-14 h-full flex items-center justify-center border-x-2 ${theme.borderColor} text-lg transition-all ${isAiLoading ? 'opacity-20 animate-spin' : 'hover:bg-current/5'}`}
          > {isAiLoading ? '🌀' : '✨'} </button>
          <button 
            onClick={() => dispatchMessage()} 
            className={`w-14 md:w-16 h-full flex items-center justify-center active:scale-95 transition-transform ${theme.buttonStyle} border-none shadow-none rounded-none`}
          >
            🚀
          </button>
        </div>
      </div>
    </GlassPanel>
  );
};
