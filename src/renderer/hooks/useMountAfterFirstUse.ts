import { useEffect, useState } from 'react';

/**
 * 返回「是否曾经激活过」。
 *
 * 用于把重型面板的挂载推迟到用户第一次真正打开它：首次激活前不挂载，
 * 激活之后就保持挂载，这样折叠/展开不会丢失面板内部状态（比如终端回滚缓冲）。
 */
export function useMountAfterFirstUse(active: boolean): boolean {
  const [mounted, setMounted] = useState(active);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  return mounted;
}
