import { BrowserWindow } from 'electron';
import { mcpStore } from './store';
import { McpClient } from './client';
import { bridgeMcpTool } from './toolBridge';
import { toolRegistry } from '../tools';
import { IPC_EVENTS } from '../../shared/types';
import { debugLog } from '../logger';
import type {
  McpScope, McpServerConfig, McpServerStatus, McpToolEntry,
} from '../../shared/types';

const BROADCAST_DEBOUNCE_MS = 200;

interface Entry {
  name: string;
  scope: McpScope;
  enabled: boolean;
  config: McpServerConfig;
  client: McpClient | null;
  registeredToolNames: string[];
}

function key(scope: McpScope, name: string): string {
  return `${scope}:${name}`;
}

class McpManager {
  private entries = new Map<string, Entry>();
  private currentProjectPath: string | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private disabledKey = new Set<string>();

  async loadAll(activeProjectPath: string | null): Promise<void> {
    this.currentProjectPath = activeProjectPath;

    const userMap = mcpStore.loadUser();
    for (const [name, config] of Object.entries(userMap)) {
      this.entries.set(key('user', name), {
        name, scope: 'user', enabled: !this.disabledKey.has(key('user', name)),
        config, client: null, registeredToolNames: [],
      });
    }

    if (activeProjectPath) {
      const projMap = mcpStore.loadProject(activeProjectPath);
      for (const [name, config] of Object.entries(projMap)) {
        this.entries.set(key('project', name), {
          name, scope: 'project', enabled: !this.disabledKey.has(key('project', name)),
          config, client: null, registeredToolNames: [],
        });
      }
    }

    await Promise.allSettled(
      Array.from(this.entries.values())
        .filter((e) => e.enabled)
        .map((e) => this.startEntry(e)),
    );

    this.scheduleBroadcast();
  }

  async refreshForProject(newProjectPath: string | null): Promise<void> {
    if (newProjectPath === this.currentProjectPath) return;

    const projectKeys = Array.from(this.entries.keys()).filter((k) => k.startsWith('project:'));
    await Promise.allSettled(projectKeys.map((k) => this.stopByKey(k)));
    for (const k of projectKeys) this.entries.delete(k);

    this.currentProjectPath = newProjectPath;

    if (newProjectPath) {
      const projMap = mcpStore.loadProject(newProjectPath);
      for (const [name, config] of Object.entries(projMap)) {
        const k = key('project', name);
        const enabled = !this.disabledKey.has(k);
        this.entries.set(k, { name, scope: 'project', enabled, config, client: null, registeredToolNames: [] });
        if (enabled) {
          this.startEntry(this.entries.get(k)!).catch(() => undefined);
        }
      }
    }

    this.scheduleBroadcast();
  }

  async addServer(scope: McpScope, name: string, config: McpServerConfig, projectPath: string | null): Promise<boolean> {
    if (!name.trim()) return false;
    const map = scope === 'user' ? mcpStore.loadUser() : (projectPath ? mcpStore.loadProject(projectPath) : null);
    if (!map) return false;
    map[name] = config;
    if (scope === 'user') mcpStore.writeUser(map);
    else if (projectPath) mcpStore.writeProject(projectPath, map);

    const k = key(scope, name);

    if (this.entries.has(k)) await this.stopByKey(k);
    this.entries.set(k, { name, scope, enabled: true, config, client: null, registeredToolNames: [] });
    this.disabledKey.delete(k);

    this.startEntry(this.entries.get(k)!).catch(() => undefined);
    this.scheduleBroadcast();
    return true;
  }

  async updateServer(scope: McpScope, name: string, config: McpServerConfig, projectPath: string | null): Promise<boolean> {
    const k = key(scope, name);
    const entry = this.entries.get(k);
    if (!entry) return false;
    const map = scope === 'user' ? mcpStore.loadUser() : (projectPath ? mcpStore.loadProject(projectPath) : null);
    if (!map) return false;
    map[name] = config;
    if (scope === 'user') mcpStore.writeUser(map);
    else if (projectPath) mcpStore.writeProject(projectPath, map);

    entry.config = config;

    await this.stopByKey(k);
    if (entry.enabled) {
      this.startEntry(entry).catch(() => undefined);
    }
    this.scheduleBroadcast();
    return true;
  }

