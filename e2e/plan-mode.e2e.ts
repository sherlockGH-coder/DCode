import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function sse(events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

function planResponse(title: string, summary = 'Implement safely', documentOverrides: Record<string, unknown> = {}): string {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: `plan-${title}`, name: 'submit_plan', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ title, summary, implementationSteps: ['Change the implementation'], testPlan: ['Run the E2E suite'], assumptions: [], ...documentOverrides }) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ]);
}

test('Plan document renders GFM with a fixed approval footer and matches the composer width', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'dcode-plan-layout-e2e-'));
  const server = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(planResponse(
        'Markdown Plan',
        'A document-first plan with enough content to require its own scroll area.',
        {
          implementationSteps: [
            'Use `react-markdown` with **GFM** support',
            'Render a table:\n\n| Area | Expected |\n| --- | --- |\n| Body | Scrolls |\n| Footer | Fixed |',
            ...Array.from({ length: 36 }, (_, index) => `Long implementation step ${index + 1} with supporting detail that verifies the document keeps scrolling independently from the approval footer`),
          ],
          testPlan: ['[ ] Verify task lists', '[x] Verify headings', 'Check dark mode'],
          assumptions: ['The existing theme tokens remain authoritative'],
        },
      ));
    });
  });
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{ id: 'default', name: 'E2E', protocol: 'anthropic', baseUrl: `http://127.0.0.1:${address.port}`, models: ['e2e-model'], defaultModel: 'e2e-model', apiKeyPlain: 'e2e-key' }],
    activeApiProfileId: 'default',
  }));
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DCODE_E2E_USER_DATA_DIR: userData },
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1280, height: 820 });
    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('/plan render a long markdown plan');
    await composer.press('Enter');

    const panel = page.getByTestId('plan-approval-panel');
    const documentScroll = page.getByTestId('plan-document-scroll');
    const approval = page.getByTestId('plan-approve-same');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('plan-outline')).toHaveCount(0);
    await expect(panel.getByText('Markdown Plan')).toHaveCount(0);
    await expect(panel.getByText('A document-first plan with enough content to require its own scroll area.')).toHaveCount(0);
    await expect(panel.getByText('v1')).toHaveCount(0);
    await expect(panel.getByRole('table')).toBeVisible();
    await expect(panel.locator('input[type="checkbox"]')).toHaveCount(2);
    await expect(documentScroll).toHaveJSProperty('scrollTop', 0);

    const geometry = await page.evaluate(() => {
      const scroll = document.querySelector('[data-testid="plan-document-scroll"]') as HTMLElement;
      const approvalButton = document.querySelector('[data-testid="plan-approve-same"]') as HTMLElement;
      const panelElement = document.querySelector('[data-testid="plan-approval-panel"]') as HTMLElement;
      const composerElement = document.querySelector('[data-testid="chat-input-composer"]') as HTMLElement;
      return {
        documentScrollable: scroll.scrollHeight > scroll.clientHeight,
        approvalInsidePanel: approvalButton.getBoundingClientRect().bottom <= panelElement.getBoundingClientRect().bottom,
        panelWidth: panelElement.getBoundingClientRect().width,
        composerWidth: composerElement.getBoundingClientRect().width,
      };
    });
    expect(geometry.documentScrollable).toBe(true);
    expect(geometry.approvalInsidePanel).toBe(true);
    expect(Math.abs(geometry.panelWidth - geometry.composerWidth)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 640, height: 780 });
    await expect(approval).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  } finally {
    await stopElectron(app);
    stopServer(server);
  }
});

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

test('Plan is shown before approval, tools are restricted, and fresh execution starts immediately', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'dcode-plan-e2e-'));
  const requests: any[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body);
      requests.push(parsed);
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (requests.length === 1) {
        response.end(planResponse('Safe Plan'));
      } else {
        response.end(textResponse('Implementation started'));
      }
    });
  });
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
  mkdirSync(userData, { recursive: true });
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{ id: 'default', name: 'E2E', protocol: 'anthropic', baseUrl: `http://127.0.0.1:${address.port}`, models: ['e2e-model'], defaultModel: 'e2e-model', apiKeyPlain: 'e2e-key' }],
    activeApiProfileId: 'default',
  }));
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DCODE_E2E_USER_DATA_DIR: userData },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('/plan build the feature');
    await composer.press('Enter');
    const indicator = page.getByTestId('plan-mode-indicator');
    await expect(indicator).toHaveText(/计划/);
    await expect(page.getByTestId('plan-approval-panel')).toBeVisible();
    expect(requests[0].tools.map((tool: any) => tool.name)).toContain('submit_plan');
    expect(requests[0].tools.map((tool: any) => tool.name)).not.toContain('edit_file');
    expect(requests[0].tools.map((tool: any) => tool.name)).not.toContain('bash_exec');
    expect(requests[0].tools.map((tool: any) => tool.name)).not.toContain('update_plan');

    await expect(page.getByTestId('plan-approve-fresh')).toBeEnabled();
    await page.getByTestId('plan-approve-fresh').click();
    await expect(indicator).toHaveCount(0);
    await expect(page.getByText('Implementation started')).toBeVisible();
    expect(requests[1].tools.map((tool: any) => tool.name)).toContain('edit_file');
    expect(requests[1].tools.map((tool: any) => tool.name)).not.toContain('submit_plan');
    expect(JSON.stringify(requests[1].messages)).not.toContain('build the feature');
    expect(JSON.stringify(requests[1].messages)).toContain('Safe Plan');
  } finally {
    await stopElectron(app);
    stopServer(server);
  }
});

