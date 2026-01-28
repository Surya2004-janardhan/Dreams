import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface ReplaceSceneDialogProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ReplaceSceneDialog: React.FC<ReplaceSceneDialogProps> = ({
  show,
  onConfirm,
  onCancel
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Scene Generated</h3>
              <p className="text-xs text-gray-400">The AI has finished generating your scene.</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
          A new scene has arrived from the background generation process. Would you like to replace your current manual setup with the AI-generated one?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-colors"
          >
            Keep Manual
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors"
          >
            Replace Scene
          </button>
        </div>
      </div>
    </div>
  );
};
