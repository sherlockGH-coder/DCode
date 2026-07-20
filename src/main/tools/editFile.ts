import { ToolExecutor, ToolExecuteResult } from './types';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { resolveInside } from '../pathSandbox';
import { buildLineDiff } from './diffUtil';
import { getFullReadFileState, rememberFileMutation } from './readFile';
import { debugLog } from '../logger';

export const editFileTool: ToolExecutor = {
  definition: {
    name: 'edit_file',
    description:
      'Performs exact string replacements in files. You must read the file with `read_file` before editing — the tool will error otherwise. When extracting `old_string` from read output, use only the content after the line number prefix (number + tab), preserving exact indentation. `old_string` must be unique in the file: if not, either add more surrounding context or use `replace_all` to update every occurrence (e.g. for renames). Prefer editing existing files over creating new ones, and avoid inserting emojis unless asked.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The text to replace',
        },
        new_string: {
          type: 'string',
          description: 'The text to replace it with (must be different from old_string)',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurences of old_string (default false)',
          default: false,
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
      additionalProperties: false,
    },
    strict: true,
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    let rawPath = args.file_path as string;
    if (!rawPath) {
      throw new Error('edit_file requires file_path');
    }

    if (rawPath.startsWith('~') && (rawPath.length === 1 || rawPath[1] === '/')) {
      rawPath = join(homedir(), rawPath.slice(1));
    }
    const oldString = args.old_string as string;
    const newString = args.new_string as string;
    const replaceAll = (args.replace_all as boolean) ?? false;
    debugLog('tool', '编辑文件:', rawPath);

    const { absolutePath: filePath } = resolveInside(rawPath, ctx.projectPath);

    try {
      if (oldString === newString) {
        throw new Error('No changes to make: old_string and new_string are exactly the same.');
      }

      let content: string;
      try {
        const info = await stat(filePath);
        const lastRead = getFullReadFileState(filePath);
        if (!lastRead) {
          throw new Error('File has not been read yet. Read it first before editing it.');
        }
        if (lastRead.mtimeMs !== info.mtimeMs || lastRead.size !== info.size) {
          throw new Error('File has been modified since read. Read it again before attempting to edit it.');
        }
        content = await readFile(filePath, 'utf-8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        if (oldString !== '') {
          throw new Error('File does not exist. Use old_string: "" only when creating a new file with edit_file.');
        }
        content = '';
      }

      let newContent: string;
      if (oldString === '') {
        if (content.length > 0) {
          throw new Error('old_string: "" can only be used to create a new file.');
        }
        newContent = newString;
      } else if (replaceAll) {
        if (!content.includes(oldString)) {
          throw new Error(`在文件中未找到匹配的文本:\n${oldString}`);
        }
        newContent = content.split(oldString).join(newString);
      } else {

        if (!content.includes(oldString)) {
          throw new Error(`在文件中未找到匹配的文本:\n${oldString}`);
        }

        const firstIdx = content.indexOf(oldString);

        const secondIdx = content.indexOf(oldString, firstIdx + oldString.length);
        if (secondIdx !== -1) {
          throw new Error(
            `找到多处匹配（至少 2 处），请提供更多的上下文使 old_string 唯一，或设置 replace_all: true`
          );
        }
        newContent = content.replace(oldString, newString);
      }

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, newContent, 'utf-8');
      const newInfo = await stat(filePath);
      rememberFileMutation(filePath, { mtimeMs: newInfo.mtimeMs, size: newInfo.size });

      const oldLines = oldString.split('\n');
      const newLines = newString.split('\n');
      const linesDeleted = oldLines.length;
      const linesAdded = newLines.length;

      const diff = buildLineDiff(content, newContent, 1, 1);

      return {
        content: `文件编辑成功: ${filePath}`,
        metadata: { kind: 'edit', path: filePath, linesAdded, linesDeleted, diff },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`编辑文件失败: ${error}`);
    }
  },
};
