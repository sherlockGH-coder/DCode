/**
 * 终端输出缓冲。
 *
 * 此前实现是 `buffer += data` 再 `buffer.slice(-MAX)`：缓冲一旦填满，
 * 每来一个 chunk 都要复制整个 256KB 字符串，长时间跑高输出量的进程
 * （构建日志、`tail -f`）会退化成 O(n²)。
 *
 * 这里改成分片队列 + running length，追加与淘汰都是摊还 O(1)，
 * 只有真正读取时才拼接。
 */
export class TerminalOutputBuffer {
  private chunks: string[] = [];
  private length = 0;

  constructor(private readonly maxLength: number) {}

  append(data: string): void {
    if (data.length === 0) return;

    this.chunks.push(data);
    this.length += data.length;

    // 丢弃最旧的整片，直到回到上限之内
    while (this.length > this.maxLength && this.chunks.length > 1) {
      this.length -= this.chunks.shift()!.length;
    }

    // 单片本身就超限时，只保留尾部
    if (this.length > this.maxLength && this.chunks.length === 1) {
      const only = this.chunks[0];
      this.chunks[0] = only.slice(only.length - this.maxLength);
      this.length = this.chunks[0].length;
    }
  }

  /** 拼接出当前缓冲内容。仅在 attach 回放时调用。 */
  read(): string {
    if (this.chunks.length === 0) return '';
    if (this.chunks.length > 1) {
      // 顺手压实，后续重复读取就不用再拼
      this.chunks = [this.chunks.join('')];
    }
    return this.chunks[0];
  }

  get size(): number {
    return this.length;
  }

  clear(): void {
    this.chunks = [];
    this.length = 0;
  }
}
