export type DiffLine =
  | { type: 'meta'; text: string }
  | { type: 'hunk'; text: string; oldStart: number; newStart: number }
  | { type: 'gap' }
  | { type: 'add'; text: string; newLineNum: number }
  | { type: 'del'; text: string; oldLineNum: number }
  | { type: 'ctx'; text: string; oldLineNum: number; newLineNum: number };

export type ContentDiffLine = Extract<DiffLine, { type: 'add' | 'del' | 'ctx' }>;
