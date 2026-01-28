import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface SnackbarProps {
  show: boolean;
  message: string;
}

export const Snackbar: React.FC<SnackbarProps> = ({ show, message }) => {
  return (
    <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[100] transition-all duration-300 flex items-center gap-2 ${show ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
      <CheckCircle2 size={20} className="text-green-600" />
      {message}
    </div>
  );
};
