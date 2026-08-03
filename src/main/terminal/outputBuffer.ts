/**
 * Terminal output buffer.
 *
 * The previous implementation used `buffer += data` followed by `buffer.slice(-MAX)`.
 * Once full, every chunk copied the entire 256 KB string, degrading to O(n²) for
 * long-running high-output processes such as build logs and `tail -f`.
 *
 * Use a chunk queue and running length instead. Appending and eviction are amortized O(1);
 * concatenate only when the buffer is actually read.
 */
export class TerminalOutputBuffer {
  private chunks: string[] = [];
  private length = 0;

  constructor(private readonly maxLength: number) {}

  append(data: string): void {
    if (data.length === 0) return;

    this.chunks.push(data);
    this.length += data.length;

    // Discard the oldest complete chunks until under the limit.
    while (this.length > this.maxLength && this.chunks.length > 1) {
      this.length -= this.chunks.shift()!.length;
    }

    // If one chunk exceeds the limit by itself, keep only its tail.
    if (this.length > this.maxLength && this.chunks.length === 1) {
      const only = this.chunks[0];
      this.chunks[0] = only.slice(only.length - this.maxLength);
      this.length = this.chunks[0].length;
    }
  }

  /** Concatenate the current buffer contents; called only when replaying on attach. */
  read(): string {
    if (this.chunks.length === 0) return '';
    if (this.chunks.length > 1) {
      // Compact while reading so repeated reads do not concatenate again.
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
