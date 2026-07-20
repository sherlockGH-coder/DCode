import type { ToolItem } from '../../../shared/types';
import type { SegmentSummary } from './types';

export function computeSummary(items: ToolItem[]): SegmentSummary {
  const summary: SegmentSummary = {
    readCount: 0,
    writeCount: 0,
    editCount: 0,
    execCount: 0,
    grepCount: 0,
    globCount: 0,
    webSearchCount: 0,
    webFetchCount: 0,
    totalFiles: 0,
    otherCount: 0,
    hasRunning: false,
    hasError: false,
  };

  for (const item of items) {
    if (item.status === 'running' || item.status === 'pending') summary.hasRunning = true;
    if (item.status === 'error') summary.hasError = true;

    switch (item.kind) {
      case 'read':
        summary.readCount++;
        summary.totalFiles++;
        break;
      case 'write':
        summary.writeCount++;
        summary.totalFiles++;
        break;
      case 'edit':
        summary.editCount++;
        summary.totalFiles++;
        break;
      case 'exec':
        summary.execCount++;
        break;
      case 'grep':
        summary.grepCount++;
        break;
      case 'glob':
        summary.globCount++;
        break;
      case 'web_search':
        summary.webSearchCount++;
        break;
      case 'web_fetch':
        summary.webFetchCount++;
        break;

      case 'vision':
      case 'list_directory':
      case 'task':
      case 'plan_update':
      case 'agent':
      case 'tool':
      case 'ask_user_question':
        summary.otherCount++;
        break;
    }
  }

  return summary;
}

export function formatSummary(summary: SegmentSummary): string {
  const parts: string[] = [];
  const count = (value: number, unit: string) => `${value} ${unit}`;

  const fileOps = summary.writeCount + summary.editCount + summary.readCount;
  if (fileOps > 0) {
    const fileParts: string[] = [];
    if (summary.writeCount > 0) fileParts.push(`${count(summary.writeCount, '个')}已创建`);
    if (summary.editCount > 0) fileParts.push(`${count(summary.editCount, '个')}已编辑`);
    if (summary.readCount > 0) fileParts.push(`${count(summary.readCount, '个')}已读取`);

    if (summary.writeCount === fileOps) {
      parts.push(`已创建 ${count(fileOps, '个文件')}`);
    } else if (summary.editCount === fileOps) {
      parts.push(`已编辑 ${count(fileOps, '个文件')}`);
    } else if (summary.readCount === fileOps) {
      parts.push(`已读取 ${count(fileOps, '个文件')}`);
    } else {
      parts.push(`已处理 ${count(fileOps, '个文件')}（${fileParts.join('， ')}）`);
    }
  }

  if (summary.execCount > 0) {
    parts.push(`已运行 ${count(summary.execCount, '个命令')}`);
  }

  const searches = summary.grepCount + summary.globCount;
  if (searches > 0) {
    parts.push(`已检索 ${count(searches, '次')}`);
  }

  const web = summary.webSearchCount + summary.webFetchCount;
  if (web > 0) {
    const webParts: string[] = [];
    if (summary.webSearchCount > 0) webParts.push(`${count(summary.webSearchCount, '次')}搜索`);
    if (summary.webFetchCount > 0) webParts.push(`${count(summary.webFetchCount, '个')}页面`);
    parts.push(`网页操作 ${count(web, '次')}（${webParts.join('， ')}）`);
  }

  if (summary.otherCount > 0) {
    parts.push(`已调用 ${count(summary.otherCount, '个工具')}`);
  }

  const base = parts.join('， ') || '已就绪';
  const status: string[] = [];
  if (summary.hasRunning) status.push('运行中');

  return status.length ? `${base}（${status.join('， ')}）` : base;
}

/** 从 ToolItem 列表生成聚合摘要 */
export function aggregateSummary(items: ToolItem[]): string {
  return formatSummary(computeSummary(items));
}
