import React, { useState } from 'react';
import type { McpScope, McpServerConfig, McpServerStatus, McpTransport } from '../../../shared/types';
import { parseMcpServerJson } from '../../utils/mcpJsonConfig';
import { IconX } from '../icons';
import { PrimaryButton, SecondaryButton, settingsInputClass, settingsMonoInputClass } from '../settings/SettingsPrimitives';

interface Props {
  scope: McpScope;
  initial?: McpServerStatus | null;
  onClose: () => void;
  onSave: (name: string, config: McpServerConfig) => Promise<boolean>;
}

interface KeyValueRow {
  key: string;
  value: string;
}

const LABEL_CLS = 'mb-2 block text-[11px] font-semibold text-text-tertiary';
const MONO_TEXTAREA_CLS = `${settingsMonoInputClass} min-h-[64px] resize-none py-2`;
const JSON_TEXTAREA_CLS = `${settingsMonoInputClass} min-h-[118px] resize-y py-2 leading-relaxed`;
const JSON_PLACEHOLDER = `{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`;

function mapToRows(map?: Record<string, string>): KeyValueRow[] {
  if (!map) return [];
  return Object.entries(map).map(([key, value]) => ({ key, value }));
}

function rowsToMap(rows: KeyValueRow[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  let hasAny = false;
  for (const r of rows) {
    if (!r.key.trim()) continue;
    out[r.key.trim()] = r.value;
    hasAny = true;
  }
  return hasAny ? out : undefined;
}

const ServerEditorModal: React.FC<Props> = ({ scope, initial, onClose, onSave }) => {
  const isEditing = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [transport, setTransport] = useState<McpTransport>(initial?.config.transport ?? 'stdio');

  const initStdio = initial?.config.transport === 'stdio' ? initial.config : null;
  const [command, setCommand] = useState(initStdio?.command ?? '');
  const [argsRaw, setArgsRaw] = useState((initStdio?.args ?? []).join(' '));
  const [cwd, setCwd] = useState(initStdio?.cwd ?? '');
  const [env, setEnv] = useState<KeyValueRow[]>(mapToRows(initStdio?.env));

  const initHttp = initial?.config.transport === 'http' || initial?.config.transport === 'sse' ? initial.config : null;
  const [url, setUrl] = useState(initHttp?.url ?? '');
  const [headers, setHeaders] = useState<KeyValueRow[]>(mapToRows(initHttp?.headers));

  const [jsonRaw, setJsonRaw] = useState('');
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyJsonConfig = (raw: string) => {
    try {
      const parsed = parseMcpServerJson(raw);
      const config = parsed.config;

      if (!isEditing && parsed.name) {
        setName(parsed.name);
      }

      setTransport(config.transport);
      if (config.transport === 'stdio') {
        setCommand(config.command);
        setArgsRaw((config.args ?? []).join(' '));
        setCwd(config.cwd ?? '');
        setEnv(mapToRows(config.env));
      } else {
        setUrl(config.url);
        setHeaders(mapToRows(config.headers));
      }

      setJsonStatus('已填充字段');
      setError(null);
    } catch (err) {
      setJsonStatus(null);
      setError(err instanceof Error ? err.message : 'JSON 解析失败');
    }
  };

  const handleJsonChange = (raw: string) => {
    setJsonRaw(raw);
    setJsonStatus(null);
    if (raw.trim()) {
      applyJsonConfig(raw);
    } else {
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('名称不能为空');
      return;
    }
    let config: McpServerConfig;
    if (transport === 'stdio') {
      if (!command.trim()) {
        setError('command 不能为空');
        return;
      }
      const argsArr = argsRaw.match(/\S+/g) ?? [];
      config = {
        transport: 'stdio',
        command: command.trim(),
        args: argsArr,
        env: rowsToMap(env),
        cwd: cwd.trim() || undefined,
      };
    } else if (transport === 'http' || transport === 'sse') {
      if (!url.trim()) {
        setError('URL 不能为空');
        return;
      }
      config = {
        transport,
        url: url.trim(),
        headers: rowsToMap(headers),
      };
    } else {
      setError('协议不支持');
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await onSave(name.trim(), config);
    setSaving(false);
    if (ok) onClose();
    else setError('保存失败');
  };

  const scopeLabel: Record<McpScope, string> = {
    user: '全局',
    project: '项目',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-[560px] max-w-full flex-col overflow-hidden rounded-[10px] border border-black/[0.08] bg-white shadow-2xl dark:border-white/[0.08] dark:bg-[#1E1E20]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <h2 className="text-[17px] font-semibold text-text-primary">
            {isEditing ? '编辑' : '添加'} {scopeLabel[scope]} MCP 服务器
          </h2>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-black/[0.04] text-text-tertiary transition-colors hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
            onClick={onClose}
            aria-label="关闭"
          >
            <IconX size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div>
            <label className={LABEL_CLS}>JSON 配置</label>
            <textarea
              rows={5}
              value={jsonRaw}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder={JSON_PLACEHOLDER}
              className={JSON_TEXTAREA_CLS}
            />
            {jsonStatus && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {jsonStatus}
              </p>
            )}
          </div>

          <div>
            <label className={LABEL_CLS}>名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditing}
              placeholder="filesystem, memory, sqlite"
              className={settingsInputClass}
            />
            {isEditing && <p className="mt-1 text-[11px] text-text-tertiary italic">名称不可修改</p>}
          </div>

          <div>
            <label className={LABEL_CLS}>协议</label>
            <div className="flex gap-1 rounded-[8px] bg-[#F1F1F3] p-1 dark:bg-white/[0.07]">
              {(['stdio', 'http', 'sse'] as McpTransport[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`flex-1 rounded-[7px] py-1.5 text-[13px] font-semibold transition-all ${transport === t ? 'bg-white text-[#111827] shadow-sm dark:bg-[#2A2A2D] dark:text-white' : 'bg-transparent text-text-tertiary hover:text-text-secondary'}`}
                  onClick={() => setTransport(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-black/[0.055] dark:border-white/[0.07]" />

          {transport === 'stdio' ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className={LABEL_CLS}>命令</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                  className={settingsMonoInputClass}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>参数</label>
                <textarea
                  rows={2}
                  value={argsRaw}
                  onChange={(e) => setArgsRaw(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-memory"
                  className={MONO_TEXTAREA_CLS}
                />
              </div>
              <div>
                <label className={LABEL_CLS}>工作目录</label>
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/Users/me/projects/my-app"
                  className={settingsMonoInputClass}
                />
              </div>
              <KeyValueEditor label="环境变量" rows={env} onChange={setEnv} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className={LABEL_CLS}>URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp-server.example.com/sse"
                  className={settingsMonoInputClass}
                />
              </div>
              <KeyValueEditor label="请求头" rows={headers} onChange={setHeaders} />
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 text-[12px] text-red-600 font-medium dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-black/[0.06] px-6 py-4 dark:border-white/[0.07]">
          <SecondaryButton
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存...' : '保存'}
          </PrimaryButton>
        </footer>
      </div>
    </div>
  );
};

const KeyValueEditor: React.FC<{
  label: string;
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
}> = ({ label, rows, onChange }) => {
  const update = (i: number, patch: Partial<KeyValueRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const addRow = () => onChange([...rows, { key: '', value: '' }]);
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="KEY"
              className={`${settingsMonoInputClass} flex-1`}
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="VALUE"
              className={`${settingsMonoInputClass} flex-[2]`}
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-transparent text-text-tertiary transition-colors hover:bg-red-50 hover:text-red-500"
              onClick={() => removeRow(i)}
              title="移除"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="w-full rounded-[7px] border border-black/[0.08] bg-white py-1.5 text-[12px] font-semibold text-text-tertiary transition-colors hover:bg-[#F7F7F8] hover:text-text-secondary dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          onClick={addRow}
        >
          + 添加
        </button>
      </div>
    </div>
  );
};

export default ServerEditorModal;
