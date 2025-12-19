import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeConfig, ThemeId } from '../types';
import { THEMES } from '../constants';
import { syncService } from '../services/syncService';

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeId, setThemeId] = useState<ThemeId>('light');

  useEffect(() => {
    // Listen for theme changes from other user/tab
    const unsubscribe = syncService.subscribe('theme_change', (id: string) => {
      if (THEMES[id as ThemeId]) {
        setThemeId(id as ThemeId);
      }
    });
    return unsubscribe;
  }, []);

  const changeTheme = (id: ThemeId) => {
    setThemeId(id);
    // Fixed: Property 'changeTheme' does not exist on type 'SyncService'. Using 'pushTheme' instead.
    syncService.pushTheme(id);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], setTheme: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};