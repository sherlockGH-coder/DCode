import type { McpServerConfig, McpTransport } from '../../shared/types';

interface ParsedMcpJsonConfig {
  name?: string;
  config: McpServerConfig;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function primitiveToString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  if (!isJsonObject(value)) return undefined;

  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.trim();
    const normalizedValue = primitiveToString(item);
    if (!normalizedKey || normalizedValue === null) continue;
    out[normalizedKey] = normalizedValue;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const out = value
      .map(primitiveToString)
      .filter((item): item is string => item !== null);
    return out.length > 0 ? out : undefined;
  }

  if (typeof value === 'string') {
    return value.match(/\S+/g) ?? [];
  }

  return undefined;
}

function readTransport(value: JsonObject): McpTransport | undefined {
  const raw = value.transport ?? value.type;
  if (raw === 'stdio' || raw === 'http' || raw === 'sse') return raw;
  return undefined;
}

function extractServer(raw: JsonObject): { name?: string; config: JsonObject } {
  if (isJsonObject(raw.mcpServers)) {
    const entries = Object.entries(raw.mcpServers).filter((entry): entry is [string, JsonObject] =>
      isJsonObject(entry[1]),
    );

    if (entries.length === 0) {
      throw new Error('mcpServers 中没有可用的 server 配置');
    }

    if (entries.length > 1) {
      throw new Error('一次只能导入一个 MCP server JSON');
    }

    const [name, config] = entries[0];
    return { name, config };
  }

  if (isJsonObject(raw.config)) {
    return { name: nonEmptyString(raw.name), config: raw.config };
  }

  return { name: nonEmptyString(raw.name), config: raw };
}

function normalizeConfig(raw: JsonObject): McpServerConfig {
  const transport = readTransport(raw);

  if (transport === 'stdio' || (!transport && typeof raw.command === 'string')) {
    const command = nonEmptyString(raw.command);
    if (!command) {
      throw new Error('stdio 配置缺少 command');
    }

    return {
      transport: 'stdio',
      command,
      args: stringArray(raw.args),
      env: stringRecord(raw.env),
      cwd: nonEmptyString(raw.cwd),
    };
  }

  if (transport === 'http' || transport === 'sse' || (!transport && typeof raw.url === 'string')) {
    const url = nonEmptyString(raw.url);
    if (!url) {
      throw new Error('远程 MCP 配置缺少 URL');
    }

    return {
      transport: transport === 'sse' ? 'sse' : 'http',
      url,
      headers: stringRecord(raw.headers),
    };
  }

  throw new Error('JSON 中没有可识别的 MCP 配置字段');
}

export function parseMcpServerJson(raw: string): ParsedMcpJsonConfig {
  if (!raw.trim()) {
    throw new Error('JSON 不能为空');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON 格式不正确');
  }

  if (!isJsonObject(parsed)) {
    throw new Error('JSON 顶层必须是对象');
  }

  const server = extractServer(parsed);
  return {
    name: server.name,
    config: normalizeConfig(server.config),
  };
}
