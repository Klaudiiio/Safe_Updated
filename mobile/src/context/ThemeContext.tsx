import React, { createContext, useContext, useState } from 'react';

type ThemeMode = 'light' | 'dark';

export const COLORS = {
  background: '#dbeafe',     // Richer pale blue / periwinkle background canvas
  cardBackground: '#c7d2fe', // Soft deep indigo-tinted boxes/cards
  inputBackground: '#e0e7ff',// Distinct container fill for inputs/buttons
  borderAccent: '#a5b4fc',   // Clearer indigo border tone
  primary: '#4f46e5',        // Vibrant indigo button / accent
  textPrimary: '#1e1b4b',    // Deep rich indigo text
  textMuted: '#3730a3',      // Medium indigo text for subtitles
};

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, colors: COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}