import React from 'react';
import { IconPlan, IconPlus, IconX } from '../icons';

type VoiceInputState = {
  isRecording: boolean;
  isBusy: boolean;
  startRecording: () => void | Promise<void>;
  stopAndTranscribe: () => void | Promise<void>;
};

const IconMicrophone: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = 'shrink-0 text-text-secondary' }) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" stroke="currentColor" strokeWidth="20" className={className}>
    <path d="M486.4 972.8v-128.9728A332.8 332.8 0 0 1 179.2 512a25.6 25.6 0 0 1 51.2 0 281.6 281.6 0 0 0 563.2 0 25.6 25.6 0 1 1 51.2 0 332.8 332.8 0 0 1-307.2 331.8272V972.8h153.6a25.6 25.6 0 1 1 0 51.2h-358.4a25.6 25.6 0 1 1 0-51.2h153.6zM512 51.2a153.6 153.6 0 0 0-153.6 153.6v307.2a153.6 153.6 0 0 0 307.2 0V204.8a153.6 153.6 0 0 0-153.6-153.6z m0-51.2a204.8 204.8 0 0 1 204.8 204.8v307.2a204.8 204.8 0 1 1-409.6 0V204.8a204.8 204.8 0 0 1 204.8-204.8z" />
  </svg>
);

const InputToolbar: React.FC<{
  className: string;
  plusMenuRef: React.RefObject<HTMLDivElement | null>;
  isPlusMenuOpen: boolean;
  isLoading: boolean;
  voiceInput: VoiceInputState;
  onPlusMenuOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onPickFiles: () => void;
  modelSelector?: React.ReactNode;
  sendButton?: React.ReactNode;
  mode?: 'execute' | 'plan';
  onModeChange?: (mode: 'execute' | 'plan') => void;
}> = ({
  className,
  plusMenuRef,
  isPlusMenuOpen,
  isLoading,
  voiceInput,
  onPlusMenuOpenChange,
  onPickFiles,
  modelSelector,
  sendButton,
  mode = 'execute',
  onModeChange,
}) => (
    <div className={className}>
      <div className="flex items-center gap-0.5 shrink-0">
        <div className="relative shrink-0" ref={plusMenuRef}>
          <button
            type="button"
            className="w-7 h-7 inline-flex items-center justify-center border-none rounded-[7px] transition-colors duration-150 disabled:opacity-55 shrink-0 cursor-pointer bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            onClick={() => onPlusMenuOpenChange(!isPlusMenuOpen)}
            disabled={isLoading}
            aria-label="附加选项"
            title="附加选项"
          >
            <IconPlus size={17} />
          </button>

          {isPlusMenuOpen && (
            <div
              role="menu"
              aria-label="附加选项"
              className="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] bg-bg-main border border-hairline rounded-[14px] shadow-floating overflow-hidden animate-[menu-in_150ms_ease-out]"
            >
              <button
                type="button"
                role="menuitem"
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-[13px] border-none bg-transparent hover:bg-bg-hover transition-colors duration-150 cursor-pointer text-text-primary"
                onClick={() => {
                  onPlusMenuOpenChange(false);
                  onPickFiles();
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span>添加照片和文件</span>
              </button>
              {onModeChange && (
                <button
                  type="button"
                  role="menuitem"
                  aria-pressed={mode === 'plan'}
                  className={`flex w-full items-center gap-2.5 border-none px-3.5 py-2.5 text-left text-[13px] transition-colors duration-150 cursor-pointer ${
                    mode === 'plan'
                      ? 'bg-accent-bg text-accent'
                      : 'bg-transparent text-text-primary hover:bg-bg-hover'
                  }`}
                  onClick={() => {
                    onPlusMenuOpenChange(false);
                    onModeChange(mode === 'plan' ? 'execute' : 'plan');
                  }}
                >
                  <IconPlan size={15} className="shrink-0 text-current" />
                  <span>计划</span>
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`w-7 h-7 inline-flex items-center justify-center border-none rounded-full transition-colors duration-150 shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
            voiceInput.isRecording
              ? 'bg-diff-del-bg text-diff-del'
              : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover'
          }`}
          aria-label={voiceInput.isRecording ? '停止录音并转写' : '语音输入'}
          title={voiceInput.isRecording ? '停止录音并转写' : '语音输入'}
          disabled={isLoading || voiceInput.isBusy}
          onClick={() => {
            if (voiceInput.isRecording) {
              void voiceInput.stopAndTranscribe();
            } else {
              void voiceInput.startRecording();
            }
          }}
        >
          <IconMicrophone size={15} className="shrink-0" />
        </button>

        {mode === 'plan' && onModeChange && (
          <button
            type="button"
            data-testid="plan-mode-indicator"
            aria-label="关闭计划模式"
            title="关闭计划模式"
            disabled={isLoading}
            onClick={() => onModeChange('execute')}
            className="group ml-0.5 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border-0 bg-transparent px-2 text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:bg-bg-hover focus-visible:text-text-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span className="relative h-3.5 w-3.5 shrink-0" aria-hidden="true">
              <IconPlan size={14} className="absolute inset-0 text-current transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0" />
              <IconX size={14} className="absolute inset-0 text-current opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
            </span>
            <span className="text-[12px] font-medium">计划</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-w-2" />

      {modelSelector}
      {sendButton}
    </div>
);

export default InputToolbar;