test('Rejection replans with a new version and same-context approval executes once', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'dcode-plan-replan-e2e-'));
  const requests: any[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push(JSON.parse(body));
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (requests.length === 1) response.end(planResponse('Initial Plan'));
      else if (requests.length === 2) response.end(planResponse('Revised Plan', 'Includes the rejection feedback'));
      else response.end(textResponse('Same-context implementation started'));
    });
  });
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{ id: 'default', name: 'E2E', protocol: 'anthropic', baseUrl: `http://127.0.0.1:${address.port}`, models: ['e2e-model'], defaultModel: 'e2e-model', apiKeyPlain: 'e2e-key' }],
    activeApiProfileId: 'default',
  }));
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DCODE_E2E_USER_DATA_DIR: userData },
  });
  try {
    const page = await app.firstWindow();
    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('/plan preserve the original context');
    await composer.press('Enter');
    await expect(page.getByTestId('plan-approval-panel')).toBeVisible();
    await expect(page.getByText('实施计划 · 等待批准')).toBeVisible();
    await expect(page.getByTestId('plan-reject-toggle')).toBeEnabled();
    await page.getByTestId('plan-reject-toggle').click();
    await page.getByPlaceholder('可选：告诉 AI 计划需要如何调整…').fill('Add a rollback step');
    await page.getByTestId('plan-reject').click();
    await expect(page.getByTestId('plan-approval-panel')).toBeVisible();
    await expect(page.getByText('实施计划 · 等待批准')).toBeVisible();
    await expect(page.getByTestId('plan-approval-panel').getByText('v2')).toHaveCount(0);
    expect(JSON.stringify(requests[1].messages)).toContain('Add a rollback step');
    expect(requests[1].tools.map((tool: any) => tool.name)).toContain('submit_plan');
    expect(requests[1].tools.map((tool: any) => tool.name)).not.toContain('edit_file');

    await expect(page.getByTestId('plan-approve-same')).toBeEnabled();
    await page.getByTestId('plan-approve-same').click();
    await expect(page.getByTestId('plan-mode-indicator')).toHaveCount(0);
    await expect(page.getByText('Same-context implementation started')).toBeVisible();
    expect(JSON.stringify(requests[2].messages)).toContain('preserve the original context');
    expect(JSON.stringify(requests[2].messages)).toContain('Revised Plan');
  } finally {
    await stopElectron(app);
    stopServer(server);
  }
});

