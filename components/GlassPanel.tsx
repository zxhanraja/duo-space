
import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', onClick, title }) => {
  const { theme } = useTheme();

  return (
    <div 
      onClick={onClick}
      className={`relative p-3 md:p-6 transition-all duration-700 ease-in-out flex flex-col ${theme.glassPanel} ${className}`}
    >
      {title && (
        <div className={`shrink-0 text-[10px] md:text-xs uppercase tracking-[0.2em] font-black mb-3 md:mb-5 border-b-2 ${theme.borderColor} pb-2 ${theme.accentColor} ${theme.fontMain} transition-all duration-700`}>
          {title}
        </div>
      )}
      
      <div className={`relative z-10 flex-1 min-h-0 flex flex-col ${theme.textColor} ${theme.fontMain} transition-all duration-700`}>
        {children}
      </div>
    </div>
  );
};
