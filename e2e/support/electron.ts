import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function createUserDataDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeUserDataDir(userDataDir: string): void {
  rmSync(userDataDir, { recursive: true, force: true });
}

function writeApiSettings(userDataDir: string, baseUrl: string): void {
  writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({
    schemaVersion: 1,
    apiProfiles: [{
      id: 'default',
      name: 'E2E',
      protocol: 'anthropic',
      baseUrl,
      models: ['e2e-model'],
      defaultModel: 'e2e-model',
      apiKeyPlain: 'e2e-key',
    }],
    activeApiProfileId: 'default',
  }));
}

export async function launchElectronApp(userDataDir: string): Promise<{
  app: ElectronApplication;
  page: Page;
}> {
  const app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userDataDir },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

export async function stopElectron(app: ElectronApplication): Promise<void> {
  if (app.process().exitCode !== null || app.process().signalCode !== null) return;
  const closed = new Promise<void>((resolveClosed) => app.once('close', resolveClosed));
  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    electronApp.quit();
  }).catch(() => undefined);
  await closed;
}

async function listenOnLoopback(server: Server): Promise<string> {
  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start');
  return `http://127.0.0.1:${address.port}`;
}

function stopServer(server: Server): void {
  server.closeAllConnections();
  server.close();
}

export type ApiResponder<T> = (
  requestIndex: number,
  body: T,
  response: ServerResponse,
) => string | undefined;

interface ApiFixture<T> {
  app: ElectronApplication;
  page: Page;
  requests: T[];
  server: Server;
  userData: string;
}

export async function launchApiFixture<T extends object>(
  userDataPrefix: string,
  responder: ApiResponder<T>,
): Promise<ApiFixture<T>> {
  const requests: T[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body) as T;
      requests.push(parsed);
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        connection: 'close',
      });
      const responseBody = responder(requests.length, parsed, response);
      if (responseBody !== undefined) response.end(responseBody);
    });
  });
  const baseUrl = await listenOnLoopback(server);
  const userData = createUserDataDir(userDataPrefix);
  writeApiSettings(userData, baseUrl);

  try {
    const { app, page } = await launchElectronApp(userData);
    return { app, page, requests, server, userData };
  } catch (error) {
    stopServer(server);
    removeUserDataDir(userData);
    throw error;
  }
}

export async function closeApiFixture(
  fixture: Pick<ApiFixture<object>, 'app' | 'server' | 'userData'>,
): Promise<void> {
  try {
    await stopElectron(fixture.app);
  } finally {
    stopServer(fixture.server);
    removeUserDataDir(fixture.userData);
  }
}

export async function captureVisualQa(page: Page, name: string, settleMs = 0): Promise<void> {
  const directory = process.env.DCODE_VISUAL_QA_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  await page.screenshot({ path: join(directory, `${name}.png`), fullPage: true });
}

export function sse(events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

export function textResponse(text: string): string {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

export function toolResponse(id: string, name: string, input: Record<string, unknown>): string {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name, input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ]);
}
