import React, { useMemo } from 'react';
import { highlightCode } from './diff-view/highlightCode';
import { compactDiffLines, parseDiff } from './diff-view/parseDiff';

interface DiffViewProps {
  diff: string;
  /** 文件名或路径，用于判定语法着色语言 */
  filename?: string;
  /** 传值则限高自滚（如 '200px'）；不传则填充父容器，由外层滚动 */
  maxHeight?: string;
  /** 顶部显示 +N -M 统计条 */
  showStat?: boolean;
  /** 审批面板使用更紧凑、克制的代码审查样式 */
  variant?: 'default' | 'review';
  /** 容器额外类名（边框/圆角/背景等由调用方决定） */
  className?: string;
}

const DiffView: React.FC<DiffViewProps> = ({ diff, filename, maxHeight, showStat, variant = 'default', className }) => {
  const lines = useMemo(() => parseDiff(diff ?? ''), [diff]);
  const isReview = variant === 'review';
  const displayLines = useMemo(() => (
    isReview ? lines : compactDiffLines(lines)
  ), [isReview, lines]);
  const { added, deleted } = useMemo(() => {
    let added = 0;
    let deleted = 0;
    for (const l of lines) {
      if (l.type === 'add') added++;
      else if (l.type === 'del') deleted++;
    }
    return { added, deleted };
  }, [lines]);

  const ext = useMemo(() => {
    if (!filename) return '';
    const cleanName = filename.replace(/\s*\(diff\)$/i, '');
    const parts = cleanName.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  }, [filename]);

  const hasVisibleChanges = useMemo(() => {
    return lines.some(l => l.type === 'add' || l.type === 'del' || l.type === 'ctx');
  }, [lines]);

  if (!diff?.trim() || !hasVisibleChanges) {
    return <div className="px-4 py-4 text-[12px] text-text-tertiary select-none text-center">无可见代码改动</div>;
  }

  const rootClass = isReview
    ? 'bg-[#eaf7ec] text-[13px] leading-6 text-[#1f2937] dark:bg-emerald-400/[0.08] dark:text-[#e5e7eb]'
    : 'text-[13px] leading-[18px] bg-[#FAFBFC] dark:bg-[#121214] text-[#24292f] dark:text-[#e3e6ed]';
  const lineNumberClass = isReview
    ? 'w-[72px] border-r-2 border-white/95 pr-5 pl-4 py-[2px] text-[13px] dark:border-white/10'
    : 'w-[72px] border-r-2 border-white/95 pr-4 pl-4 py-[1px] text-[13px] dark:border-white/10';
  const codeCellClass = isReview
    ? 'pl-7 pr-5 py-[2px]'
    : 'pl-12 pr-5 py-[1px]';
  const lineNumberTextClass = isReview ? '' : '';
  const rowLeadingClass = isReview ? 'leading-relaxed' : 'leading-[18px]';

  return (
    <div
      className={`${rootClass} overflow-x-auto ${maxHeight ? 'overflow-y-auto' : 'min-h-full'} ${className ?? ''}`}
      style={{
        fontFamily: isReview
          ? "SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, 'PingFang SC', 'Microsoft YaHei', monospace"
          : "JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, 'Courier New', monospace",
        ...(maxHeight ? { maxHeight } : {}),
      }}
    >
      {showStat && (
        <div className="sticky top-0 left-0 z-10 flex w-full items-center gap-3 px-4 py-1.5 border-b border-hairline bg-bg-main text-[11px] select-none text-[#57606a] dark:text-[#abb2bf]">
          <span className="text-emerald-600 dark:text-[#98c379] font-semibold">+{added}</span>
          <span className="text-rose-600 dark:text-[#e06c75] font-semibold">-{deleted}</span>
          <span className="text-text-tertiary dark:text-[#5c6370]">{displayLines.filter(l => l.type !== 'meta' && l.type !== 'hunk' && l.type !== 'gap').length} 行变动</span>
        </div>
      )}
      <div className="min-w-max">
        {displayLines.map((ln, i) => {
          if (ln.type === 'meta') {
            return null;
          }

          if (ln.type === 'gap') {
            const gapBorderClass = isReview
              ? 'border-l-4 border-transparent'
              : 'border-l-[3px] border-transparent';
            return (
              <div key={i} className={`flex h-2 items-stretch bg-black/[0.025] dark:bg-white/[0.025] ${gapBorderClass}`} aria-hidden>
                <span className={`${lineNumberClass} shrink-0 border-r-2 border-white/95 dark:border-white/10`} />
                <div className="flex-1 bg-transparent" />
              </div>
            );
          }

          if (ln.type === 'hunk') {
            const isFirstHunk = !displayLines.slice(0, i).some(l => l.type === 'hunk');
            if (isFirstHunk) {
              return null;
            }

            const hunkBorderClass = isReview
              ? 'border-l-4 border-transparent'
              : 'border-l-[3px] border-transparent';
            return (
              <div key={i} className={`flex items-stretch select-none text-[11px] ${rowLeadingClass} ${hunkBorderClass}`}>
                <span className={`${lineNumberClass} shrink-0 text-right select-none bg-transparent text-text-tertiary/40 dark:text-[#5c6370] font-mono`}>
                  ...
                </span>
                <div className={`flex-1 ${codeCellClass} bg-blue-500/[0.05] dark:bg-blue-500/[0.08] text-blue-600 dark:text-[#58a6ff] font-semibold flex items-center`}>
                  <span>{ln.text}</span>
                </div>
              </div>
            );
          }

          let rowBgClass = '';
          let rowBorderClass = '';
          let lineNumberTextColorClass = '';
          let lineNumStr = '';
          let textClass = '';

          if (ln.type === 'add') {
            rowBgClass = isReview
              ? 'bg-[#eaf7ec] dark:bg-emerald-400/[0.08] hover:bg-[#dff2e4] dark:hover:bg-emerald-400/[0.12]'
              : 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.12] hover:bg-emerald-500/[0.1] dark:hover:bg-emerald-500/[0.18]';
            rowBorderClass = isReview
              ? 'border-l-4 border-[#1ba84a] dark:border-emerald-500/80'
              : 'border-l-[3px] border-emerald-500/80 dark:border-emerald-500';
            lineNumberTextColorClass = isReview
              ? 'text-[#009b3a] dark:text-emerald-300'
              : 'text-emerald-600/70 dark:text-[#98c379]/60';
            lineNumStr = String(ln.newLineNum);
            textClass = isReview
              ? 'text-[#0f5132] dark:text-[#d6f5e6]'
              : 'text-emerald-900 dark:text-[#e3e6ed]';
          } else if (ln.type === 'del') {
            rowBgClass = isReview
              ? 'bg-[#fff0f0] dark:bg-rose-400/[0.08] hover:bg-[#ffe5e5] dark:hover:bg-rose-400/[0.12]'
              : 'bg-rose-500/[0.06] dark:bg-rose-500/[0.12] hover:bg-rose-500/[0.1] dark:hover:bg-rose-500/[0.18]';
            rowBorderClass = isReview
              ? 'border-l-4 border-[#d1242f] dark:border-rose-500/80'
              : 'border-l-[3px] border-rose-500/80 dark:border-rose-500';
            lineNumberTextColorClass = isReview
              ? 'text-[#d1242f] dark:text-rose-300'
              : 'text-rose-600/70 dark:text-[#e06c75]/60';
            lineNumStr = String(ln.oldLineNum);
            textClass = isReview
              ? 'text-[#7a1c24] dark:text-[#f8d6dc]'
              : 'text-rose-900 dark:text-[#e3e6ed]';
          } else {
            rowBgClass = isReview
              ? 'bg-[#f8faf9] dark:bg-white/[0.025] hover:bg-[#f0f3f2] dark:hover:bg-white/[0.04]'
              : 'bg-transparent hover:bg-black/[0.01] dark:hover:bg-white/[0.01]';
            rowBorderClass = isReview
              ? 'border-l-4 border-transparent'
              : 'border-l-[3px] border-transparent';
            lineNumberTextColorClass = isReview
              ? 'text-[#8a9199] dark:text-[#5c6370]'
              : 'text-text-tertiary/50 dark:text-[#5c6370]';
            lineNumStr = String(ln.newLineNum || ln.oldLineNum || '');
            textClass = isReview
              ? 'text-slate-700 dark:text-[#e3e6ed]/78'
              : 'text-text-primary dark:text-[#e3e6ed]/85';
          }

          return (
            <div
              key={i}
              className={`flex items-stretch ${rowLeadingClass} transition-colors duration-100 ${rowBgClass} ${rowBorderClass}`}
            >
              <span className={`${lineNumberClass} ${lineNumberTextClass} shrink-0 text-right select-none font-mono ${lineNumberTextColorClass}`}>
                {lineNumStr}
              </span>
              <div className={`flex-1 flex items-baseline font-mono bg-transparent ${codeCellClass}`}>
                <span className={`flex-1 whitespace-pre pl-0.5 ${textClass}`}>
                  {highlightCode(ln.text, ext)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiffView;
