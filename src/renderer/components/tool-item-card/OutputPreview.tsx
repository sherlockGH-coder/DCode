import React, { useMemo, useState } from 'react';
import { OUTPUT_PREVIEW_CHARS, OUTPUT_PREVIEW_LINES } from './utils';

const OutputPreview: React.FC<{ output: string }> = ({ output }) => {
  const [showFull, setShowFull] = useState(false);
  const { preview, isLarge, totalLines, totalChars } = useMemo(() => {
    const totalChars = output.length;
    const lines = output.split('\n');
    const totalLines = lines.length;
    if (totalChars <= OUTPUT_PREVIEW_CHARS && totalLines <= OUTPUT_PREVIEW_LINES)
      return { preview: output, isLarge: false, totalLines, totalChars };
    const previewByLine = lines.slice(0, OUTPUT_PREVIEW_LINES).join('\n');
    const preview = previewByLine.length > OUTPUT_PREVIEW_CHARS
      ? previewByLine.slice(0, OUTPUT_PREVIEW_CHARS) : previewByLine;
    return { preview, isLarge: true, totalLines, totalChars };
  }, [output]);

  return (
    <div>
      <pre className="p-3 text-[12.5px] font-mono text-text-secondary overflow-auto max-h-[320px] whitespace-pre-wrap break-all leading-[1.75]">
        {showFull ? output : preview}
      </pre>
      {isLarge && (
        <div className="mt-1.5 flex items-center gap-2 px-3 pb-2 text-[11px] text-text-tertiary">
          <span>{totalLines} 行 · {(totalChars / 1024).toFixed(1)} KB</span>
          {!showFull && (
            <button
              type="button"
              onClick={() => setShowFull(true)}
              className="font-medium text-text-secondary hover:text-text-primary hover:underline cursor-pointer"
            >
              加载全部
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OutputPreview;
