#!/usr/bin/env node
/**
 * Measure cold-start time from spawning Electron to the first visible renderer frame.
 *
 * Usage:
 *   node scripts/measure-startup.cjs [rounds]
 *
 * Each round uses a new userData directory to simulate first launch without a shell-env cache,
 * plus a reused userData directory to simulate daily launch with a cache.
 */
const { _electron: electron } = require('playwright-core');
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
  // Cold cache: a new userData directory each round.
  const cold = [];
  for (let i = 0; i < ROUNDS; i++) {
    const dir = mkdtempSync(join(tmpdir(), 'deepseek-startup-cold-'));
    try {
      cold.push(await launchOnce(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Warm userData with a shell-env cache (daily startup).
  const warmDir = mkdtempSync(join(tmpdir(), 'deepseek-startup-warm-'));
  const warm = [];
  // Warm userData while deleting the shell-env cache each round, equivalent to the pre-optimization behavior.
  const warmNoCache = [];
  try {
    await launchOnce(warmDir); // Warm up: create the database and write the shell-env cache.

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
