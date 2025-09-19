import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center">
        {/* Simple spinner */}
        <div className="w-8 h-8 border-2 border-gray-600 border-t-violet-400 rounded-full animate-spin"></div>
      </div>
    </div>
  );
};