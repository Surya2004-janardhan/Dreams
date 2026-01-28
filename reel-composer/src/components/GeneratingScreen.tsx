import React from 'react';
import { LayoutTemplate, AlertCircle, Edit3 } from 'lucide-react';

interface GeneratingScreenProps {
  isAudioOnly: boolean;
  topicContext: string;
  onTopicContextChange: (text: string) => void;
  isGenerating: boolean;
  showManualButton: boolean;
  error: string | null;
  onEnterStudio: () => void;
  onManualModeEnter: () => void;
  onResetAuth: () => void;
  apiKey: string;
  srtDataLength: number;
}

export const GeneratingScreen: React.FC<GeneratingScreenProps> = ({
  isAudioOnly,
  topicContext,
  onTopicContextChange,
  isGenerating,
  showManualButton,
  error,
  onEnterStudio,
  onManualModeEnter,
  onResetAuth,
  apiKey,
  srtDataLength
}) => {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto p-6 space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400 mb-4">
            <LayoutTemplate size={32} />
          </div>
          <h2 className="text-3xl font-bold">Director's Studio</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            {isAudioOnly
              ? "Audio-Only Mode: We will generate full-screen visuals to accompany your script."
              : "Describe your video topic. We'll copy this prompt to your clipboard and auto-generate the initial animation scene."}
          </p>
        </div>

        <div className="w-full space-y-4">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">
            Video Topic / Visual Context <span className="text-gray-500 text-xs normal-case">(Optional)</span>
          </label>
          <textarea
            value={topicContext}
            onChange={(e) => onTopicContextChange(e.target.value)}
            placeholder={isAudioOnly ? "e.g. Visuals should be about space exploration, with planets and stars." : "e.g. This video explains Quantum Tunneling. I want particles passing through barriers..."}
            className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none transition-all"
          />
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onEnterStudio}
            disabled={isGenerating}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
              isGenerating
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/20 hover:scale-[1.02]'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating Scene...
              </>
            ) : (
              <>
                <Edit3 size={18} />
                {!apiKey ? "No API Key - Enter Manual Mode" : (srtDataLength === 0 ? "Enter Demo Studio" : "Enter Studio & Auto-Generate")}
              </>
            )}
          </button>

          {/* Manual Mode Option - Appears after 10s */}
          {isGenerating && showManualButton && (
            <div className="animate-fade-in text-center pt-2">
              <span className="text-xs text-gray-500 block mb-2">Taking longer than expected?</span>
              <button
                onClick={onManualModeEnter}
                className="text-sm text-purple-400 hover:text-white underline underline-offset-4 decoration-purple-500/30 hover:decoration-purple-500 transition-all"
              >
                Skip & Enter Manual Mode
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full p-4 bg-red-900/20 border border-red-800 rounded-lg flex flex-col gap-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-red-300">Generation Failed</h4>
                <p className="text-xs text-red-200 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>

            <div className="flex gap-3 pl-8">
              <button
                onClick={onResetAuth}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-white text-xs rounded-lg transition-colors border border-red-700/50"
              >
                Update API Key
              </button>
              <button
                onClick={onManualModeEnter}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors border border-gray-700"
              >
                Continue in Manual Mode
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
