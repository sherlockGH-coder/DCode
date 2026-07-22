import { _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function sse(events) {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

const planDoc = {
  title: '重构技能页布局',
  summary: '将技能页改为双栏布局，左侧列表右侧详情，并统一卡片样式。',
  implementationSteps: ['抽取 SkillCard 共享样式并接入主题变量', '重写 SkillsPage 为双栏布局', '补充键盘导航与焦点管理'],
  testPlan: ['pnpm typecheck 与 vitest 全量通过', '亮暗两套主题下截图核对'],
  assumptions: ['不改动技能加载的主进程逻辑'],
};

function planResponse() {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'plan-1', name: 'submit_plan', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(planDoc) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ]);
}

function textResponse(text) {
  return sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
}

const userData = mkdtempSync(join(tmpdir(), 'deepseek-plan-shot-'));
let count = 0;
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    count++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end(count === 1 ? planResponse() : textResponse('已按计划开始实施，先处理 SkillCard 样式抽取。'));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
mkdirSync(userData, { recursive: true });
writeFileSync(join(userData, 'settings.json'), JSON.stringify({
  schemaVersion: 1,
  apiProfiles: [{ id: 'default', name: 'Shot', protocol: 'anthropic', baseUrl: `http://127.0.0.1:${port}`, models: ['shot-model'], defaultModel: 'shot-model', apiKeyPlain: 'shot-key' }],
  activeApiProfileId: 'default',
}));

const app = await electron.launch({
  args: [resolve('out/main/index.js')],
  env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userData },
});
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
await page.setViewportSize({ width: 1280, height: 900 });

const composer = page.getByTestId('chat-input-composer').locator('textarea');
await composer.fill('/plan 重构技能页布局');
await composer.press('Enter');
await page.getByTestId('plan-approval-panel').waitFor({ state: 'visible', timeout: 15000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'test-results/plan-panel-light.png' });

await page.evaluate(() => document.documentElement.classList.add('dark'));
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/plan-panel-dark.png' });
await page.evaluate(() => document.documentElement.classList.remove('dark'));

// 键盘导航检查：↓↓ 应选中第三项
await page.getByTestId('plan-approval-panel').focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
await page.screenshot({ path: 'test-results/plan-panel-keyboard.png' });

// 批准（保留上下文），验证留档卡片
await page.getByTestId('plan-approve-same').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test-results/plan-archive-collapsed.png' });

const card = page.getByTestId('plan-artifact-card');
if (await card.count()) {
  await card.first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/plan-archive-expanded.png' });
} else {
  console.log('WARN: plan-artifact-card not found');
}

await app.close();
server.closeAllConnections();
server.close();
console.log('screenshots done');
