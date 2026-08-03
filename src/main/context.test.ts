import { describe, it, expect } from 'vitest';
import {
  getSystemContext,
  formatSystemContext,
  getUserContext,
  formatUserContext,
  formatTailUserContext,
} from './context';

describe('getSystemContext', () => {
  it('includes operating system information', () => {
    const ctx = getSystemContext(null);
    expect(ctx.environmentInfo).toBeDefined();
    expect(ctx.environmentInfo).toContain('Operating system');
  });

  it('includes the project path when projectPath is set', () => {
    const ctx = getSystemContext('/Users/test/proj');
    expect(ctx.projectPath).toBe('/Users/test/proj');
    expect(ctx.environmentInfo).toContain('/Users/test/proj');
    expect(ctx.environmentInfo).toContain('Default tool working directory: /Users/test/proj');
  });

  it('omits the project path field when projectPath is not set', () => {
    const ctx = getSystemContext(null);
    expect(ctx.projectPath).toBeUndefined();
  });

  it('allows a remote runner to override the host environment description', () => {
    const ctx = getSystemContext(null, '- Operating system: Harbor Linux sandbox\n- Tool connected to an isolated task container');
    expect(ctx.environmentInfo).toContain('Harbor Linux sandbox');
    expect(ctx.environmentInfo).not.toContain('macOS');
  });
});

describe('formatSystemContext', () => {
  it('formats an # Environment block', () => {
    const ctx = getSystemContext(null);
    const text = formatSystemContext(ctx);
    expect(text).toContain('# Runtime environment');
  });

  it('formats the same environment identically on repeated calls (stable cache)', () => {
    const ctx = getSystemContext('/proj');
    expect(formatSystemContext(ctx)).toBe(formatSystemContext(ctx));
  });
});

