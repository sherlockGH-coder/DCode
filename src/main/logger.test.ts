import { describe, expect, it } from 'vitest';
import { formatCurlCommand } from './logger';

describe('formatCurlCommand', () => {
  it('formats a copyable curl command with redacted headers and JSON body', () => {
    const command = formatCurlCommand({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': '$ANTHROPIC_API_KEY',
        'content-type': 'application/json',
      },
      body: {
        model: 'claude-sonnet-test',
        stream: true,
        messages: [{ role: 'user', content: "run user's tests" }],
      },
    });

    expect(command).toContain("curl 'https://api.anthropic.com/v1/messages'");
    expect(command).toContain("-H 'x-api-key: $ANTHROPIC_API_KEY'");
    expect(command).toContain("-H 'content-type: application/json'");
    expect(command).toContain(`"stream": true`);
    expect(command).toContain(`run user'\\''s tests`);
  });
});
