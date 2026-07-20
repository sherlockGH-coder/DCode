export type WorkspaceBreadcrumbSegmentKind = 'root' | 'directory' | 'file';

export interface WorkspaceBreadcrumbSegment {
  id: string;
  label: string;
  kind: WorkspaceBreadcrumbSegmentKind;
  path?: string;
}

interface BuildWorkspaceBreadcrumbInput {
  title: string;
  filePath?: string;
  projectPath?: string | null;
}

export function normalizeWorkspacePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/');
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/g, '');
}

export function fileNameFromPath(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  return splitPath(normalized).at(-1) || normalized;
}

export function buildWorkspaceBreadcrumbSegments({
  title,
  filePath,
  projectPath,
}: BuildWorkspaceBreadcrumbInput): WorkspaceBreadcrumbSegment[] {
  const cleanTitle = title.trim();
  const normalizedFilePath = filePath ? normalizeWorkspacePath(filePath) : '';
  const normalizedProjectPath = projectPath ? normalizeWorkspacePath(projectPath) : '';

  if (!normalizedFilePath) {
    return cleanTitle ? [createSegment(cleanTitle, 'file')] : [];
  }

  if (normalizedProjectPath && isRelativePath(normalizedFilePath)) {
    return buildProjectRelativeSegments(normalizedProjectPath, normalizedFilePath);
  }

  if (normalizedProjectPath && isInsidePath(normalizedFilePath, normalizedProjectPath)) {
    const relativePath = normalizedFilePath.slice(normalizedProjectPath.length).replace(/^\/+/, '');
    return buildProjectRelativeSegments(normalizedProjectPath, relativePath);
  }

  return buildPathSegments(normalizedFilePath);
}

function buildProjectRelativeSegments(
  projectPath: string,
  relativePath: string,
): WorkspaceBreadcrumbSegment[] {
  const projectName = fileNameFromPath(projectPath);
  const rootSegment = createSegment(projectName, 'root', projectPath);
  const relativeSegments = splitPath(relativePath);

  if (relativeSegments.length === 0) return [rootSegment];

  return [
    rootSegment,
    ...relativeSegments.map((segment, index) => {
      const segmentPath = joinPath(projectPath, ...relativeSegments.slice(0, index + 1));
      const kind = index === relativeSegments.length - 1 ? 'file' : 'directory';
      return createSegment(segment, kind, segmentPath);
    }),
  ];
}

function buildPathSegments(path: string): WorkspaceBreadcrumbSegment[] {
  const segments = splitPath(path);
  if (segments.length === 0) return [createSegment(path, 'file', path)];

  return segments.map((segment, index) => {
    const segmentPath = path.startsWith('/')
      ? `/${segments.slice(0, index + 1).join('/')}`
      : segments.slice(0, index + 1).join('/');
    const kind = index === segments.length - 1 ? 'file' : 'directory';
    return createSegment(segment, kind, segmentPath);
  });
}

function createSegment(
  label: string,
  kind: WorkspaceBreadcrumbSegmentKind,
  path?: string,
): WorkspaceBreadcrumbSegment {
  return {
    id: path ? `${kind}:${path}` : `${kind}:${label}`,
    label,
    kind,
    path,
  };
}

function isInsidePath(path: string, parentPath: string): boolean {
  if (!path || !parentPath) return false;
  if (path === parentPath) return true;
  return path.startsWith(`${parentPath}/`);
}

function isRelativePath(path: string): boolean {
  return !path.startsWith('/') && !/^[A-Za-z]:\//.test(path);
}

function joinPath(...parts: string[]): string {
  return parts
    .map((part) => normalizeWorkspacePath(part))
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
}

function splitPath(path: string): string[] {
  return normalizeWorkspacePath(path).split('/').filter(Boolean);
}
