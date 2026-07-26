#!/usr/bin/env node
/**
 * 冷启动耗时测量：从 spawn Electron 到渲染进程首帧可见。
 *
 * 用法：
 *   node scripts/measure-startup.cjs [轮数]
 *
 * 每轮使用全新的 userData 目录（模拟首次启动，无 shell env 缓存），
 * 以及一个复用的 userData 目录（模拟日常启动，有缓存）。
 */
const { _electron: electron } = require('@playwright/test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const ROUNDS = Number(process.argv[2] || 3);
const MAIN = resolve(__dirname, '../out/main/index.js');

async function launchOnce(userDataDir) {
  const started = Date.now();
  const app = await electron.launch({
    args: [MAIN],
    env: { ...process.env, DEEPSEEK_E2E_USER_DATA_DIR: userDataDir },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('body *', { timeout: 30_000 });
  const elapsed = Date.now() - started;

  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
    electronApp.quit();
  }).catch(() => undefined);
  await new Promise((r) => app.once('close', r));

  return elapsed;
}

function stats(label, samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  console.log(`${label.padEnd(28)} median ${median}ms  mean ${mean}ms  [${samples.join(', ')}]`);
}

(async () => {
  // 冷缓存：每轮一个新的 userData
  const cold = [];
  for (let i = 0; i < ROUNDS; i++) {
    const dir = mkdtempSync(join(tmpdir(), 'deepseek-startup-cold-'));
    try {
      cold.push(await launchOnce(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // 热 userData + 有 shell env 缓存（日常启动）
  const warmDir = mkdtempSync(join(tmpdir(), 'deepseek-startup-warm-'));
  const warm = [];
  // 热 userData + 每轮删掉 shell env 缓存（等价于优化前的行为）
  const warmNoCache = [];
  try {
    await launchOnce(warmDir); // 预热：建库 + 写入 shell env 缓存

    for (let i = 0; i < ROUNDS; i++) {
      warm.push(await launchOnce(warmDir));
    }

    for (let i = 0; i < ROUNDS; i++) {
      rmSync(join(warmDir, 'shell-env-cache.json'), { force: true });
      warmNoCache.push(await launchOnce(warmDir));
    }
  } finally {
    rmSync(warmDir, { recursive: true, force: true });
  }

  console.log('');
  stats('fresh userData', cold);
  stats('warm, shell-env cached', warm);
  stats('warm, cache deleted', warmNoCache);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
