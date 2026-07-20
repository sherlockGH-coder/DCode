import { ToolExecutor, ToolExecuteResult } from './types';
import { writeFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { homedir } from 'node:os';
import { resolveInside } from '../pathSandbox';
import { buildLineDiff, buildAllAddedDiff } from './diffUtil';
import { skillsManager } from '../skills/manager';
import { getFullReadFileState, rememberFileMutation } from './readFile';
import { debugLog } from '../logger';

function isENOENT(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export const writeFileTool: ToolExecutor = {
  definition: {
    name: 'write_file',
    description: 'Writes a file to the local filesystem, overwriting if the path exists. You must read the file with `read_file` first if it already exists, otherwise the tool will fail. Prefer `edit` for modifications (it only sends the diff); use this only for new files or full rewrites. Never create documentation (*.md, README) unless explicitly asked. Avoid adding emojis unless requested.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['file_path', 'content'],
      additionalProperties: false,
    },
    strict: true,
  },

  async execute(args, ctx): Promise<ToolExecuteResult> {
    let rawPath = args.file_path as string;
    if (!rawPath) {
      throw new Error('write_file requires file_path');
    }
    const content = args.content as string;

    if (rawPath.startsWith('~') && (rawPath.length === 1 || rawPath[1] === '/')) {
      rawPath = join(homedir(), rawPath.slice(1));
    }
    debugLog('tool', '写入文件:', rawPath);

    const { absolutePath: filePath } = resolveInside(rawPath, ctx.projectPath);

    try {

      let isNew = true;
      let oldContent = '';
      try {
        const info = await stat(filePath);
        isNew = false;
        const lastRead = getFullReadFileState(filePath);
        if (!lastRead) {
          throw new Error('File has not been read yet. Read it first before writing to it.');
        }
        if (lastRead.mtimeMs !== info.mtimeMs || lastRead.size !== info.size) {
          throw new Error('File has been modified since read. Read it again before attempting to write it.');
        }
        oldContent = await readFile(filePath, 'utf-8');
      } catch (err) {
        if (!isENOENT(err)) throw err;
        isNew = true;
      }

      await mkdir(dirname(filePath), { recursive: true });

      await writeFile(filePath, content, 'utf-8');
      const newInfo = await stat(filePath);
      rememberFileMutation(filePath, { mtimeMs: newInfo.mtimeMs, size: newInfo.size });

      const skillDirFragment = join('.agents', 'skills') + sep;
      if (filePath.includes(skillDirFragment)) {
        skillsManager.scheduleBroadcast();
      }

      const diff = isNew ? buildAllAddedDiff(content) : buildLineDiff(oldContent, content);

      return {
        content: `文件写入成功: ${filePath}`,
        metadata: { kind: 'write', path: filePath, isNew, diff },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(`写入文件失败: ${error}`);
    }
  },
};
