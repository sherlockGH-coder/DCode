import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function sse(events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

function toolResponse(id: string, name: string, input: Record<string, unknown>): string {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name, input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ]);
}

function textResponse(text: string): string {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

async function stopElectron(app: ElectronApplication): Promise<void> {
  const closed = new Promise<void>((resolveClosed) => app.once('close', () => resolveClosed()));
  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    electronApp.quit();
  }).catch(() => undefined);
  await closed;
}

function stopServer(server: Server): void {
  server.closeAllConnections();
  server.close();
}

async function launchFixture(
  responder: (
    requestIndex: number,
    body: Record<string, unknown>,
    response: ServerResponse,
  ) => string | undefined,
): Promise<{
  app: ElectronApplication;
  page: Page;
  requests: Record<string, unknown>[];
  server: Server;
}> {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      requests.push(parsed);
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        connection: 'close',
      });
      const responseBody = responder(requests.length, parsed, response);
      if (responseBody !== undefined) response.end(responseBody);
    });
  });
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');

  const userData = mkdtempSync(join(tmpdir(), 'deepseek-interactions-e2e-'));
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{
      id: 'default',
      name: 'E2E',
      protocol: 'anthropic',
      baseUrl: `http://127.0.0.1:${address.port}`,
      models: ['e2e-model'],
      defaultModel: 'e2e-model',
      apiKeyPlain: 'e2e-key',
    }],
    activeApiProfileId: 'default',
  }));
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userData },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, requests, server };
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const composer = page.getByTestId('chat-input-composer').locator('textarea');
  await composer.fill(message);
  await composer.press('Enter');
}

async function captureVisualQa(page: Page, name: string): Promise<void> {
  const directory = process.env.DCODE_VISUAL_QA_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

test('Plan mode is selected from the plus menu and closes from its microphone-adjacent badge', async () => {
  const fixture = await launchFixture(() => textResponse('unused'));
  try {
    const { page } = fixture;
    await page.getByRole('button', { name: '附加选项' }).click();
    await page.getByRole('menuitem', { name: '计划' }).click();

    const badge = page.getByTestId('plan-mode-indicator');
    await expect(badge).toHaveText(/计划/);
    const microphone = page.getByRole('button', { name: '语音输入' });
    const toolbarOrder = await microphone.evaluate((mic, badgeTestId) => {
      const badgeElement = document.querySelector(`[data-testid="${badgeTestId}"]`);
      if (!badgeElement) return null;
      return mic.compareDocumentPosition(badgeElement) & Node.DOCUMENT_POSITION_FOLLOWING;
    }, 'plan-mode-indicator');
    expect(toolbarOrder).toBeTruthy();
    await captureVisualQa(page, 'plan-mode-indicator');

    await badge.hover();
    await page.getByRole('button', { name: '关闭计划模式' }).click();
    await expect(badge).toHaveCount(0);

    await page.getByRole('button', { name: '附加选项' }).click();
    await page.getByRole('menuitem', { name: '计划' }).click();
    await expect(page.getByTestId('plan-mode-indicator')).toBeVisible();
    await page.getByRole('button', { name: '附加选项' }).click();
    await page.getByRole('menuitem', { name: '计划' }).click();
    await expect(page.getByTestId('plan-mode-indicator')).toHaveCount(0);
  } finally {
    await stopElectron(fixture.app);
    stopServer(fixture.server);
  }
});

test('completed ask_user_question rows expand to show questions, options, answers, and status', async () => {
  const question = 'Which implementation should be used?';
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('question-1', 'ask_user_question', {
          questions: [{
            question,
            header: 'Approach',
            options: [
              { label: 'Robust', description: 'Use the maintainable implementation.' },
              { label: 'Minimal', description: 'Make only the smallest change.' },
            ],
            multiSelect: false,
          }],
        })
      : textResponse('Question handled')
  ));
  try {
    const { page } = fixture;
    await sendMessage(page, 'Ask me before implementing');
    await expect(page.getByText('需要你的选择')).toBeVisible();
    await page.getByRole('button', { name: /Robust/ }).click();
    await page.getByRole('button', { name: '提交' }).click();
    await expect(page.getByText('Question handled')).toBeVisible();

    await page.getByTestId('processed-summary-toggle').click();
    const row = page.getByTestId('tool-item-row').filter({ hasText: '已提问' });
    await row.click();
    const detail = page.getByTestId('ask-user-question-detail');
    await expect(detail).toContainText(question);
    await expect(detail).toContainText('Robust');
    await expect(detail).toContainText('Minimal');
    await expect(detail).toContainText('用户选择');
    await expect(detail).toContainText('已完成');
    await captureVisualQa(page, 'ask-user-question-detail');
  } finally {
    await stopElectron(fixture.app);
    stopServer(fixture.server);
  }
});

