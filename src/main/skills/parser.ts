export interface RawSkill {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const KV_RE = /^([\w-]+)\s*:\s*(.*)$/;

function unquote(v: string): string {
  const trimmed = v.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((s) => unquote(s))
      .filter(Boolean);
  }
  return unquote(trimmed);
}

export function parseFrontmatter(raw: string): RawSkill {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, body: raw };

  const [, yamlBlock, body] = match;
  const fm: Record<string, unknown> = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(KV_RE);
    if (!m) continue;
    const [, key, value] = m;
    fm[key] = parseValue(value);
  }

  return { frontmatter: fm, body };
}

/** 反向：把 frontmatter + body 拼回完整 markdown 文本（编辑器保存用） */
export function stringifyFrontmatter(fm: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      const items = value.map((v) => String(v).trim()).filter(Boolean);
      if (items.length === 0) continue;
      lines.push(`${key}: [${items.join(', ')}]`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n') + body.replace(/^\n+/, '');
}
