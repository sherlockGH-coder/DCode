export interface TerminalDimensions {
  cols: number;
  rows: number;
}

export interface TerminalLayout {
  rendererCols: number;
  ptyCols: number;
  rows: number;
}

const MINIMUM_TERMINAL_COLS = 2;

const RIGHT_PROMPT_SAFE_COLUMNS = 2;

/**
 * Keep zsh RPROMPT content out of the final terminal column. Some prompts use
 * zero right indentation, while xterm treats writing the final cell as a
 * pending wrap. A second column covers FitAddon's subpixel rounding so the
 * complete prompt remains visible after large window resizes.
 */
export function createTerminalLayout(
  proposed: TerminalDimensions,
): TerminalLayout {
  return {
    rendererCols: proposed.cols,
    ptyCols: Math.max(
      MINIMUM_TERMINAL_COLS,
      proposed.cols - RIGHT_PROMPT_SAFE_COLUMNS,
    ),
    rows: proposed.rows,
  };
}
