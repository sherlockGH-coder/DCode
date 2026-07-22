const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'MCP & Skills — Four Directions.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'prototype.js'), 'utf8');
const { window } = parseHTML(html);

const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

Object.assign(globalThis, {
  window,
  document: window.document,
  localStorage,
  TWEAK_DEFAULTS: { direction: 'native', theme: 'light', density: 'comfortable' },
});
window.parent = window;
window.parent.postMessage = () => {};

Function(script)();

const click = (selector) => {
  const element = document.querySelector(selector);
  assert.ok(element, `Missing element: ${selector}`);
  element.dispatchEvent(new window.Event('click', { bubbles: true }));
};

assert.equal(document.querySelectorAll('.record').length, 5);
assert.equal(document.documentElement.dataset.direction, 'native');

click('[data-direction="console"]');
assert.equal(document.documentElement.dataset.direction, 'console');
for (const direction of ['index', 'workbench', 'native', 'console']) {
  click(`[data-direction="${direction}"]`);
  assert.equal(document.documentElement.dataset.direction, direction);
  assert.equal(document.querySelectorAll('.record').length, 5);
}

click('#themeToggle');
assert.equal(document.documentElement.dataset.theme, 'dark');
click('#themeToggle');
assert.equal(document.documentElement.dataset.theme, 'light');

click('[data-section="mcp"]');
assert.match(document.querySelector('.page-header h1').textContent, /MCP/);
assert.equal(document.querySelectorAll('.record').length, 5);

const search = document.querySelector('#contentSearch');
search.value = 'does-not-exist';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(document.querySelector('.empty-state'));

click('[data-action="clear-filters"]');
assert.equal(document.querySelectorAll('.record').length, 5);

click('[data-action="add"]');
assert.ok(document.querySelector('.modal-backdrop'));
assert.match(document.querySelector('.modal-header h2').textContent, /MCP/);

console.log('Prototype DOM smoke test passed.');
