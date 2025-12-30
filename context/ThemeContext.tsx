
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
  // Initialize with 'dark' by default to match the black login screen for a seamless transition.
  // We check localStorage immediately for a persistent user preference.
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem('duo_theme_pref');
      return (saved && THEMES[saved as ThemeId]) ? (saved as ThemeId) : 'dark';
    } catch (e) {
      return 'dark';
    }
  });

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
    localStorage.setItem('duo_theme_pref', id);
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
