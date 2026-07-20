import { describe, expect, it } from 'vitest';
import { waitForAbortableDelay } from './signals';

describe('abortable agent delays', () => {
  it('ends retry backoff immediately when the user aborts', async () => {
    const controller = new AbortController();
    const waiting = waitForAbortableDelay(60_000, controller.signal);
    controller.abort();

    await expect(waiting).resolves.toBe(false);
  });
});
