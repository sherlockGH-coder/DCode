let _cwd = '';
let _home = '';

/** Initialize the path base, called when App starts. */
export function initPathContext(cwd: string, home: string): void {
  _cwd = cwd;
  _home = home;
}

/** Get the current path context. */
export function getPathContext(): { cwd: string; home: string } {
  return { cwd: _cwd, home: _home };
}

/** Collapse a path. */
export function collapsePath(absolutePath: string): string {
  if (!absolutePath) return absolutePath;

  if (_cwd && absolutePath.startsWith(_cwd)) {
    const rel = absolutePath.slice(_cwd.length);
    return './' + (rel.startsWith('/') ? rel.slice(1) : rel);
  }

  if (_home && absolutePath.startsWith(_home)) {
    const rel = absolutePath.slice(_home.length);
    return '~' + (rel.startsWith('/') ? rel : '/' + rel);
  }

  return absolutePath;
}
