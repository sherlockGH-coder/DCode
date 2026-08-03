import { describe, expect, it } from 'vitest';
import { createIgnoreFilter } from './ignoreFilter';

describe('createIgnoreFilter', () => {
  it('always skips built-in directories regardless of gitignore support', () => {
    for (const enabled of [true, false]) {
      const filter = createIgnoreFilter(enabled);
      expect(filter.isDefaultIgnoredDir('node_modules')).toBe(true);
      expect(filter.isDefaultIgnoredDir('.git')).toBe(true);
      expect(filter.isDefaultIgnoredDir('src')).toBe(false);
    }
  });

  it('ignores nothing from gitignore when disabled', () => {
    const filter = createIgnoreFilter(false);
    filter.addRules('', 'release/\n*.log\n');
    expect(filter.ignores('release', true)).toBe(false);
    expect(filter.ignores('app.log', false)).toBe(false);
  });

  it('matches a bare pattern at any depth', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', '*.log\n');
    expect(filter.ignores('app.log', false)).toBe(true);
    expect(filter.ignores('deep/nested/app.log', false)).toBe(true);
    expect(filter.ignores('app.txt', false)).toBe(false);
  });

  it('honours directory-only rules and ignores their whole subtree', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', 'release/\n');
    expect(filter.ignores('release', true)).toBe(true);
    expect(filter.ignores('release/app.dmg', false)).toBe(true);
    // A file with the same name must not match a directory-only rule.
    expect(filter.ignores('release', false)).toBe(false);
  });

  it('anchors patterns that start with a slash', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', '/out\n');
    expect(filter.ignores('out', true)).toBe(true);
    expect(filter.ignores('packages/out', true)).toBe(false);
  });

  it('anchors patterns containing an inner slash', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', 'benchmark/jobs\n');
    expect(filter.ignores('benchmark/jobs', true)).toBe(true);
    expect(filter.ignores('benchmark/jobs/run-1', false)).toBe(true);
    expect(filter.ignores('other/benchmark/jobs', true)).toBe(false);
  });

  it('applies negation with last-match-wins ordering', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', '*.md\n!README.md\n');
    expect(filter.ignores('CHANGELOG.md', false)).toBe(true);
    expect(filter.ignores('README.md', false)).toBe(false);
  });

  it('skips comments and blank lines', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', '# a comment\n\n   \n*.tmp\n');
    expect(filter.ignores('a.tmp', false)).toBe(true);
    expect(filter.ignores('# a comment', false)).toBe(false);
  });

  it('scopes nested gitignore rules to their own subtree', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('packages/app', 'build/\n');
    expect(filter.ignores('packages/app/build', true)).toBe(true);
    expect(filter.ignores('packages/other/build', true)).toBe(false);
    expect(filter.ignores('build', true)).toBe(false);
  });

  it('supports * and ** wildcards', () => {
    const filter = createIgnoreFilter(true);
    filter.addRules('', 'coverage/**/*.json\n');
    expect(filter.ignores('coverage/a/b.json', false)).toBe(true);
    expect(filter.ignores('coverage/b.json', false)).toBe(true);
    expect(filter.ignores('coverage/b.txt', false)).toBe(false);
  });

  it('does not throw on malformed patterns', () => {
    const filter = createIgnoreFilter(true);
    expect(() => filter.addRules('', '[[[\n***\n\\\n')).not.toThrow();
  });
});
