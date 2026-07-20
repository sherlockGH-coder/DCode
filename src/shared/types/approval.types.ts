export type ApprovalKind =
  | 'bash_exec'
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'grep'
  | 'glob'
  | 'web_search'
  | 'web_fetch'
  | 'external_tool'
  | 'ask_user_question';

export interface AskUserQuestionPayload {
  question: string;
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

export interface PendingApprovalRequest {
  toolCallId: string;
  kind: ApprovalKind;
  command: string;
  description?: string;
  cwd: string | null;
  traceId?: string;
  conversationId?: string | null;
  turnId?: string;
  attemptNo?: number;
  targetWebContentsId?: number;
  diffPreview?: string;
  outOfScope?: {
    absolutePath: string;
    projectRoot: string | null;
  };
  questions?: AskUserQuestionPayload[];
}
