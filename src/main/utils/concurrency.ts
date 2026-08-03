/**
 * Bounded-concurrency utility.
 *
 * File-system-heavy tools such as grep and glob previously awaited each file sequentially.
 * A fixed-size worker pool approaches the I/O wall-clock limit while avoiding thousands of file descriptors at once.
 */

/** Default concurrency: enough to saturate an SSD and well below common file-descriptor limits. */
export const DEFAULT_IO_CONCURRENCY = 24;

/**
 * Run `worker` on `items` with at most `limit` concurrent tasks and return results in input order.
 *
 * An exception from `worker` aborts the whole operation, matching `Promise.all`; callers that want to ignore
 * individual failures should catch inside `worker`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const total = items.length;
  if (total === 0) return [];

  const effectiveLimit = Math.max(1, Math.min(Math.trunc(limit) || 1, total));
  const results = new Array<R>(total);
  let cursor = 0;

  const runners = Array.from({ length: effectiveLimit }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= total) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
