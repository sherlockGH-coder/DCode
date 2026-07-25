'use strict';

const assert = require('node:assert/strict');

const PTY_MARKER = 'native-pty-ok';
const PTY_TIMEOUT_MS = 10_000;

function smokeDatabase() {
  const Database = require('better-sqlite3');
  const database = new Database(':memory:');
  try {
    const row = database.prepare('SELECT 1 AS value').get();
    assert.equal(row.value, 1);
  } finally {
    database.close();
  }
}

function smokePty() {
  const pty = require('node-pty');
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
  const args = isWindows
    ? ['/d', '/s', '/c', `echo ${PTY_MARKER}`]
    : ['-lc', `printf ${PTY_MARKER}`];

  return new Promise((resolve, reject) => {
    let output = '';
    let settled = false;
    let processHandle;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    const timeout = setTimeout(() => {
      try { processHandle?.kill(); } catch { /* ignore cleanup failures */ }
      finish(new Error(`node-pty smoke test timed out after ${PTY_TIMEOUT_MS}ms`));
    }, PTY_TIMEOUT_MS);

    try {
      processHandle = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
      });
      processHandle.onData((data) => {
        output += data;
      });
      processHandle.onExit(({ exitCode }) => {
        try {
          assert.equal(exitCode, 0);
          assert.match(output, new RegExp(PTY_MARKER));
          finish();
        } catch (error) {
          finish(error);
        }
      });
    } catch (error) {
      finish(error);
    }
  });
}

async function smokeDocumentDependencies() {
  const [{ PDFParse }, mammothModule, xlsxModule] = await Promise.all([
    import('pdf-parse'),
    import('mammoth'),
    import('xlsx'),
  ]);

  const mammoth = mammothModule.default ?? mammothModule;
  const XLSX = xlsxModule.default ?? xlsxModule;
  assert.equal(typeof PDFParse, 'function');
  assert.equal(typeof mammoth.extractRawText, 'function');

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['native-document-ok']]),
    'Smoke',
  );
  const serialized = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const restored = XLSX.read(serialized, { type: 'buffer' });
  assert.equal(restored.SheetNames[0], 'Smoke');
}

async function main() {
  assert.ok(process.versions.electron, 'smoke test must run with Electron Node');
  console.log(
    `[native-smoke] electron=${process.versions.electron} node=${process.versions.node} abi=${process.versions.modules} platform=${process.platform}-${process.arch}`,
  );

  smokeDatabase();
  await smokePty();
  await smokeDocumentDependencies();
  console.log('[native-smoke] database, PTY, and document dependencies passed');
}

function exitAfterFlush(code) {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write('', () => process.exit(code));
}

main()
  .then(() => exitAfterFlush(0))
  .catch((error) => {
    console.error('[native-smoke] failed:', error);
    exitAfterFlush(1);
  });
