import type { ToolItem } from '../../shared/types';
import type { RenderUnit } from './tool-pipeline';
import { collapsePath } from './collapsePath';

/** 单条 ToolItem → Markdown */
function entryToMarkdown(item: ToolItem): string {
  switch (item.kind) {
    case 'read': {
      const lines = item.lineCount ? ` (${item.lineCount} lines)` : '';
      const output = item.output
        ? `\n\`\`\`text\n${item.output}\n\`\`\``
        : '';
      return `<details><summary>Read \`${collapsePath(item.path)}\`${lines}</summary>${output}\n</details>`;
    }
    case 'write': {
      const label = item.isNew ? 'Created' : 'Wrote';
      return `<details><summary>${label} \`${collapsePath(item.path)}\`</summary>\n</details>`;
    }
    case 'edit': {
      const parts: string[] = [];
      if (item.linesAdded) parts.push(`+${item.linesAdded}`);
      if (item.linesDeleted) parts.push(`-${item.linesDeleted}`);
      const diff = parts.length ? ` ${parts.join(' ')}` : '';
      const output = item.diff
        ? `\n\`\`\`diff\n${item.diff}\n\`\`\``
        : '';
      return `<details><summary>Edited \`${collapsePath(item.path)}\`${diff}</summary>${output}\n</details>`;
    }
    case 'exec': {
      const dur = item.duration != null ? ` (${(item.duration / 1000).toFixed(1)}s)` : '';
      const status = item.status === 'error' ? 'Failed' : 'Success';
      const output = item.output
        ? `\n\`\`\`text\n${item.output}\n\`\`\``
        : '';
      return `<details><summary>Ran \`${item.command}\`${dur}</summary>\n\`\`\`bash\n$ ${item.command}\n\`\`\`${output}\nStatus: ${status}\n</details>`;
    }
    case 'grep': {
      const matchInfo = item.matchCount != null
        ? ` — ${item.matchCount} match${item.matchCount !== 1 ? 'es' : ''}${item.fileCount != null ? ` in ${item.fileCount} file${item.fileCount !== 1 ? 's' : ''}` : ''}`
        : '';
      return `已搜索 \`${item.pattern}\`${matchInfo}`;
    }
    case 'glob': {
      const matchInfo = item.matchCount != null
        ? ` — ${item.matchCount} file${item.matchCount !== 1 ? 's' : ''}`
        : '';
      return `Found files matching \`${item.pattern}\`${matchInfo}`;
    }
    case 'web_search': {
      const resultInfo = item.resultCount != null ? ` — ${item.resultCount} result${item.resultCount !== 1 ? 's' : ''}` : '';
      const output = item.output ? `\n\n${item.output}` : '';
      return `已搜索网页 \`${item.query}\`${resultInfo}${output}`;
    }
    case 'web_fetch': {
      const charInfo = item.charCount != null ? ` (${(item.charCount / 1000).toFixed(1)}k chars, ${item.provider ?? 'local'})` : '';
      const output = item.output ? `\n\n${item.output}` : '';
      return `Fetched \`${item.url}\`${charInfo}${output}`;
    }
    case 'list_directory': {
      const entryInfo = item.totalCount != null ? ` (${item.totalCount} entries)` : '';
      const output = item.output ? `\n\n${item.output}` : '';
      return `Listed \`${collapsePath(item.path)}\`${entryInfo}${output}`;
    }
    default:
      return '';
  }
}

/** 递归渲染 RenderUnit → Markdown */
function unitToMarkdown(unit: RenderUnit): string {
  switch (unit.kind) {
    case 'entry':
      return entryToMarkdown(unit.item);

    case 'exploration-group': {
      const inner = unit.items.map(entryToMarkdown).join('\n');
      return `<details><summary>${unit.summary}</summary>\n${inner}\n</details>`;
    }

    case 'collapsed-segment': {
      const inner = unit.units.map(unitToMarkdown).join('\n\n');
      return `> ${unit.summary}\n\n${inner}`;
    }

    case 'expanded-segment':
      return unit.units.map(unitToMarkdown).join('\n\n');

    default:
      return '';
  }
}

/** 将整个管线输出转为 Markdown 文本 */
export function renderToolMarkdown(units: RenderUnit[]): string {
  if (units.length === 0) return '';
  return units.map(unitToMarkdown).join('\n\n');
}
