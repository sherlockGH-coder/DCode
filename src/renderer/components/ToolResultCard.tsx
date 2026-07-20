import React from 'react';

interface ToolResultMessage {
  id: string;
  role: 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface ToolResultCardProps {
  message: ToolResultMessage;
}

const ToolResultCard: React.FC<ToolResultCardProps> = ({ message }) => {
  const isError = message.content.startsWith('❌') || message.content.startsWith('Error');

  return (
    <div className={`my-1 mb-4 max-w-[min(80%,720px)] border border-border rounded-[10px] overflow-hidden${isError ? ' border-[#ffcccc]' : ''}`}>
      <div className={`flex items-center gap-2 py-2 px-3.5 border-b border-border bg-[rgba(0,0,0,0.02)]${isError ? ' bg-[#fff5f5]' : ''}`}>
        {isError ? (
          <svg className="text-red-600 dark:text-red-400 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <svg className="text-green-600 dark:text-green-400 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="text-xs font-semibold font-mono text-text-secondary">{message.name || 'tool'}</span>
      </div>
      <pre className={`m-0 py-2.5 px-3.5 text-xs font-mono text-text-primary bg-bg-main overflow-x-auto whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto${isError ? ' text-[#cc0000]' : ''}`}>{message.content}</pre>
    </div>
  );
};

export default ToolResultCard;
