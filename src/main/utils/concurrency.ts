/**
 * 有界并发工具。
 *
 * 文件系统密集的工具（grep / glob）此前逐个 `await`，串行读取整棵树。
 * 用固定大小的 worker 池能把墙钟时间压到接近 I/O 上限，同时避免一次性
 * 打开成千上万个文件描述符。
 */

/** 默认并发度：足够跑满 SSD，又远低于常见的文件描述符上限。 */
export const DEFAULT_IO_CONCURRENCY = 24;

/**
 * 以最多 `limit` 个并发对 `items` 执行 `worker`，结果按输入顺序返回。
 *
 * `worker` 抛出的异常会中断整体（与 `Promise.all` 一致），调用方若要忽略
 * 单项失败，应在 `worker` 内部自行 catch。
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
