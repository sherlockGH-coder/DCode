import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpServerConfig, McpStatus, McpToolEntry } from '../../shared/types';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { mergeProxyEnvironment } from '../proxyEnv';

const CLIENT_INFO = { name: 'dcode-app', version: '0.0.1' };
const CONNECT_TIMEOUT_MS = 15000;

export interface McpToolFull extends McpToolEntry {
  /** 原始 inputSchema（OpenAI tool parameters 兼容） */
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface McpCallResult {
  text: string;
  isError: boolean;
}

export class McpClient {
  readonly serverName: string;
  private readonly config: McpServerConfig;
  private client: Client | null = null;
  private transport: Transport | null = null;
  private ownedServer: Server | null = null;
  private _status: McpStatus = 'idle';
  private _tools: McpToolFull[] = [];
  private _lastError: string | undefined;
  private _instructions: string | undefined;

  constructor(serverName: string, config: McpServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  get status(): McpStatus { return this._status; }
  get tools(): McpToolFull[] { return [...this._tools]; }
  get lastError(): string | undefined { return this._lastError; }
  /** 服务器握手时返回的使用说明（InitializeResult.instructions），未提供则 undefined */
  get instructions(): string | undefined { return this._instructions; }

  async connect(): Promise<void> {
    if (this._status === 'starting' || this._status === 'connected') return;
    this._status = 'starting';
    this._lastError = undefined;

    let tempClient: Client | null = null;
    let tempTransport: Transport | null = null;

    try {
      tempTransport = await this.buildTransport();
      tempClient = new Client(CLIENT_INFO);

      const connectPromise = tempClient.connect(tempTransport);
      await withTimeout(connectPromise, CONNECT_TIMEOUT_MS, 'connect timeout');

      this.client = tempClient;
      this.transport = tempTransport;

      this._instructions = this.client.getInstructions();

      const listed = await this.client.listTools();
      this._tools = (listed.tools ?? []).map((t) => ({
        name: t.name,
        namespacedName: namespaceToolName(this.serverName, t.name),
        description: t.description,
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} },
        annotations: t.annotations,
      }));

      this._status = 'connected';
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err);
      this._status = 'error';

      try { await tempClient?.close(); } catch {              }
      try { await tempTransport?.close(); } catch {              }
      try { await this.ownedServer?.close(); } catch {              }

      this.transport = null;
      this.ownedServer = null;
      this.client = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._status = 'stopped';
    this._tools = [];
    this._instructions = undefined;
    try { await this.client?.close(); } catch {              }
    try { await this.transport?.close(); } catch {              }
    try { await this.ownedServer?.close(); } catch {              }
    this.client = null;
    this.transport = null;
    this.ownedServer = null;
  }

  async callTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<McpCallResult> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server "${this.serverName}" 未连接`);
    }
    const result = await this.client.callTool({ name, arguments: args }, undefined, { signal });
    const isError = !!result.isError;
    const contents = (result.content as Array<Record<string, unknown>> | undefined) ?? [];
    const text = contents
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n') || JSON.stringify(result, null, 2);
    return { text, isError };
  }

  private async buildTransport(): Promise<Transport> {
    if (this.config.transport === 'stdio') {
      return new StdioClientTransport({
        command: this.config.command,
        args: this.config.args ?? [],
        env: mergeProxyEnvironment(this.config.env),
        cwd: this.config.cwd,
      });
    }

    const url = new URL(this.config.url);
    const headers = this.config.headers;

    if (this.config.transport === 'sse') {
      return new SSEClientTransport(url, headers ? { requestInit: { headers } } : undefined);
    }

    try {
      const transport = new StreamableHTTPClientTransport(
        url,
        headers ? { requestInit: { headers } } : undefined,
      );

      return transport;
    } catch {
      return new SSEClientTransport(url, headers ? { requestInit: { headers } } : undefined);
    }
  }
}

export function namespaceToolName(serverName: string, toolName: string): string {

  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mcp__${safe(serverName)}__${safe(toolName)}`;
}

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}
