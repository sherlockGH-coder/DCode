import { resolve } from 'node:path';
import { projectManager } from './project';

export function resolveKnownProjectPath(projectPath: string | null | undefined): string | null {
  if (typeof projectPath !== 'string' || projectPath.trim() === '') return null;

  const resolvedPath = resolve(projectPath);
  const known = projectManager.getState().projects.some((project) => {
    return project.path === resolvedPath;
  });

  return known ? resolvedPath : null;
}
