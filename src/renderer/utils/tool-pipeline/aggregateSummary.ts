import type { ToolItem } from '../../../shared/types';
import type { SegmentSummary } from './types';

function computeSummary(items: ToolItem[]): SegmentSummary {
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

function formatSummary(summary: SegmentSummary): string {
  const parts: string[] = [];
  const count = (value: number, unit: string) => `${value} ${unit}`;

  const fileOps = summary.writeCount + summary.editCount + summary.readCount;
  if (fileOps > 0) {
    const fileParts: string[] = [];
    if (summary.writeCount > 0) fileParts.push(`${count(summary.writeCount, 'files')} created`);
    if (summary.editCount > 0) fileParts.push(`${count(summary.editCount, 'files')} edited`);
    if (summary.readCount > 0) fileParts.push(`${count(summary.readCount, 'files')} read`);

    if (summary.writeCount === fileOps) {
      parts.push(`${count(fileOps, 'files')} created`);
    } else if (summary.editCount === fileOps) {
      parts.push(`${count(fileOps, 'files')} edited`);
    } else if (summary.readCount === fileOps) {
      parts.push(`${count(fileOps, 'files')} read`);
    } else {
      parts.push(`${count(fileOps, 'files')} processed (${fileParts.join(', ')})`);
    }
  }

  if (summary.execCount > 0) {
    parts.push(`${count(summary.execCount, 'commands')} run`);
  }

  const searches = summary.grepCount + summary.globCount;
  if (searches > 0) {
    parts.push(`${count(searches, 'searches')} performed`);
  }

  const web = summary.webSearchCount + summary.webFetchCount;
  if (web > 0) {
    const webParts: string[] = [];
    if (summary.webSearchCount > 0) webParts.push(`${count(summary.webSearchCount, 'searches')} searched`);
    if (summary.webFetchCount > 0) webParts.push(`${count(summary.webFetchCount, 'pages')} fetched`);
    parts.push(`Web operations: ${count(web, 'operations')} (${webParts.join(', ')})`);
  }

  if (summary.otherCount > 0) {
    parts.push(`${count(summary.otherCount, 'tools')} called`);
  }

  const base = parts.join(', ') || 'Ready';
  const status: string[] = [];
  if (summary.hasRunning) status.push('running');

  return status.length ? `${base} (${status.join(', ')})` : base;
}

/** Generate an aggregate summary from a list of ToolItems. */
export function aggregateSummary(items: ToolItem[]): string {
  return formatSummary(computeSummary(items));
}
