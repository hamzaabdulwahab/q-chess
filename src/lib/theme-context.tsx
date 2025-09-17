"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ChessTheme {
  id: string;
  name: string;
  lightSquare: string;
  darkSquare: string;
  lightHover: string;
  darkHover: string;
  lightCoord: string;
  darkCoord: string;
  borderColor: string;
  lastMoveHighlight: string;
  moveHighlight: string;
  description: string;
}

export const chessThemes: ChessTheme[] = [
  {
    id: 'dark',
    name: 'Dark Night',
    lightSquare: '#1a1a1f',
    darkSquare: '#0f0f13',
    lightHover: '#23232a',
    darkHover: '#17171c',
    lightCoord: '#1a1a1f',
    darkCoord: '#f1f5f9',
    borderColor: '#374151',
    lastMoveHighlight: 'rgba(71, 85, 105, 0.6)',
    moveHighlight: 'rgba(71, 85, 105, 0.4)',
    description: 'Original dark theme'
  },
  {
    id: 'classic',
    name: 'Classic Wood',
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    lightHover: '#edd8b0',
    darkHover: '#a87954',
    lightCoord: '#8b4513',
    darkCoord: '#f0d9b5',
    borderColor: '#8b4513',
    lastMoveHighlight: 'rgba(139, 69, 19, 0.5)',
    moveHighlight: 'rgba(139, 69, 19, 0.3)',
    description: 'Traditional wooden chess board'
  },
  {
    id: 'green',
    name: 'Forest Green',
    lightSquare: '#eeeed2',
    darkSquare: '#769656',
    lightHover: '#e5e5c7',
    darkHover: '#688147',
    lightCoord: '#4a5c2a',
    darkCoord: '#eeeed2',
    borderColor: '#4a5c2a',
    lastMoveHighlight: 'rgba(74, 92, 42, 0.6)',
    moveHighlight: 'rgba(74, 92, 42, 0.4)',
    description: 'Green tournament style'
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    lightSquare: '#e8f4f8',
    darkSquare: '#4682b4',
    lightHover: '#dce9ed',
    darkHover: '#357ab7',
    lightCoord: '#1e3a5f',
    darkCoord: '#e8f4f8',
    borderColor: '#1e3a5f',
    lastMoveHighlight: 'rgba(30, 58, 95, 0.6)',
    moveHighlight: 'rgba(30, 58, 95, 0.4)',
    description: 'Cool ocean colors'
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    lightSquare: '#f3e5f5',
    darkSquare: '#8e44ad',
    lightHover: '#eedcf0',
    darkHover: '#7d3c98',
    lightCoord: '#5b2c6f',
    darkCoord: '#f3e5f5',
    borderColor: '#5b2c6f',
    lastMoveHighlight: 'rgba(91, 44, 111, 0.6)',
    moveHighlight: 'rgba(91, 44, 111, 0.4)',
    description: 'Majestic purple theme'
  },
  {
    id: 'brown',
    name: 'Chocolate',
    lightSquare: '#f5f5dc',
    darkSquare: '#8b4513',
    lightHover: '#f0f0d1',
    darkHover: '#7a3e0f',
    lightCoord: '#4a2c0a',
    darkCoord: '#f5f5dc',
    borderColor: '#4a2c0a',
    lastMoveHighlight: 'rgba(74, 44, 10, 0.6)',
    moveHighlight: 'rgba(74, 44, 10, 0.4)',
    description: 'Rich chocolate browns'
  },
  {
    id: 'coral',
    name: 'Coral Reef',
    lightSquare: '#fff5f5',
    darkSquare: '#ff6b6b',
    lightHover: '#fee2e2',
    darkHover: '#ef4444',
    lightCoord: '#991b1b',
    darkCoord: '#fff5f5',
    borderColor: '#991b1b',
    lastMoveHighlight: 'rgba(153, 27, 27, 0.5)',
    moveHighlight: 'rgba(153, 27, 27, 0.3)',
    description: 'Warm coral and pink tones'
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    lightSquare: '#1e293b',
    darkSquare: '#0f172a',
    lightHover: '#334155',
    darkHover: '#1e293b',
    lightCoord: '#cbd5e1',
    darkCoord: '#94a3b8',
    borderColor: '#475569',
    lastMoveHighlight: 'rgba(71, 85, 105, 0.6)',
    moveHighlight: 'rgba(71, 85, 105, 0.4)',
    description: 'Deep midnight blues'
  },
  {
    id: 'autumn',
    name: 'Autumn Forest',
    lightSquare: '#fef3c7',
    darkSquare: '#d97706',
    lightHover: '#fde68a',
    darkHover: '#b45309',
    lightCoord: '#92400e',
    darkCoord: '#fef3c7',
    borderColor: '#92400e',
    lastMoveHighlight: 'rgba(146, 64, 14, 0.6)',
    moveHighlight: 'rgba(146, 64, 14, 0.4)',
    description: 'Warm autumn oranges and yellows'
  },
  {
    id: 'mint',
    name: 'Fresh Mint',
    lightSquare: '#f0fdf4',
    darkSquare: '#16a34a',
    lightHover: '#dcfce7',
    darkHover: '#15803d',
    lightCoord: '#14532d',
    darkCoord: '#f0fdf4',
    borderColor: '#14532d',
    lastMoveHighlight: 'rgba(21, 83, 45, 0.6)',
    moveHighlight: 'rgba(21, 83, 45, 0.4)',
    description: 'Fresh mint green theme'
  },
  {
    id: 'rose',
    name: 'Rose Gold',
    lightSquare: '#fdf2f8',
    darkSquare: '#be185d',
    lightHover: '#fce7f3',
    darkHover: '#9d174d',
    lightCoord: '#831843',
    darkCoord: '#fdf2f8',
    borderColor: '#831843',
    lastMoveHighlight: 'rgba(131, 24, 67, 0.6)',
    moveHighlight: 'rgba(131, 24, 67, 0.4)',
    description: 'Elegant rose and pink tones'
  }
];

interface ThemeContextType {
  currentTheme: ChessTheme;
  setTheme: (themeId: string) => void;
  themes: ChessTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentThemeId, setCurrentThemeId] = useState('dark');
  
  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('chess-theme');
    if (savedTheme && chessThemes.find(t => t.id === savedTheme)) {
      setCurrentThemeId(savedTheme);
    }
  }, []);

  const setTheme = (themeId: string) => {
    const theme = chessThemes.find(t => t.id === themeId);
    if (theme) {
      setCurrentThemeId(themeId);
      localStorage.setItem('chess-theme', themeId);
    }
  };

  const currentTheme = chessThemes.find(t => t.id === currentThemeId) || chessThemes[0];

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes: chessThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useChessTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useChessTheme must be used within a ThemeProvider');
  }
  return context;
}