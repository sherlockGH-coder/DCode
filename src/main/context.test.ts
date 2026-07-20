import { describe, it, expect } from 'vitest';
import {
  getSystemContext,
  formatSystemContext,
  getUserContext,
  formatUserContext,
  formatTailUserContext,
} from './context';

describe('getSystemContext', () => {
  it('包含操作系统信息', () => {
    const ctx = getSystemContext(null);
    expect(ctx.environmentInfo).toBeDefined();
    expect(ctx.environmentInfo).toContain('操作系统');
  });

  it('有 projectPath 时包含项目路径', () => {
    const ctx = getSystemContext('/Users/test/proj');
    expect(ctx.projectPath).toBe('/Users/test/proj');
    expect(ctx.environmentInfo).toContain('/Users/test/proj');
    expect(ctx.environmentInfo).toContain('工具默认工作目录: /Users/test/proj');
  });

  it('无 projectPath 时不含项目路径字段', () => {
    const ctx = getSystemContext(null);
    expect(ctx.projectPath).toBeUndefined();
  });
});

describe('formatSystemContext', () => {
  it('格式化为 # 运行环境 块', () => {
    const ctx = getSystemContext(null);
    const text = formatSystemContext(ctx);
    expect(text).toContain('# 运行环境');
  });

  it('同一环境多次格式化结果一致（缓存稳定）', () => {
    const ctx = getSystemContext('/proj');
    expect(formatSystemContext(ctx)).toBe(formatSystemContext(ctx));
  });
});

