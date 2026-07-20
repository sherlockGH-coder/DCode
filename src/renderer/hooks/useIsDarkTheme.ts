import { useEffect, useState } from 'react';

/**
 * 跟踪根元素 `.dark` class 的实时状态，供 JS 侧主题化组件
 * （如 react-syntax-highlighter 的 oneLight/oneDark 切换）使用。
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
