import React, { useCallback, useMemo, useState } from 'react';
import type { ToolItem } from '../../shared/types';
import { describeToolItem } from '../utils/toolDescriptions';
import { usePreviewActions } from '../contexts/AppContext';
import DiffView from './preview/DiffView';
import AgentToolCard from './tool-item-card/AgentToolCard';
import { ChevronGlyph, ToolDetailFrame, ToolKindBadge } from './tool-item-card/chrome';
import ExecOutputPanel from './tool-item-card/ExecOutputPanel';
import FileChangeToolCard from './tool-item-card/FileChangeToolCard';
import OutputPreview from './tool-item-card/OutputPreview';
import PlanArtifactCard from './PlanArtifactCard';
import { getDiff, getFileName, getOutput } from './tool-item-card/utils';

interface ToolItemCardProps {
  item: ToolItem;
  hideIcon?: boolean;
}

function getStatusInfo(item: ToolItem): string[] {
  const lines: string[] = [];
  if (item.status === 'done') lines.push('Done');
  else if (item.status === 'error') lines.push('Failed');
  if (item.kind === 'read' && item.lineCount) lines.push(`${item.lineCount} lines`);
  if (item.kind === 'read' && item.truncated) lines.push('Truncated');
  if (item.kind === 'grep' && item.matchCount != null) lines.push(`${item.matchCount} matches`);
  if (item.kind === 'glob' && item.matchCount != null) lines.push(`${item.matchCount} files`);
  return lines;
}

const renderDetail = (detail?: string) => {
  if (!detail) return null;
  const parts = detail.split(' ');
  return (
    <span className="text-[12px] font-mono ml-1.5 shrink-0 select-none">
      {parts.map((p, idx) => {
        const prefix = idx > 0 ? ' ' : '';
        if (p.startsWith('+') || p.startsWith('-')) return <span key={idx} className="text-text-secondary mr-1">{prefix}{p}</span>;
        return <span key={idx} className="text-text-tertiary mr-1">{prefix}{p}</span>;
      })}
    </span>
  );
};

type AskUserQuestionItem = Extract<ToolItem, { kind: 'ask_user_question' }>;

function questionStatusLabel(item: AskUserQuestionItem): string {
  switch (item.status) {
    case 'done': return '已完成';
    case 'error': return item.output?.includes('问题已失效') ? '已失效' : '未完成';
    case 'awaiting_approval': return '等待回答';
    case 'running': return '处理中';
    case 'pending': return '准备中';
  }
}

