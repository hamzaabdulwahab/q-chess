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
    lightHover: '#2a2a30',
    darkHover: '#17171c',
    lightCoord: '#e5e7eb',
    darkCoord: '#9ca3af',
    borderColor: '#374151',
    lastMoveHighlight: 'rgba(255, 255, 255, 0.15)',
    moveHighlight: 'rgba(255, 255, 255, 0.1)',
    description: 'Original dark theme'
  },
  {
    id: 'classic',
    name: 'Classic Wood',
    lightSquare: '#f0d9b5',
    darkSquare: '#b58863',
    lightHover: '#edd8b0',
    darkHover: '#a87954',
    lightCoord: '#5c3317',
    darkCoord: '#fff8e7',
    borderColor: '#8b5e3c',
    lastMoveHighlight: 'rgba(246, 220, 150, 0.6)',
    moveHighlight: 'rgba(246, 220, 150, 0.4)',
    description: 'Traditional wooden chess board'
  },
  {
    id: 'green',
    name: 'Chess.com Green',
    lightSquare: '#eeeed2',
    darkSquare: '#769656',
    lightHover: '#f6f6dc',
    darkHover: '#6b8b56',
    lightCoord: '#3b4d2a',
    darkCoord: '#eeeed2',
    borderColor: '#3b4d2a',
    lastMoveHighlight: '#f6f669',
    moveHighlight: 'rgba(186, 202, 68, 0.5)',
    description: 'Official Chess.com style green board'
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    lightSquare: '#e8f4f8',
    darkSquare: '#4682b4',
    lightHover: '#d4ecf3',
    darkHover: '#356b94',
    lightCoord: '#1e3a5f',
    darkCoord: '#e8f4f8',
    borderColor: '#2b4c6e',
    lastMoveHighlight: 'rgba(70, 130, 180, 0.4)',
    moveHighlight: 'rgba(70, 130, 180, 0.25)',
    description: 'Cool ocean colors'
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    lightSquare: '#f3e5f5',
    darkSquare: '#8e44ad',
    lightHover: '#ead1ee',
    darkHover: '#7d3c98',
    lightCoord: '#45245c',
    darkCoord: '#f3e5f5',
    borderColor: '#5b2c6f',
    lastMoveHighlight: 'rgba(187, 107, 217, 0.6)',
    moveHighlight: 'rgba(187, 107, 217, 0.3)',
    description: 'Majestic purple theme'
  },
  {
    id: 'brown',
    name: 'Chocolate',
    lightSquare: '#f5f5dc',
    darkSquare: '#8b4513',
    lightHover: '#f0e6c9',
    darkHover: '#703910',
    lightCoord: '#4a2c0a',
    darkCoord: '#f5f5dc',
    borderColor: '#5c3317',
    lastMoveHighlight: 'rgba(210, 180, 140, 0.6)',
    moveHighlight: 'rgba(210, 180, 140, 0.4)',
    description: 'Rich chocolate browns'
  },
  {
    id: 'coral',
    name: 'Coral Reef',
    lightSquare: '#fff5f5',
    darkSquare: '#ff6b6b',
    lightHover: '#ffeaea',
    darkHover: '#e85050',
    lightCoord: '#991b1b',
    darkCoord: '#fff5f5',
    borderColor: '#991b1b',
    lastMoveHighlight: 'rgba(255, 107, 107, 0.5)',
    moveHighlight: 'rgba(255, 107, 107, 0.3)',
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
    lastMoveHighlight: 'rgba(148, 163, 184, 0.6)',
    moveHighlight: 'rgba(148, 163, 184, 0.4)',
    description: 'Deep midnight blues'
  },
  {
    id: 'autumn',
    name: 'Autumn Forest',
    lightSquare: '#fef3c7',
    darkSquare: '#d97706',
    lightHover: '#fde68a',
    darkHover: '#b45309',
    lightCoord: '#78350f',
    darkCoord: '#fef3c7',
    borderColor: '#92400e',
    lastMoveHighlight: 'rgba(251, 191, 36, 0.6)',
    moveHighlight: 'rgba(251, 191, 36, 0.4)',
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
    lastMoveHighlight: 'rgba(34, 197, 94, 0.5)',
    moveHighlight: 'rgba(34, 197, 94, 0.3)',
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
    borderColor: '#9d174d',
    lastMoveHighlight: 'rgba(236, 72, 153, 0.6)',
    moveHighlight: 'rgba(236, 72, 153, 0.4)',
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
