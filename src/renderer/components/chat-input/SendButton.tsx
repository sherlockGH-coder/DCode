import React from 'react';

const SendButton: React.FC<{
  isLoading: boolean;
  canSend: boolean;
  disabled: boolean;
  onAbort: () => void;
  onSend: () => void;
}> = ({ isLoading, canSend, disabled, onAbort, onSend }) => (
  <button
    type="button"
    className="w-7 h-7 inline-flex items-center justify-center border-none rounded-full bg-accent text-white cursor-pointer transition-[background-color,opacity] duration-150 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent shrink-0"
    onClick={isLoading ? onAbort : onSend}
    disabled={isLoading ? false : (!canSend || disabled)}
    aria-label={isLoading ? '停止回复' : '发送'}
    title={isLoading ? '停止回复' : '发送'}
  >
    {isLoading ? (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="20" x2="12" y2="4" />
        <polyline points="5 11 12 3 19 11" />
      </svg>
    )}
  </button>
);

export default SendButton;
