import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { app } from 'electron';
import type { Message } from '../../shared/types';
import { agentLoop } from '../agentLoop';
import { settingsManager } from '../settings';
import { ToolRegistry, type ToolExecutor } from '../tools/types';

const PROTOCOL_PREFIX = 'DCODE_BENCH:';
const DEFAULT_TOOL_TIMEOUT_MS = 120_000;
const MAX_TOOL_TIMEOUT_MS = 600_000;

app.setName('DeepSeek-Dev');
app.setPath(
  'userData',
  process.env.DEEPSEEK_BENCHMARK_USER_DATA_DIR
    || join(app.getPath('appData'), 'DeepSeek-Dev'),
);

interface InitMessage {
  type: 'init';
  instruction: string;
}

interface ToolResponse {
  type: 'tool_response';
  id: string;
  stdout?: string;
  stderr?: string;
  returnCode: number;
}

type IncomingMessage = InitMessage | ToolResponse;

interface ToolRequestResult {
  stdout: string;
  stderr: string;
  returnCode: number;
}

function emit(payload: Record<string, unknown>): void {
  process.stdout.write(`${PROTOCOL_PREFIX}${JSON.stringify(payload)}\n`);
}

class HarborBridge {
  private readonly pending = new Map<string, {
    resolve: (value: ToolRequestResult) => void;
    reject: (error: Error) => void;
  }>();

  private initResolve!: (message: InitMessage) => void;
  private initReject!: (error: Error) => void;
  readonly initialized = new Promise<InitMessage>((resolve, reject) => {
    this.initResolve = resolve;
    this.initReject = reject;
  });

  constructor() {
    const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    input.on('line', (line) => this.handleLine(line));
    input.on('close', () => {
      const error = new Error('Harbor adapter closed the benchmark protocol stream');
      this.initReject(error);
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
  }

  request(command: string, timeoutMs: number): Promise<ToolRequestResult> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      emit({ type: 'tool_request', id, command, timeoutMs });
    });
  }

  private handleLine(line: string): void {
    let message: IncomingMessage;
    try {
      message = JSON.parse(line) as IncomingMessage;
    } catch {
      return;
    }

    if (message.type === 'init') {
      if (typeof message.instruction !== 'string' || !message.instruction.trim()) {
        this.initReject(new Error('Benchmark instruction is empty'));
        return;
      }
      this.initResolve(message);
      return;
    }

    if (message.type === 'tool_response') {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      request.resolve({
        stdout: message.stdout ?? '',
        stderr: message.stderr ?? '',
        returnCode: message.returnCode,
      });
    }
  }
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_TOOL_TIMEOUT_MS;
  }
  return Math.min(Math.trunc(value), MAX_TOOL_TIMEOUT_MS);
}

function maxToolRounds(): number {
  const configured = Number(process.env.DCODE_BENCHMARK_MAX_TOOL_ROUNDS);
  return Number.isFinite(configured) && configured > 0
    ? Math.trunc(configured)
    : 50;
}

function createBenchmarkToolRegistry(bridge: HarborBridge): ToolRegistry {
  const registry = new ToolRegistry();
  const shellTool: ToolExecutor = {
    definition: {
      name: 'bash_exec',
      description: 'Execute a shell command inside the isolated Terminal-Bench task container. Shell state does not persist between calls, so include the working directory in each command when needed. Use this tool for all environment inspection and modifications.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute in the task container.' },
          description: { type: 'string', description: 'Short description of the command.' },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default 120000, maximum 600000).',
            minimum: 1,
            maximum: MAX_TOOL_TIMEOUT_MS,
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
    async execute(args) {
      const command = args.command;
      if (typeof command !== 'string' || !command.trim()) {
        throw new Error('bash_exec requires a non-empty command');
      }
      const startedAt = Date.now();
      const result = await bridge.request(command, normalizeTimeout(args.timeout));
      const chunks: string[] = [];
      if (result.stdout) chunks.push(result.stdout);
      if (result.stderr) chunks.push(`[stderr]\n${result.stderr}`);
      const content = chunks.join('\n') || 'Command completed with no output.';
      return {
        content,
        error: result.returnCode !== 0,
        metadata: {
          kind: 'exec',
          command,
          exitCode: result.returnCode,
          duration: Date.now() - startedAt,
          outputLines: content.split('\n').length,
        },
      };
    },
  };
  registry.register(shellTool);
  return registry;
}

const BENCHMARK_SYSTEM_PROMPT = `You are an autonomous terminal agent solving a task in an isolated Linux container.

Use bash_exec for every environment interaction, including reading and editing files. Work until the requested task is complete and verify the result in the container. Shell state does not persist between tool calls, so use explicit paths or include cd in each command when needed. Do not ask the user questions. Do not merely describe commands or provide instructions: execute the work. Your final response should concisely state the completed result.`;

async function run(): Promise<void> {
  await app.whenReady();
  settingsManager.load();
  settingsManager.assertActiveApiProfileSupported();

  const bridge = new HarborBridge();
  const { instruction } = await bridge.initialized;
  const toolRegistry = createBenchmarkToolRegistry(bridge);
  const messages: Message[] = [{ id: randomUUID(), role: 'user', content: instruction }];
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheTokens = 0;

  const finalContent = await agentLoop(
    messages,
    toolRegistry,
    {
      onChunk: () => {},
      onReasoningChunk: () => {},
      onToolCallStart: () => {},
      onToolCallEnd: () => {},
      onDone: () => {},
      onError: (error) => { throw error; },
      onAssistantMessage: (message) => {
        if (!message.usage) return;
        inputTokens += message.usage.prompt_tokens ?? 0;
        outputTokens += message.usage.completion_tokens ?? 0;
        cacheTokens += message.usage.prompt_cache_hit_tokens ?? 0;
      },
      onToolMessage: () => {},
    },
    {
      apiKey: settingsManager.getApiKey(),
      baseUrl: settingsManager.getBaseUrl(),
      model: settingsManager.getPublic().api.defaultModel,
      projectPath: null,
      environmentInfoOverride: '- 操作系统: Linux (Harbor isolated task container)\n- bash_exec executes inside the task container, not on the macOS host',
      systemPrompt: BENCHMARK_SYSTEM_PROMPT,
      conversationId: null,
      approvalPolicy: 'auto-approve',
      maxToolRounds: maxToolRounds(),
    },
  );

  emit({
    type: 'result',
    finalContent,
    usage: { inputTokens: inputTokens + cacheTokens, outputTokens, cacheTokens },
    model: settingsManager.getPublic().api.defaultModel,
  });
}

run()
  .catch((error) => {
    emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  })
  .finally(() => app.quit());