  async removeServer(scope: McpScope, name: string, projectPath: string | null): Promise<boolean> {
    const k = key(scope, name);
    await this.stopByKey(k);
    this.entries.delete(k);
    const map = scope === 'user' ? mcpStore.loadUser() : (projectPath ? mcpStore.loadProject(projectPath) : null);
    if (map) {
      delete map[name];
      if (scope === 'user') mcpStore.writeUser(map);
      else if (projectPath) mcpStore.writeProject(projectPath, map);
    }
    this.scheduleBroadcast();
    return true;
  }

  async toggleServer(scope: McpScope, name: string, enabled: boolean): Promise<boolean> {
    const k = key(scope, name);
    const entry = this.entries.get(k);
    if (!entry) return false;
    entry.enabled = enabled;
    if (enabled) {
      this.disabledKey.delete(k);
      await this.startEntry(entry).catch(() => undefined);
    } else {
      this.disabledKey.add(k);
      await this.stopByKey(k);
    }
    this.scheduleBroadcast();
    return true;
  }

  async restartServer(scope: McpScope, name: string): Promise<boolean> {
    const k = key(scope, name);
    const entry = this.entries.get(k);
    if (!entry) return false;
    await this.stopByKey(k);
    if (entry.enabled) {
      this.startEntry(entry).catch(() => undefined);
    }
    this.scheduleBroadcast();
    return true;
  }

  getStatusList(): McpServerStatus[] {
    const out: McpServerStatus[] = [];
    for (const entry of this.entries.values()) {
      const tools: McpToolEntry[] = entry.client?.tools.map((t) => ({
        name: t.name,
        namespacedName: t.namespacedName,
        description: t.description,
      })) ?? [];
      out.push({
        name: entry.name,
        scope: entry.scope,
        enabled: entry.enabled,
        config: entry.config,
        status: entry.client?.status ?? (entry.enabled ? 'idle' : 'stopped'),
        tools,
        lastError: entry.client?.lastError,
      });
    }

    out.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'user' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  }

  /**
   * 收集所有已连接 server 的 instructions（服务器使用说明）。
   * 仅返回 status === 'connected' 且声明了非空 instructions 的 server。
   * 用于注入 userContext，让模型知道每个 MCP server「何时用、怎么用」。
   */
  getActiveInstructions(): Array<{ name: string; scope: McpScope; instructions: string }> {
    const out: Array<{ name: string; scope: McpScope; instructions: string }> = [];
    for (const entry of this.entries.values()) {
      if (entry.client?.status !== 'connected') continue;
      const instructions = entry.client.instructions?.trim();
      if (!instructions) continue;
      out.push({ name: entry.name, scope: entry.scope, instructions });
    }

    out.sort((a, b) => {
      const rank = (s: McpScope) => (s === 'user' ? 0 : 1);
      if (rank(a.scope) !== rank(b.scope)) return rank(a.scope) - rank(b.scope);
      return a.name.localeCompare(b.name);
    });
    return out;
  }

  async stopAll(): Promise<void> {
    const keys = Array.from(this.entries.keys());
    await Promise.allSettled(keys.map((k) => this.stopByKey(k)));
  }

  private async startEntry(entry: Entry): Promise<void> {
    if (entry.client) return;
    const client = new McpClient(entry.name, entry.config);
    entry.client = client;
    this.scheduleBroadcast();

    try {
      await client.connect();

      const newToolNames: string[] = [];
      for (const tool of client.tools) {
        toolRegistry.register(bridgeMcpTool(client, tool));
        newToolNames.push(tool.namespacedName);
      }
      entry.registeredToolNames = newToolNames;
      debugLog('mcp', `connected: ${entry.scope}:${entry.name} (${newToolNames.length} tools)`);
    } catch (err) {
      console.warn(`[mcp] 启动失败 ${entry.scope}:${entry.name}:`, err instanceof Error ? err.message : err);
    } finally {
      this.scheduleBroadcast();
    }
  }

  private async stopByKey(k: string): Promise<void> {
    const entry = this.entries.get(k);
    if (!entry) return;

    for (const name of entry.registeredToolNames) {
      toolRegistry.unregister(name);
    }
    entry.registeredToolNames = [];

    if (entry.client) {
      try { await entry.client.disconnect(); } catch {              }
      entry.client = null;
    }
  }

  private scheduleBroadcast(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.broadcast(), BROADCAST_DEBOUNCE_MS);
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_EVENTS.MCP_CHANGED);
    }
  }
}

export const mcpManager = new McpManager();
