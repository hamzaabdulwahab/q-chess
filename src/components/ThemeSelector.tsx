"use client";

import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useChessTheme } from '@/lib/theme-context';

export function ThemeSelector() {
  const { currentTheme, setTheme, themes } = useChessTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, direction: 'up' });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedThemeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Determine if we should show above or below
      const spaceAbove = buttonRect.top;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const showAbove = spaceAbove > spaceBelow && spaceAbove > 300;
      
      // Calculate horizontal position
      let left = buttonRect.right - 256; // 256px is w-64 width
      if (left < 16) left = 16; // 16px margin from edge
      if (left + 256 > viewportWidth - 16) left = viewportWidth - 256 - 16;
      
      // Calculate vertical position
      const top = showAbove ? buttonRect.top - 8 : buttonRect.bottom + 8;
      
      setDropdownPosition({
        top,
        left,
        direction: showAbove ? 'up' : 'down'
      });

      // Scroll to the selected theme after a short delay to ensure the dropdown is rendered
      setTimeout(() => {
        const selectedThemeButton = selectedThemeRefs.current[currentTheme.id];
        const scrollContainer = scrollContainerRef.current;
        
        if (selectedThemeButton && scrollContainer) {
          // Get the position of the selected theme relative to the scroll container
          const containerRect = scrollContainer.getBoundingClientRect();
          const buttonRect = selectedThemeButton.getBoundingClientRect();
          
          // Calculate the offset needed to center the selected theme in view
          const buttonTop = buttonRect.top - containerRect.top;
          const containerHeight = scrollContainer.clientHeight;
          const buttonHeight = selectedThemeButton.offsetHeight;
          
          // Scroll to position the selected theme near the center of the visible area
          const scrollTop = buttonTop - (containerHeight / 2) + (buttonHeight / 2);
          
          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }, 10);
    }
  }, [isOpen, currentTheme.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          buttonRef.current && 
          dropdownRef.current && 
          !buttonRef.current.contains(event.target as Node) && 
          !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-white transition-colors flex items-center justify-center gap-2 hover:opacity-80"
        style={{ 
          backgroundColor: '#1B1B1B',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: '16px',
          padding: '0.6em 1.2em',
          borderRadius: '8px'
        }}
        title="Change board theme"
      >
        <Palette className="w-4 h-4" />
        <span>Theme</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Theme selection dropdown */}
          <div 
            ref={dropdownRef}
            className={`fixed w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[101] overflow-hidden ${
              dropdownPosition.direction === 'up' ? 'origin-bottom' : 'origin-top'
            }`}
            style={{
              top: dropdownPosition.direction === 'up' ? 'auto' : dropdownPosition.top,
              bottom: dropdownPosition.direction === 'up' ? window.innerHeight - dropdownPosition.top : 'auto',
              left: dropdownPosition.left,
            }}
          >
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-white font-medium text-sm">Board Themes</h3>
            </div>
            
            <div className="max-h-64 overflow-y-auto scrollbar-hide" ref={scrollContainerRef}>
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  ref={(el) => {
                    selectedThemeRefs.current[theme.id] = el;
                  }}
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className="w-full p-3 hover:bg-gray-700 transition-colors text-left flex items-center gap-3"
                >
                  {/* Theme preview squares */}
                  <div className="flex">
                    <div 
                      className="w-4 h-4 border border-gray-600" 
                      style={{ backgroundColor: theme.lightSquare }}
                    />
                    <div 
                      className="w-4 h-4 border border-gray-600" 
                      style={{ backgroundColor: theme.darkSquare }}
                    />
                    <div 
                      className="w-4 h-4 border border-gray-600" 
                      style={{ backgroundColor: theme.lastMoveHighlight }}
                    />
                    <div 
                      className="w-4 h-4 border border-gray-600" 
                      style={{ backgroundColor: theme.moveHighlight }}
                    />
                  </div>
                  
                  {/* Theme info */}
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">{theme.name}</div>
                    <div className="text-gray-400 text-xs">{theme.description}</div>
                  </div>
                  
                  {/* Check mark for current theme */}
                  {currentTheme.id === theme.id && (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}