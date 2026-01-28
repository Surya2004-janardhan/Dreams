import React from 'react';
import { Key } from 'lucide-react';

interface AppHeaderProps {
  onResetAuth: () => void;
  onNewProject: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onResetAuth, onNewProject }) => {
  return (
    <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-black/50 backdrop-blur-sm z-10 shrink-0">
      <div className="font-bold text-xl bg-clip-text text-transparent bg-linear-to-r from-purple-400 to-pink-500">
        Reel Composer
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <button
          onClick={onResetAuth}
          className="flex items-center gap-2 hover:text-white transition-colors"
          title="Reset API Key"
        >
          <Key size={16} />
          <span className="hidden lg:inline">Change Key</span>
        </button>

        <div className="w-px h-4 bg-gray-700"></div>

        <button
          onClick={onNewProject}
          className="hover:text-white transition-colors"
        >
          New Project
        </button>
        <div className="w-px h-4 bg-gray-700"></div>
        <span className="text-xs uppercase tracking-widest text-purple-400">v1.3</span>
      </div>
    </header>
  );
};
