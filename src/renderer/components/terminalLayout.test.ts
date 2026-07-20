import { describe, expect, it } from 'vitest';
import { createTerminalLayout } from './terminalLayout';

describe('createTerminalLayout', () => {
  it('keeps prompt and pixel-rounding columns free for a zero-indent zsh RPROMPT', () => {
    expect(createTerminalLayout({ cols: 120, rows: 24 })).toEqual({
      rendererCols: 120,
      ptyCols: 118,
      rows: 24,
    });
  });

  it('preserves xterm minimum dimensions', () => {
    expect(createTerminalLayout({ cols: 2, rows: 1 })).toEqual({
      rendererCols: 2,
      ptyCols: 2,
      rows: 1,
    });
  });
});
