import { useEffect, useState } from 'react';

/**
 * Return whether the panel has ever been activated.
 *
 * Defer mounting heavy panels until the user opens them for the first time.
 * Keep them mounted afterward so collapsing and expanding does not lose internal state, such as terminal scrollback.
 */
export function useMountAfterFirstUse(active: boolean): boolean {
  const [mounted, setMounted] = useState(active);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  return mounted;
}
