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
});

if (result.error) {
  throw result.error;
}

if (result.signal) {
  throw new Error(`Electron native smoke test terminated by ${result.signal}`);
}

process.exitCode = result.status ?? 1;
