import React from 'react';
import { Smartphone, Monitor } from 'lucide-react';

export const MobileBlocker: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center p-8 text-center md:hidden">
      <div className="w-20 h-20 bg-linear-to-br from-purple-900/20 to-pink-900/20 rounded-2xl border border-gray-800 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden">
        <Smartphone size={32} className="text-gray-500 relative z-10" />
        <div className="absolute inset-0 bg-red-500/10 rotate-45 transform scale-150"></div>
      </div>
      <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-400 to-pink-600 mb-3">
        Desktop Experience Required
      </h2>
      <p className="text-gray-400 max-w-xs leading-relaxed text-sm">
        Reel Composer is a professional studio tool designed for larger screens.
        <br/><br/>
        Please open this application on your <strong>Laptop</strong> or <strong>Desktop</strong>.
      </p>
      <div className="mt-8 flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest">
        <Monitor size={14} />
        <span>Best viewed on 1024px+</span>
      </div>
    </div>
  );
};
