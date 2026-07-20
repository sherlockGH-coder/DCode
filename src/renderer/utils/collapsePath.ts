let _cwd = '';
let _home = '';

/** 初始化路径基准（由 App 启动时调用） */
export function initPathContext(cwd: string, home: string): void {
  _cwd = cwd;
  _home = home;
}

/** 获取当前路径上下文 */
export function getPathContext(): { cwd: string; home: string } {
  return { cwd: _cwd, home: _home };
}

/** 折叠路径 */
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
