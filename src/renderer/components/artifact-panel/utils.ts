import { normalizeWorkspacePath } from '../../utils/workspaceBreadcrumb';

export function stripDiffSuffix(title: string): string {
  return title.replace(/\s*\(diff\)$/i, '');
}

export function dirPathFromFilePath(filePath: string | undefined): string | null {
  if (!filePath) return null;
  const normalized = normalizeWorkspacePath(filePath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) return null;
  return normalized.slice(0, lastSlashIndex);
}
