import React from 'react';
import type { ActivityState } from '../hooks/useChatActivityPhase';

interface Props {
  activity: ActivityState;
  /** 重试回调：在 timeout / offline / retrying 失败 时提供"重试"按钮入口；无则展示"中止" */
  onRetry?: () => void;
  /** 中止当前生成 */
  onAbort: () => void;
}

const Dots: React.FC<{ colorClass?: string }> = ({ colorClass = 'bg-accent' }) => (
  <span className="flex gap-[3px] shrink-0">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={`w-[4px] h-[4px] rounded-full ${colorClass}`}
        style={{ animation: `processing-dots 1.4s ${i * 0.2}s ease-in-out infinite` }}
      />
    ))}
  </span>
);

const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-[ai-micro-spin_0.9s_linear_infinite] ${className ?? ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const OfflineIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const ChatActivityIndicator: React.FC<Props> = ({ activity, onRetry, onAbort }) => {
  if (!activity.visible) return null;

  const { phase, label, detail } = activity;

  const isWarning = phase === 'slow' || phase === 'retrying';
  const isCritical = phase === 'timeout' || phase === 'offline';

  const labelColor = isCritical || isWarning ? 'text-amber-600' : 'text-accent';

  let icon: React.ReactNode;
  if (phase === 'offline') {
    icon = <OfflineIcon className="text-amber-600 shrink-0" />;
  } else if (phase === 'timeout') {
    icon = <ClockIcon className="text-amber-600 shrink-0" />;
  } else if (phase === 'between_rounds') {
    icon = <Dots />;
  } else {
    icon = <Spinner className={isWarning ? 'text-amber-600 shrink-0' : 'text-accent shrink-0'} />;
  }

  const showActions = isCritical;

  return (
    <div className="flex items-center gap-2 px-1 select-none mt-2">
      {icon}
      <span className={`text-[12px] transition-colors duration-150 ${labelColor}`}>
        {label}
      </span>
      {detail && (
        <span className="text-[11px] text-text-tertiary truncate max-w-[180px]" title={detail}>
          · {detail}
        </span>
      )}
      {showActions && (
        <span className="flex items-center gap-1.5 ml-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-0.5 text-[11px] font-medium text-white bg-accent hover:bg-accent-hover border-none rounded-[7px] cursor-pointer transition-colors duration-150"
            >
              重试
            </button>
          )}
          <button
            type="button"
            onClick={onAbort}
            className="px-2.5 py-0.5 text-[11px] font-medium text-text-secondary bg-transparent hover:bg-bg-hover border border-hairline rounded-[7px] cursor-pointer transition-colors duration-150"
          >
            中止
          </button>
        </span>
      )}
    </div>
  );
};

export default ChatActivityIndicator;
