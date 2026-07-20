export interface ParsedSlashCommand {
  name: string;
  rest: string;
}

const SLASH_COMMAND_TOKEN_RE = /(^|\s)\/([^\s/]+)(?=\s|$)/g;
const LEADING_SLASH_COMMAND_RE = /^\s*\/([^\s/]+)(?=\s|$)([\s\S]*)$/;

export function formatSlashCommandsForTitle(value: string): string {
  return value.trim().replace(
    SLASH_COMMAND_TOKEN_RE,
    (_match, prefix: string, name: string) => `${prefix}$${name}`,
  );
}

export function parseLeadingSlashCommand(value: string): ParsedSlashCommand | null {
  const match = value.match(LEADING_SLASH_COMMAND_RE);
  if (!match) return null;

  return {
    name: match[1],
    rest: match[2].replace(/^[ \t]+/, ''),
  };
}