test('Pending plans recover after restart and stale plans cannot be approved', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'dcode-plan-recovery-e2e-'));
  const server = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(planResponse('Recoverable Plan'));
    });
  });
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{ id: 'default', name: 'E2E', protocol: 'anthropic', baseUrl: `http://127.0.0.1:${address.port}`, models: ['e2e-model'], defaultModel: 'e2e-model', apiKeyPlain: 'e2e-key' }],
    activeApiProfileId: 'default',
  }));
  const launch = () => electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DCODE_E2E_USER_DATA_DIR: userData },
  });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('/plan survive restart');
    await composer.press('Enter');
    await expect(page.getByTestId('plan-approval-panel')).toBeVisible();
    const beforeRestart = await page.evaluate(async () => {
      const conversations = await window.dcodeApi.getConversations();
      const conversationId = conversations[0].id;
      return window.dcodeApi.getConversationModeState(conversationId);
    });
    await stopElectron(app);

    app = await launch();
    page = await app.firstWindow();
    const recovered = await page.evaluate(async (conversationId) => (
      window.dcodeApi.getConversationModeState(conversationId)
    ), beforeRestart.conversationId);
    expect(recovered.mode).toBe('plan');
    expect(recovered.activePlan?.id).toBe(beforeRestart.activePlan?.id);

    const staleDecision = await page.evaluate(async (state) => {
      const plan = state.activePlan!;
      const grant = await window.dcodeApi.markPlanPresented({
        conversationId: state.conversationId,
        planId: plan.id,
        version: plan.version,
        contentHash: plan.contentHash,
        modeRevision: state.modeRevision,
      });
      let missingTokenRejected = false;
      try {
        await window.dcodeApi.decidePlan({
          conversationId: state.conversationId,
          planId: plan.id,
          version: plan.version,
          contentHash: plan.contentHash,
          presentationToken: 'not-a-presentation-token',
          decision: 'approve',
          strategy: 'same_context',
        });
      } catch {
        missingTokenRejected = true;
      }
      await window.dcodeApi.addMessage(state.conversationId, 'user', 'invalidate the old plan');
      const invalidated = await window.dcodeApi.getConversationModeState(state.conversationId);
      try {
        await window.dcodeApi.decidePlan({
          conversationId: state.conversationId,
          planId: plan.id,
          version: plan.version,
          contentHash: plan.contentHash,
          presentationToken: grant.token,
          decision: 'approve',
          strategy: 'same_context',
        });
        return { invalidated, rejected: false, missingTokenRejected };
      } catch {
        return { invalidated, rejected: true, missingTokenRejected };
      }
    }, recovered);
    expect(staleDecision.invalidated.activePlan).toBeNull();
    expect(staleDecision.rejected).toBe(true);
    expect(staleDecision.missingTokenRejected).toBe(true);

    await page.evaluate(async ({ conversationId, contextEpoch }) => {
      const turnId = crypto.randomUUID();
      const content = 'create a branch-sensitive plan';
      await window.dcodeApi.addMessage(
        conversationId, 'user', content, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, turnId, 0, 0, turnId,
        undefined, contextEpoch, 'chat',
      );
      await window.dcodeApi.sendMessage(
        [{ role: 'user', content }], 'e2e-model', conversationId,
        undefined, undefined, turnId, 1,
      );
    }, { conversationId: recovered.conversationId, contextEpoch: recovered.contextEpoch });
    await expect.poll(async () => page.evaluate(async (conversationId) => {
      const state = await window.dcodeApi.getConversationModeState(conversationId);
      return state.activePlan;
    }, recovered.conversationId)).not.toBeNull();
    const branchState = await page.evaluate(async (conversationId) => (
      window.dcodeApi.getConversationModeState(conversationId)
    ), recovered.conversationId);
    await page.evaluate(async ({ conversationId, sourceTurnId, nextAttempt }) => {
      await window.dcodeApi.setActiveAttempts(conversationId, { [sourceTurnId]: nextAttempt });
    }, {
      conversationId: recovered.conversationId,
      sourceTurnId: branchState.activePlan!.sourceTurnId,
      nextAttempt: branchState.activePlan!.sourceAttemptNo + 1,
    });
    const afterBranchSwitch = await page.evaluate(async (conversationId) => (
      window.dcodeApi.getConversationModeState(conversationId)
    ), recovered.conversationId);
    expect(afterBranchSwitch.activePlan).toBeNull();

    await page.evaluate(async ({ conversationId, contextEpoch }) => {
      const turnId = crypto.randomUUID();
      const content = 'create a truncation-sensitive plan';
      await window.dcodeApi.addMessage(
        conversationId, 'user', content, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, turnId, 0, 0, turnId,
        undefined, contextEpoch, 'chat',
      );
      await window.dcodeApi.sendMessage(
        [{ role: 'user', content }], 'e2e-model', conversationId,
        undefined, undefined, turnId, 1,
      );
    }, { conversationId: recovered.conversationId, contextEpoch: recovered.contextEpoch });
    await expect.poll(async () => page.evaluate(async (conversationId) => {
      const state = await window.dcodeApi.getConversationModeState(conversationId);
      return state.activePlan?.version ?? 0;
    }, recovered.conversationId)).toBeGreaterThan(branchState.activePlan!.version);
    const truncationState = await page.evaluate(async (conversationId) => (
      window.dcodeApi.getConversationModeState(conversationId)
    ), recovered.conversationId);
    await page.evaluate(async ({ conversationId, sourceTurnId }) => {
      await window.dcodeApi.deleteMessagesFromTurn(conversationId, sourceTurnId);
    }, {
      conversationId: recovered.conversationId,
      sourceTurnId: truncationState.activePlan!.sourceTurnId,
    });
    const afterTruncation = await page.evaluate(async (conversationId) => (
      window.dcodeApi.getConversationModeState(conversationId)
    ), recovered.conversationId);
    expect(afterTruncation.activePlan).toBeNull();
  } finally {
    await stopElectron(app);
    stopServer(server);
  }
});
