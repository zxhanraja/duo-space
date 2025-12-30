
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GlassPanel } from '../components/GlassPanel';
import { useTheme } from '../context/ThemeContext';
import { syncService } from '../services/syncService';
import { DrawingLine, ToolType, Point } from '../types';

export const CanvasBoard: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  
  const currentLineRef = useRef<DrawingLine | null>(null);

  useEffect(() => {
    const history = syncService.getState().drawing;
    setLines(history);
    setColor(theme.id === 'light' || theme.id === 'soft' ? '#000000' : '#ffffff');
  }, [theme.id]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, line: DrawingLine) => {
    if (!line.points.length) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = line.width;
    ctx.strokeStyle = line.color;
    ctx.globalAlpha = line.opacity;

    if (line.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (line.type === 'rectangle') {
      if (line.points.length < 2) return;
      const start = line.points[0], end = line.points[line.points.length - 1];
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (line.type === 'circle') {
      if (line.points.length < 2) return;
      const start = line.points[0], end = line.points[line.points.length - 1];
      const radius = Math.sqrt(Math.pow(end.x-start.x, 2) + Math.pow(end.y-start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2*Math.PI);
      ctx.stroke();
    } else {
      ctx.moveTo(line.points[0].x, line.points[0].y);
      if (line.points.length < 3) {
        line.points.forEach(p => ctx.lineTo(p.x, p.y));
      } else {
        let i;
        for (i = 1; i < line.points.length - 2; i++) {
          const xc = (line.points[i].x + line.points[i+1].x) / 2;
          const yc = (line.points[i].y + line.points[i+1].y) / 2;
          ctx.quadraticCurveTo(line.points[i].x, line.points[i].y, xc, yc);
        }
        ctx.quadraticCurveTo(line.points[i].x, line.points[i].y, line.points[i+1].x, line.points[i+1].y);
      }
      ctx.stroke();
    }
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lines.forEach(line => drawLine(ctx, line));
    if (currentLineRef.current) drawLine(ctx, currentLineRef.current);
  }, [lines, drawLine]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      render();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  useEffect(() => {
    const unsub = syncService.subscribe('draw_line', (line: DrawingLine) => {
      setLines(prev => [...prev, line]);
    });
    const unsubClear = syncService.subscribe('clear_canvas', () => setLines([]));
    const unsubFull = syncService.subscribe('full_sync', (state: any) => {
      if (state.drawing) setLines(state.drawing);
    });
    return () => { unsub(); unsubClear(); unsubFull(); };
  }, []);

  useEffect(() => {
    render();
  }, [lines, render]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const p = getPoint(e);
    currentLineRef.current = {
      id: `l_${Date.now()}`,
      points: [p],
      color: tool === 'eraser' ? '#000000' : color,
      width: tool === 'eraser' ? 40 : brushSize,
      type: tool,
      opacity: 1,
      timestamp: Date.now()
    };
    render();
  };

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentLineRef.current) return;
    const p = getPoint(e);
    if (tool === 'rectangle' || tool === 'circle') {
      currentLineRef.current.points = [currentLineRef.current.points[0], p];
    } else {
      currentLineRef.current.points.push(p);
    }
    render();
  };

  const onEnd = () => {
    if (!isDrawing || !currentLineRef.current) return;
    setIsDrawing(false);
    const line = currentLineRef.current;
    if (line.points.length > 0) {
      setLines(prev => [...prev, line]);
      syncService.sendVector(line);
    }
    currentLineRef.current = null;
  };

  const clear = () => {
    setLines([]);
    syncService.clearCanvas();
  };

  return (
    <GlassPanel className="h-full flex flex-col relative overflow-hidden" title="Shared Canvas">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `radial-gradient(${theme.textColor} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />

      <div className="absolute top-4 left-4 z-50 flex flex-col gap-3">
        <div className={`p-2 border-2 ${theme.borderColor} ${theme.cardBg} flex flex-col gap-2 shadow-2xl rounded-2xl`}>
          {(['pen', 'eraser', 'rectangle', 'circle'] as ToolType[]).map(t => (
            <button 
              key={t}
              onClick={() => setTool(t)}
              className={`
                w-10 h-10 flex items-center justify-center text-lg transition-all rounded-xl
                ${tool === t ? `${theme.id === 'light' || theme.id === 'soft' ? 'bg-black text-white' : 'bg-white text-black'}` : 'opacity-40 hover:opacity-100'}
              `}
            >
              {t === 'pen' ? '✏️' : t === 'eraser' ? '🧹' : t === 'rectangle' ? '⬜' : '◯'}
            </button>
          ))}
          <div className={`h-[1px] ${theme.borderColor} border-b opacity-20 my-1`} />
          <button onClick={clear} className="w-10 h-10 flex items-center justify-center opacity-40 hover:opacity-100 text-[8px] font-black tracking-widest uppercase">CLR</button>
        </div>

        {tool !== 'eraser' && (
          <div className={`p-2 border-2 ${theme.borderColor} ${theme.cardBg} grid grid-cols-2 gap-2 shadow-2xl rounded-2xl`}>
            {['#ffffff', '#000000', '#ff4444', '#44ff44', '#4444ff', '#ffff44'].map(c => (
              <button 
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border border-current/20 transition-transform ${color === c ? 'scale-125 ring-2 ring-current ring-offset-2' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 w-full h-full relative cursor-crosshair">
        <canvas 
          ref={canvasRef}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          className="absolute inset-0 z-10 touch-none"
        />
      </div>

      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-2 border-2 ${theme.borderColor} bg-current/5 backdrop-blur-md text-[8px] font-black uppercase tracking-[0.4em] opacity-40 rounded-full`}>
        Sync Active • Peer Drawing Visible
      </div>
    </GlassPanel>
  );
};