test('approval options default to the first item, wrap with arrow keys, and execute with Enter', async () => {
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('approval-1', 'bash_exec', {
          command: 'printf keyboard-approval',
          description: '验证键盘审批',
        })
      : textResponse('Keyboard approval handled')
  ));
  try {
    const { page } = fixture;
    await sendMessage(page, 'Run the keyboard approval fixture');
    const panel = page.getByTestId('approval-panel');
    await expect(panel).toBeVisible();
    const options = panel.getByTestId('approval-option');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');

    await panel.press('ArrowUp');
    await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await panel.press('ArrowDown');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await panel.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await captureVisualQa(page, 'approval-keyboard-selection');
    await panel.press('Enter');
    await expect(page.getByText('Keyboard approval handled')).toBeVisible();
  } finally {
    await stopElectron(fixture.app);
    stopServer(fixture.server);
  }
});

test('Tab opens rejection feedback, Enter inserts a newline, and Mod+Enter submits', async () => {
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('approval-reject-1', 'bash_exec', {
          command: 'printf should-not-run',
          description: '验证拒绝理由输入',
        })
      : textResponse('Rejection handled')
  ));
  try {
    const { page, requests } = fixture;
    await sendMessage(page, 'Run the rejection fixture');
    const panel = page.getByTestId('approval-panel');
    await panel.press('ArrowDown');
    await panel.press('ArrowDown');
    await panel.press('Tab');

    const feedback = page.getByPlaceholder('可选：告诉 AI 应当改做什么…');
    await expect(feedback).toBeFocused();
    await feedback.fill('Keep the first line');
    await feedback.press('Enter');
    await feedback.type('Add the second line');
    await expect(feedback).toHaveValue('Keep the first line\nAdd the second line');
    expect(requests).toHaveLength(1);
    await captureVisualQa(page, 'approval-rejection-feedback');

    await feedback.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    await expect(page.getByText('Rejection handled')).toBeVisible();
    expect(JSON.stringify(requests[1])).toContain('Keep the first line\\nAdd the second line');
  } finally {
    await stopElectron(fixture.app);
    stopServer(fixture.server);
  }
});

test('streaming does not pull the viewport back down after the user scrolls up', async () => {
  const initialText = Array.from({ length: 100 }, (_, index) => `Initial stream line ${index}`).join('\n\n');
  const continuedText = Array.from({ length: 100 }, (_, index) => `Continued stream line ${index}`).join('\n\n');
  const fixture = await launchFixture((requestIndex, _body, response) => {
    if (requestIndex !== 1) return textResponse('unused');

    response.write(sse([
      { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${initialText}\n\n` } },
    ]));

    const continuationTimer = setTimeout(() => {
      response.end(sse([
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${continuedText}\n\nSTREAM_FINISHED_MARKER` } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 200 } },
        { type: 'message_stop' },
      ]));
    }, 5_000);
    response.once('close', () => clearTimeout(continuationTimer));
    return undefined;
  });

  try {
    const { page } = fixture;
    await sendMessage(page, 'Generate a long streaming response');
    const panel = page.locator('.chat-panel');

    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.clientHeight
    ))).toBeGreaterThan(500);
    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThan(5);

    await panel.evaluate(async (element) => {
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: -30 }));
      element.scrollBy(0, -30);
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
      });
    });
    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeGreaterThan(2);
    const distanceAfterUserInput = await panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ));
    expect(distanceAfterUserInput).toBeLessThan(120);
    const readViewportAnchor = () => panel.evaluate((element) => {
      const viewport = element.getBoundingClientRect();
      const sampleY = viewport.top + Math.min(160, viewport.height / 3);
      const paragraphs = [...element.querySelectorAll('p')];
      const paragraph = paragraphs.find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return bounds.top <= sampleY && bounds.bottom >= sampleY;
      });
      return paragraph?.textContent?.trim() ?? null;
    });
    const viewportAnchorAfterUserInput = await readViewportAnchor();
    expect(viewportAnchorAfterUserInput).toMatch(/^Initial stream line/);

    await expect(page.getByText('STREAM_FINISHED_MARKER')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '发送' })).toBeVisible();
    const finalDistanceToBottom = await panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ));
    const finalViewportAnchor = await readViewportAnchor();

    expect(finalViewportAnchor).toBe(viewportAnchorAfterUserInput);
    expect(finalDistanceToBottom).toBeGreaterThan(20);
  } finally {
    await stopElectron(fixture.app);
    stopServer(fixture.server);
  }
});
