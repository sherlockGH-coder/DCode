import React from 'react';
import { formatDuration } from './utils';

type VoiceInputState = {
  errorMessage: string | null;
  isRecording: boolean;
  isBusy: boolean;
  elapsedMs: number;
  level: number;
  resetError: () => void;
  cancelRecording: () => void;
  stopAndTranscribe: () => void | Promise<void>;
};

const VoiceInputPanel: React.FC<{ voiceInput: VoiceInputState }> = ({ voiceInput }) => (
  <div
    className={`grid transition-[grid-template-rows,opacity] duration-[180ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
      (voiceInput.isRecording || voiceInput.isBusy || voiceInput.errorMessage) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    {(voiceInput.isRecording || voiceInput.isBusy || voiceInput.errorMessage) ? (
      <div className="min-h-0 overflow-hidden">
        <div className="mx-3.5 sm:mx-5 mb-1.5 px-3 py-2 rounded-[10px] bg-bg-block border border-hairline flex items-center gap-2.5">
          {voiceInput.errorMessage ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-diff-del shrink-0" />
              <span className="text-[12px] text-text-secondary truncate">{voiceInput.errorMessage}</span>
              <button
                type="button"
                className="ml-auto h-6 px-2 rounded-md border-none bg-transparent text-[12px] text-text-tertiary hover:text-text-secondary hover:bg-bg-hover cursor-pointer"
                onClick={voiceInput.resetError}
              >
                关闭
              </button>
            </>
          ) : (
            <>
              <span className={`w-2 h-2 rounded-full shrink-0 ${voiceInput.isRecording ? 'bg-diff-del' : 'bg-accent animate-thinking-pulse'}`} />
              <div className="flex items-center gap-1 h-5 w-14 shrink-0" aria-hidden>
                {[0.65, 0.9, 0.55, 0.78, 0.45].map((weight, index) => (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-text-tertiary/50 transition-[height] duration-100"
                    style={{ height: `${Math.max(4, voiceInput.level * weight * 20)}px` }}
                  />
                ))}
              </div>
              <span className="font-mono text-[12px] text-text-secondary tabular-nums">
                {voiceInput.isRecording ? formatDuration(voiceInput.elapsedMs) : '转写中'}
              </span>
              <div className="ml-auto flex items-center gap-1">
                {voiceInput.isRecording && (
                  <>
                    <button
                      type="button"
                      className="h-6 px-2 rounded-md border-none bg-transparent text-[12px] text-text-tertiary hover:text-text-secondary hover:bg-bg-hover cursor-pointer"
                      onClick={voiceInput.cancelRecording}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="h-6 px-2 rounded-md border-none bg-accent text-white text-[12px] hover:bg-accent-hover cursor-pointer"
                      onClick={() => void voiceInput.stopAndTranscribe()}
                    >
                      完成
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    ) : <div className="min-h-0 overflow-hidden" />}
  </div>
);

export default VoiceInputPanel;