describe('getUserContext - currentDate 缓存稳定性', () => {
  it('currentDate 用「天」粒度，不含秒级时间戳', () => {
    const ctx = getUserContext({});
    expect(ctx.currentDate).toBeDefined();

    expect(ctx.currentDate).toMatch(/\d{4}\/\d{2}\/\d{2}/);

    expect(ctx.currentDate).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('同一天内多次调用 currentDate byte 完全一致', () => {
    const ctx1 = getUserContext({});
    const ctx2 = getUserContext({});
    expect(ctx1.currentDate).toBe(ctx2.currentDate);
  });

  it('不会把函数源码注入（回归测试：formatCurrentTime 误用）', () => {
    const ctx = getUserContext({});
    expect(ctx.currentDate).not.toContain('function');
    expect(ctx.currentDate).not.toContain('=>');
    expect(ctx.currentDate).not.toContain('return');
  });
});

describe('getUserContext - 各字段收集', () => {
  it('dcodeMdSources 注入', () => {
    const sources = [
      { filePath: '/home/.dcode/DCODE.md', contents: '全局规则', scope: 'user' as const },
      { filePath: '/proj/DCODE.md', contents: '项目规则', scope: 'project' as const },
    ];
    const ctx = getUserContext({ dcodeMdSources: sources });
    expect(ctx.dcodeMdSources).toEqual(sources);
  });

  it('memoryContext 注入', () => {
    const ctx = getUserContext({ memoryContext: '用户偏好 X' });
    expect(ctx.memoryContext).toBe('用户偏好 X');
  });

  it('enabledSkills 格式化为列表', () => {
    const ctx = getUserContext({
      enabledSkills: [
        { name: 'pdf', description: '处理 PDF' },
        { name: 'code-review', description: '代码审查' },
      ],
    });
    expect(ctx.skillsContext).toContain('pdf: 处理 PDF');
    expect(ctx.skillsContext).toContain('code-review: 代码审查');
  });

  it('空 enabledSkills 不产生 skillsContext', () => {
    const ctx = getUserContext({ enabledSkills: [] });
    expect(ctx.skillsContext).toBeUndefined();
  });

  it('mcpInstructions 按 server 分块', () => {
    const ctx = getUserContext({
      mcpInstructions: [
        { serverName: 'grok-search', instructions: '先 plan_intent 再 web_search' },
        { serverName: 'vision', instructions: '只在允许的附件路径上检视图片' },
      ],
    });
    expect(ctx.mcpInstructionsContext).toContain('## grok-search');
    expect(ctx.mcpInstructionsContext).toContain('先 plan_intent 再 web_search');
    expect(ctx.mcpInstructionsContext).toContain('## vision');
    expect(ctx.mcpInstructionsContext).toContain('只在允许的附件路径上检视图片');
  });

  it('空 mcpInstructions 不产生 mcpInstructionsContext', () => {
    const ctx = getUserContext({ mcpInstructions: [] });
    expect(ctx.mcpInstructionsContext).toBeUndefined();
  });

  it('附件列表格式化', () => {
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
  it('空 context（仅 currentDate）不产生前置 reminder', () => {

    const text = formatUserContext(getUserContext({}));
    expect(text).toBe('');
  });

  it('完全空的 UserContext 返回空字符串', () => {
    const text = formatUserContext({});
    expect(text).toBe('');
  });

  it('包含所有字段时结构完整', () => {
    const ctx = getUserContext({
      dcodeMdSources: [
        { filePath: '/proj/DCODE.md', contents: 'MD内容', scope: 'project' },
      ],
      memoryContext: '记忆',
      enabledSkills: [{ name: 's1', description: 'd1' }],
      mcpInstructions: [{ serverName: 'srv1', instructions: '用法说明' }],
      attachments: [{ path: '/f.txt', mimeType: 'text/plain', size: 100, kind: 'file' }],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('<system-reminder>');
    expect(text).toContain('DCODE.md instructions');
    expect(text).toContain('Contents of /proj/DCODE.md');
    expect(text).toContain('# MCP Server Instructions');
    expect(text).not.toContain('# Memory');
    expect(text).not.toContain('# Available Skills');
    expect(text).not.toContain('# 附件清单');
    expect(text).not.toContain('# 当前日期');
    expect(text).toContain('</system-reminder>');
  });

  it('MCP instructions 渲染为 ## <server> 块', () => {
    const ctx = getUserContext({
      mcpInstructions: [
        { serverName: 'grok-search', instructions: '调用前先规划查询' },
        { serverName: 'filesystem', instructions: '仅访问授权目录' },
      ],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('# MCP Server Instructions');
    expect(text).toContain('## grok-search');
    expect(text).toContain('调用前先规划查询');
    expect(text).toContain('## filesystem');
    expect(text).toContain('仅访问授权目录');
  });

  it('无 MCP instructions 时不产生 MCP 块', () => {
    const text = formatUserContext(getUserContext({}));
    expect(text).not.toContain('# MCP Server Instructions');
  });

  it('相同稳定输入两次格式化 byte 一致（缓存前缀稳定）', () => {
    const sources = [
      { filePath: '/proj/DCODE.md', contents: 'MD', scope: 'project' as const },
    ];
    const opts = {
      dcodeMdSources: sources,
      memoryContext: '记忆',
      enabledSkills: [{ name: 's1', description: 'd1' }],
    };
    const text1 = formatUserContext(getUserContext(opts));
    const text2 = formatUserContext(getUserContext(opts));
    expect(text1).toBe(text2);
    expect(text1).not.toContain('# Memory');
    expect(text1).not.toContain('# Available Skills');
  });

  it('DCODE.md 用 <INSTRUCTIONS> 包裹', () => {
    const ctx = getUserContext({
      dcodeMdSources: [
        { filePath: '/p/DCODE.md', contents: '内容', scope: 'project' },
      ],
    });
    const text = formatUserContext(ctx);
    expect(text).toContain('<INSTRUCTIONS>');
    expect(text).toContain('</INSTRUCTIONS>');
  });
});

describe('formatTailUserContext', () => {
  it('空 context（仅 currentDate）产生尾部日期 reminder', () => {
    const text = formatTailUserContext(getUserContext({}));
    expect(text).toContain('<system-reminder>');
    expect(text).toContain('# 当前日期');
  });

  it('完全空的 UserContext 返回空字符串', () => {
    const text = formatTailUserContext({});
    expect(text).toBe('');
  });

  it('尾部 reminder 包含动态上下文，不包含 DEEPSEEK/MCP 稳定上下文', () => {
    const ctx = getUserContext({
      dcodeMdSources: [
        { filePath: '/proj/DCODE.md', contents: 'MD内容', scope: 'project' },
      ],
      memoryContext: '记忆',
      enabledSkills: [{ name: 's1', description: 'd1' }],
      mcpInstructions: [{ serverName: 'srv1', instructions: '用法说明' }],
      attachments: [{ path: '/f.txt', mimeType: 'text/plain', size: 100, kind: 'file' }],
    });
    const text = formatTailUserContext(ctx);
    expect(text).toContain('# Memory');
    expect(text).toContain('# Available Skills');
    expect(text).toContain('# 附件清单');
    expect(text).toContain('# 当前日期');
    expect(text).not.toContain('DCODE.md instructions');
    expect(text).not.toContain('# MCP Server Instructions');
  });
});