const AskUserQuestionDetail: React.FC<{ item: AskUserQuestionItem }> = ({ item }) => {
  const questions = item.questions ?? [];
  return (
    <ToolDetailFrame testId="ask-user-question-detail" className="divide-y divide-hairline">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-[12px] font-medium text-text-secondary">问答详情</span>
        <span className={`text-[11px] font-medium ${item.status === 'error' ? 'text-diff-del' : 'text-text-tertiary'}`}>
          {questionStatusLabel(item)}
        </span>
      </div>
      {questions.length > 0 ? questions.map((question, index) => {
        const answer = item.answers?.[question.question];
        const selectedAnswers = new Set(
          answer
            ? question.multiSelect
              ? answer.split(', ').map((value) => value.trim())
              : [answer]
            : [],
        );
        return (
          <section key={`${question.question}-${index}`} className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 max-w-[120px] shrink-0 truncate rounded-[5px] bg-bg-chip px-1.5 py-0.5 text-[10.5px] font-medium text-text-secondary">
                {question.header || `问题 ${index + 1}`}
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-text-primary">
                {question.question}
              </p>
            </div>
            <div className="mt-2 space-y-1">
              {question.options.map((option) => {
                const selected = selectedAnswers.has(option.label);
                return (
                  <div
                    key={option.label}
                    className={`flex items-start gap-2 rounded-[6px] px-2 py-1.5 ${selected ? 'bg-accent-bg' : 'bg-transparent'}`}
                  >
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full border ${selected ? 'border-accent bg-accent' : 'border-border-strong bg-transparent'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[12.5px] font-medium leading-4 ${selected ? 'text-accent' : 'text-text-primary'}`}>
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="mt-0.5 block text-[11.5px] leading-4 text-text-tertiary">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[12px] leading-5 text-text-secondary">
              <span className="font-medium">用户选择：</span>
              <span className={answer ? 'text-text-primary' : 'text-text-tertiary'}>
                {answer || (item.status === 'awaiting_approval' ? '等待选择' : '未作答')}
              </span>
            </div>
          </section>
        );
      }) : (
        <div className="px-3 py-2.5 text-[12px] text-text-tertiary">没有可展示的问题内容</div>
      )}
    </ToolDetailFrame>
  );
};

const ToolItemCard: React.FC<ToolItemCardProps> = ({ item, hideIcon = false }) => {
  const { verb, target, detail, iconType, filePath } = describeToolItem(item);
  const { setPreview } = usePreviewActions();
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);
  const output = getOutput(item);
  const hasOutput = item.kind !== 'read' && !!output && (item.status === 'error' || item.kind === 'exec' || item.kind === 'tool' ? true : output.split('\n').length > 20);
  const diff = getDiff(item);
  const isSkillLoad = item.kind === 'tool' && item.toolName === 'load_skill';

  const hasExpandableContent = hasOutput || !!diff || item.kind === 'tool' || item.kind === 'ask_user_question';
  const statusInfo = getStatusInfo(item);

  const displayName = useMemo(() => {
    if (item.kind === 'read' && filePath) return getFileName(filePath);
    if (!target) return '';
    let clean = target;
    if (clean.startsWith('./')) {
      clean = clean.slice(2);
    } else if (clean.startsWith('../')) {
      clean = clean.slice(3);
    }
    return clean;
  }, [filePath, item.kind, target]);

  const handleFileClick = useCallback(async (e: React.MouseEvent) => {
    if (!filePath) return;
    e.preventDefault();
    e.stopPropagation();
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);
    if (isImage) {
      setPreview({
        type: 'image',
        title: filePath.split('/').pop() || filePath,
        content: `local-file://${filePath}`,
        filePath: filePath,
      });
      return;
    }
    const isHtml = ext === 'html' || ext === 'htm';
    const isMd = ext === 'md' || ext === 'markdown';
    const result = await window.deepseekApi?.readFileContent(filePath);
    if (result) {
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        py: 'python', go: 'go', rs: 'rust', json: 'json',
        css: 'css', html: 'html', md: 'markdown', sh: 'bash',
      };
      setPreview({
        type: isHtml ? 'html' : isMd ? 'markdown' : 'code',
        title: result.name,
        content: result.content,
        language: !isHtml && !isMd ? (langMap[ext] || 'text') : undefined,
        filePath: result.path,
      });
    }
  }, [filePath, setPreview]);

  if (item.kind === 'agent') {
    return <AgentToolCard item={item} hideIcon={hideIcon} />;
  }

  if (item.kind === 'plan_artifact' && item.plan) {
    return <PlanArtifactCard item={item} />;
  }

  if (item.kind === 'write' || item.kind === 'edit') {
    return <FileChangeToolCard item={item} onFileClick={handleFileClick} hideIcon={hideIcon} />;
  }

  return (
    <div className="tool-item-shell w-full overflow-hidden">
      <div className="flex items-center w-full">
        <button
          data-testid="tool-item-row"
          type="button"
          onClick={hasExpandableContent ? toggle : undefined}
          className={`tool-item-row-surface group/summary-row flex min-h-6 w-fit max-w-full items-center gap-[9px] border-0 bg-transparent py-1 text-left transition-colors duration-150 ${
            item.status === 'running' || item.status === 'pending' ? 'text-text-secondary' : 'text-text-secondary hover:text-text-primary'
          } ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {!hideIcon && <span className="opacity-75"><ToolKindBadge iconType={iconType} /></span>}
          <span className="flex min-w-0 items-baseline gap-1.5 text-current">
            <span className="shrink-0 text-[13.5px] text-current">{verb}</span>
            {filePath ? (
              <span
                onClick={handleFileClick}
                className="min-w-0 truncate font-mono text-[13.5px] tracking-[-0.01em] text-current hover:underline"
                title={target}
              >
                {displayName}
              </span>
            ) : (
              <span
                className="min-w-0 truncate font-mono text-[13.5px] tracking-[-0.01em] text-current"
                title={target}
              >
                {displayName}
              </span>
            )}
            {renderDetail(detail)}
            {item.status === 'error' && <span className="shrink-0 text-[13px] text-diff-del">失败</span>}
          </span>
          {hasExpandableContent && (
            <span className="shrink-0 text-[10px] text-text-tertiary">
              <ChevronGlyph open={open} />
            </span>
          )}
        </button>
      </div>

      {open && (
        <div data-testid="tool-item-detail" className="ml-2 mt-1">
          {item.kind === 'ask_user_question' ? (
            <AskUserQuestionDetail item={item} />
          ) : hasExpandableContent ? (
            <ToolDetailFrame
              testId={isSkillLoad ? 'skill-tool-output' : 'tool-detail-frame'}
              className="space-y-2.5"
            >
              {hasOutput && output && (
                item.kind === 'exec'
                  ? <ExecOutputPanel item={item} />
                  : <OutputPreview output={output} />
              )}
              {                               }
              {item.kind === 'tool' && !output && (
                <div className="px-3 py-2 text-[12px] leading-[1.6] text-text-tertiary">
                  {item.status === 'running' || item.status === 'pending'
                    ? '工具执行中…'
                    : `已调用工具 ${item.name || displayName}`}
                </div>
              )}
              {diff && <DiffView diff={diff} filename={target} maxHeight="320px" className="" />}
            </ToolDetailFrame>
          ) : (
            <div className="text-[12px] text-text-tertiary py-1">
              {statusInfo.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolItemCard;
