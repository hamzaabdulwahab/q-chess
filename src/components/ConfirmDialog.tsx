"use client";

import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  details?: string[];
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  details
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      } else if (event.key === 'Enter') {
        onConfirm();
      }
    };

    // Focus the confirm button when dialog opens
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-message"
    >
      <div 
        ref={dialogRef}
        className="relative max-w-md w-full rounded-lg shadow-2xl border transform transition-all duration-200 ease-out scale-100"
        style={{ 
          backgroundColor: '#1a1a1a',
          borderColor: '#333',
          animation: isOpen ? 'dialogSlideIn 0.2s ease-out' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h3 
            id="dialog-title"
            className="text-lg font-semibold text-white"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {title}
          </h3>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <p 
            id="dialog-message"
            className="text-gray-300 leading-relaxed"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {message}
          </p>
          
          {details && details.length > 0 && (
            <ul className="mt-4 space-y-2">
              {details.map((detail, index) => (
                <li 
                  key={index}
                  className="text-sm text-gray-400 flex items-start"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  <span className="mr-2 text-gray-500">•</span>
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 border"
            style={{ 
              backgroundColor: 'transparent',
              borderColor: '#4a4a4a',
              color: '#d1d5db',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a2a2a';
              e.currentTarget.style.borderColor = '#5a5a5a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#4a4a4a';
            }}
          >
            {cancelText}
          </button>
          
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            style={{ 
              backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
              color: '#0b0b0e',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 500
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(0.95)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes dialogSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}