describe('getUserContext - currentDate cache stability', () => {
  it('currentDate has day-level granularity and no seconds-level timestamp', () => {
    const ctx = getUserContext({});
    expect(ctx.currentDate).toBeDefined();

    expect(ctx.currentDate).toMatch(/\d{4}\/\d{2}\/\d{2}/);

    expect(ctx.currentDate).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('returns byte-identical currentDate values on the same day', () => {
    const ctx1 = getUserContext({});
    const ctx2 = getUserContext({});
    expect(ctx1.currentDate).toBe(ctx2.currentDate);
  });

  it('does not inject function source (regression test for accidental formatCurrentTime use)', () => {
    const ctx = getUserContext({});
    expect(ctx.currentDate).not.toContain('function');
    expect(ctx.currentDate).not.toContain('=>');
    expect(ctx.currentDate).not.toContain('return');
  });
});

describe('getUserContext - field collection', () => {
  it('injects deepseekMdSources', () => {
    const sources = [
      { filePath: '/home/.deepseek/DEEPSEEK.md', contents: 'Global rules', scope: 'user' as const },
      { filePath: '/proj/DEEPSEEK.md', contents: 'Project rules', scope: 'project' as const },
    ];
    const ctx = getUserContext({ deepseekMdSources: sources });
    expect(ctx.deepseekMdSources).toEqual(sources);
  });

  it('injects memoryContext', () => {
    const ctx = getUserContext({ memoryContext: 'User preference X' });
    expect(ctx.memoryContext).toBe('User preference X');
  });

  it('formats enabledSkills as a list', () => {
    const ctx = getUserContext({
      enabledSkills: [
        { name: 'pdf', description: 'Process PDFs' },
        { name: 'code-review', description: 'Review code' },
      ],
    });
    expect(ctx.skillsContext).toContain('pdf: Process PDFs');
    expect(ctx.skillsContext).toContain('code-review: Review code');
  });

  it('does not create skillsContext for empty enabledSkills', () => {
    const ctx = getUserContext({ enabledSkills: [] });
    expect(ctx.skillsContext).toBeUndefined();
  });

  it('groups mcpInstructions by server', () => {
    const ctx = getUserContext({
      mcpInstructions: [
        { serverName: 'grok-search', instructions: 'Run plan_intent before web_search' },
        { serverName: 'vision', instructions: 'Inspect images only at allowed attachment paths' },
      ],
    });
    expect(ctx.mcpInstructionsContext).toContain('## grok-search');
    expect(ctx.mcpInstructionsContext).toContain('Run plan_intent before web_search');
    expect(ctx.mcpInstructionsContext).toContain('## vision');
    expect(ctx.mcpInstructionsContext).toContain('Inspect images only at allowed attachment paths');
  });

  it('does not create mcpInstructionsContext for empty mcpInstructions', () => {
    const ctx = getUserContext({ mcpInstructions: [] });
    expect(ctx.mcpInstructionsContext).toBeUndefined();
  });

  it('formats the attachment list', () => {
    const ctx = getUserContext({
      attachments: [
        { path: '/a.txt', mimeType: 'text/plain', size: 2048, kind: 'file' },
      ],
    });
    expect(ctx.attachmentsContext).toContain('/a.txt');
    expect(ctx.attachmentsContext).toContain('text/plain');
  });

});

describe('formatUserContext', () => {
  it('does not create a leading reminder for an empty context (currentDate only)', () => {

    const text = formatUserContext(getUserContext({}));
    expect(text).toBe('');
  });

  it('returns an empty string for a completely empty UserContext', () => {
    const text = formatUserContext({});
    expect(text).toBe('');
  });

  it('has the complete structure when all fields are present', () => {
    const ctx = getUserContext({
      deepseekMdSources: [
        { filePath: '/proj/DEEPSEEK.md', contents: 'Markdown content', scope: 'project' },
      ],
      memoryContext: 'Memory content',
      enabledSkills: [{ name: 's1', description: 'd1' }],
      mcpInstructions: [{ serverName: 'srv1', instructions: 'Usage instructions' }],
      attachments: [{ path: '/f.txt', mimeType: 'text/plain', size: 100, kind: 'file' }],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('<system-reminder>');
    expect(text).toContain('DEEPSEEK.md instructions');
    expect(text).toContain('Contents of /proj/DEEPSEEK.md');
    expect(text).toContain('# MCP Server Instructions');
    expect(text).not.toContain('# Memory');
    expect(text).not.toContain('# Available Skills');
    expect(text).not.toContain('# Attachments');
    expect(text).not.toContain('# Current date');
    expect(text).toContain('</system-reminder>');
  });

  it('renders MCP instructions as ## <server> blocks', () => {
    const ctx = getUserContext({
      mcpInstructions: [
        { serverName: 'grok-search', instructions: 'Plan the query before calling' },
        { serverName: 'filesystem', instructions: 'Access authorized directories only' },
      ],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('# MCP Server Instructions');
    expect(text).toContain('## grok-search');
    expect(text).toContain('Plan the query before calling');
    expect(text).toContain('## filesystem');
    expect(text).toContain('Access authorized directories only');
  });

  it('does not create an MCP block when there are no MCP instructions', () => {
    const text = formatUserContext(getUserContext({}));
    expect(text).not.toContain('# MCP Server Instructions');
  });

  it('formats identical stable input to identical bytes twice (stable cache prefix)', () => {
    const sources = [
      { filePath: '/proj/DEEPSEEK.md', contents: 'MD', scope: 'project' as const },
    ];
    const opts = {
      deepseekMdSources: sources,
      memoryContext: 'Memory content',
      enabledSkills: [{ name: 's1', description: 'd1' }],
    };
    const text1 = formatUserContext(getUserContext(opts));
    const text2 = formatUserContext(getUserContext(opts));
    expect(text1).toBe(text2);
    expect(text1).not.toContain('# Memory');
    expect(text1).not.toContain('# Available Skills');
  });

  it('wraps DEEPSEEK.md in <INSTRUCTIONS>', () => {
    const ctx = getUserContext({
      deepseekMdSources: [
        { filePath: '/p/DEEPSEEK.md', contents: 'Content', scope: 'project' },
      ],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('<INSTRUCTIONS>');
    expect(text).toContain('</INSTRUCTIONS>');
  });
});

describe('formatTailUserContext', () => {
  it('creates a trailing date reminder for an empty context (currentDate only)', () => {
    const text = formatTailUserContext(getUserContext({}));
    expect(text).toContain('<system-reminder>');
    expect(text).toContain('# Current date');
  });

  it('returns an empty string for a completely empty UserContext', () => {
    const text = formatTailUserContext({});
    expect(text).toBe('');
  });

  it('trailing reminders include dynamic context but not stable DEEPSEEK/MCP context', () => {
    const ctx = getUserContext({
      deepseekMdSources: [
        { filePath: '/proj/DEEPSEEK.md', contents: 'Markdown content', scope: 'project' },
      ],
      memoryContext: 'Memory content',
      enabledSkills: [{ name: 's1', description: 'd1' }],
      mcpInstructions: [{ serverName: 'srv1', instructions: 'Usage instructions' }],
      attachments: [{ path: '/f.txt', mimeType: 'text/plain', size: 100, kind: 'file' }],
    });
    const text = formatTailUserContext(ctx);
    expect(text).toContain('# Memory');
    expect(text).toContain('# Available Skills');
    expect(text).toContain('# Attachments');
    expect(text).toContain('# Current date');
    expect(text).not.toContain('DEEPSEEK.md instructions');
    expect(text).not.toContain('# MCP Server Instructions');
  });
});
