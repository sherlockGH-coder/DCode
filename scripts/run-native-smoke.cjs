'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const electronPath = require('electron');
const smokeScript = path.join(__dirname, 'native-smoke.cjs');
const result = spawnSync(electronPath, [smokeScript], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
  stdio: 'inherit',
  timeout: 30_000,
});

if (result.error) {
  if (result.error.code === 'ETIMEDOUT') {
    throw new Error('Electron native smoke test timed out after 30s');
  }
  throw result.error;
}

if (result.signal) {
  throw new Error(`Electron native smoke test terminated by ${result.signal}`);
}

if (result.status === null) {
  throw new Error('Electron native smoke test exited without a status');
}

process.exitCode = result.status ?? 1;
