import { resolveInside } from '../pathSandbox';

export type FilePermissionTool =
  | 'read_file'
  | 'grep'
  | 'glob'
  | 'write_file'
  | 'edit_file';

const PROJECT_SCOPED_READONLY_TOOLS = new Set<string>(['read_file', 'grep', 'glob']);
const PROJECT_SCOPED_FILE_TOOLS = new Set<string>([
  'write_file',
  'edit_file',
]);

export interface OutOfScopeFileAccess {
  absolutePath: string;
  projectRoot: string | null;
}

export function isProjectScopedReadonlyTool(name: string): boolean {
  return PROJECT_SCOPED_READONLY_TOOLS.has(name);
}

export function isProjectScopedFileTool(name: string): boolean {
  return PROJECT_SCOPED_FILE_TOOLS.has(name);
}

function pathArgForTool(name: string, args: Record<string, unknown>): string | null {
  switch (name) {
    case 'read_file': {
      const raw = args.file_path;
      return typeof raw === 'string' && raw.length > 0 ? raw : null;
    }
    case 'write_file':
    case 'edit_file': {
      const raw = args.file_path;
      return typeof raw === 'string' && raw.length > 0 ? raw : null;
    }
    case 'grep':
    case 'glob': {
      const raw = args.path;
      return typeof raw === 'string' && raw.length > 0 ? raw : '.';
    }
    default:
      return null;
  }
}

export function detectOutOfScopeFileAccess(
  name: string,
  args: Record<string, unknown>,
  projectPath: string | null,
): OutOfScopeFileAccess | null {
  if (!isProjectScopedFileTool(name) && !isProjectScopedReadonlyTool(name)) return null;

  const rawPath = pathArgForTool(name, args);
  if (!rawPath) return null;

  const { absolutePath, isInside } = resolveInside(rawPath, projectPath);
  if (!projectPath) return { absolutePath, projectRoot: null };
  if (isInside) return null;
  return { absolutePath, projectRoot: projectPath };
}
