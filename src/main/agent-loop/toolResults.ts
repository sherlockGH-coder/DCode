import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_TOOL_RESULT_SIZE, TOOL_RESULT_PREVIEW_SIZE } from './constants';

export function truncateToolResult(content: string, toolName: string): string {
  if (content.length <= MAX_TOOL_RESULT_SIZE) return content;

  try {
    const dir = join(tmpdir(), 'dcode-tool-results');
    mkdirSync(dir, { recursive: true });
    const filename = `${toolName}-${Date.now()}-${randomUUID().slice(0, 8)}.txt`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, content, 'utf-8');
    const preview = content.slice(0, TOOL_RESULT_PREVIEW_SIZE);
    return `${preview}\n\n... [结果已截断: ${content.length} 字符 → ${TOOL_RESULT_PREVIEW_SIZE} 字符预览] 完整内容已保存至: ${filepath}`;
  } catch {

    const preview = content.slice(0, TOOL_RESULT_PREVIEW_SIZE);
    return `${preview}\n\n... [结果已截断: ${content.length} 字符]`;
  }
}
