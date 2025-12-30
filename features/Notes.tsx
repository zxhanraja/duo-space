
import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { GlassPanel } from '../components/GlassPanel';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/syncService';

const NOTE_STYLES = [
  'bg-white text-black border-2 border-black',
  'bg-black text-white border-2 border-white',
];

export const NotesBoard: React.FC = () => {
  const { theme } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  // Use a ref for throttle/debounce syncing to avoid network spam on every pixel move
  const lastSyncTime = useRef<number>(0);

  useEffect(() => {
    // Initial load
    // Fixed: syncService.getNotesHistory() was not defined, using syncService.getState().notes
    setNotes(syncService.getState().notes);

    const unsub = syncService.subscribe('note_update', (updatedNotes: Note[]) => {
      // Only update from server if we are NOT currently dragging that specific note
      // This prevents jittering while dragging
      setNotes(prev => {
        if (!draggingId) return updatedNotes;
        
        // If we are dragging, we keep our local version of the dragged note
        // and merge it with server updates for OTHER notes
        const draggedNote = prev.find(n => n.id === draggingId);
        if (!draggedNote) return updatedNotes;

        return updatedNotes.map(serverNote => 
            serverNote.id === draggingId ? draggedNote : serverNote
        );
      });
    });
    return unsub;
  }, [draggingId]);

  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      content: 'Write here...',
      x: Math.random() * 40 + 30, // Center-ish
      y: Math.random() * 40 + 30,
      rotation: 0,
      color: NOTE_STYLES[Math.floor(Math.random() * NOTE_STYLES.length)],
      lastEditedBy: 'me',
      timestamp: Date.now(),
      // Added missing required zIndex property
      zIndex: 10
    };
    const updated = [...notes, newNote];
    setNotes(updated);
    syncService.updateNotes(updated);
  };

  const updateNoteContent = (id: string, text: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, content: text } : n);
    setNotes(updated);
    syncService.updateNotes(updated);
  };

  const deleteNote = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    syncService.updateNotes(updated);
  };

  // --- DRAG LOGIC ---
  const handleStartDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default browser dragging for images/text
    // e.stopPropagation(); 
    setDraggingId(id);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingId) return;

    // Get client coordinates (Touch or Mouse)
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    const container = e.currentTarget.getBoundingClientRect();
    
    // Calculate percentage position relative to container
    // Subtracting roughly half note size (approx 5%) to center drag
    let x = ((clientX - container.left) / container.width) * 100;
    let y = ((clientY - container.top) / container.height) * 100;

    // Boundaries
    x = Math.max(0, Math.min(90, x));
    y = Math.max(0, Math.min(90, y));

    // Optimistic UI Update
    const updated = notes.map(n => n.id === draggingId ? { ...n, x, y } : n);
    setNotes(updated);

    // Throttle Network Sync (Max once every 100ms)
    const now = Date.now();
    if (now - lastSyncTime.current > 100) {
        syncService.updateNotes(updated);
        lastSyncTime.current = now;
    }
  };

  const handleEndDrag = () => {
    if (draggingId) {
        // Final sync ensures exact position is saved
        syncService.updateNotes(notes);
        setDraggingId(null);
    }
  };

  return (
    <GlassPanel className="h-full relative overflow-hidden group touch-none" title="Notes (48h Expiring)">
       {/* Dot Grid */}
       <div className={`absolute inset-0 opacity-20 pointer-events-none`} 
            style={{ 
              backgroundImage: `radial-gradient(circle, ${theme.id === 'dark' ? '#fff' : '#000'} 1px, transparent 1px)`, 
              backgroundSize: '24px 24px' 
            }}>
       </div>

       {/* Drag Area Container */}
       <div 
         className="w-full h-full relative touch-none"
         onMouseMove={handleMove}
         onTouchMove={handleMove}
         onMouseUp={handleEndDrag}
         onMouseLeave={handleEndDrag}
         onTouchEnd={handleEndDrag}
       >
         {notes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none select-none">
               <p className={`text-xs uppercase font-bold ${theme.textColor}`}>Click + to add a sticky note</p>
            </div>
         )}

         {notes.map(note => (
           <div
             key={note.id}
             className={`absolute p-2 w-32 h-32 md:w-40 md:h-40 cursor-grab active:cursor-grabbing ${note.color} ${theme.fontNote} shadow-md touch-none select-none`}
             style={{ 
               left: `${note.x}%`, 
               top: `${note.y}%`, 
               zIndex: draggingId === note.id ? 50 : 10,
               transition: draggingId === note.id ? 'none' : 'all 0.2s ease-out'
             }}
             onMouseDown={(e) => handleStartDrag(note.id, e)}
             onTouchStart={(e) => handleStartDrag(note.id, e)}
           >
             <textarea
               className="w-full h-full bg-transparent resize-none border-none focus:ring-0 p-0 text-xs md:text-sm leading-tight focus:outline-none"
               value={note.content}
               onChange={(e) => updateNoteContent(note.id, e.target.value)}
               // Prevent drag when interacting with text area on touch devices specifically?
               // No, actually we want to drag by grabbing the border, but usually people grab anywhere.
               // We stop propagation on mouse down on textarea if we wanted text selection only.
             />
             <button 
               onClick={(e) => deleteNote(note.id, e)}
               onTouchEnd={(e) => deleteNote(note.id, e)}
               className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-xs border border-current hover:bg-current hover:text-inherit hover:invert z-20"
             >
               ×
             </button>
             {/* Expiry indicator (optional, just dot) */}
             <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-30 pointer-events-none" title="Expires in 48h"></div>
           </div>
         ))}
       </div>

       <button 
         onClick={addNote}
         className={`absolute bottom-4 right-4 ${theme.buttonStyle} rounded-full p-3 md:p-4 z-50 shadow-lg`}
       >
         <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
       </button>
    </GlassPanel>
  );
};
