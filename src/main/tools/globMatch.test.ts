import { describe, expect, it } from 'vitest';
import { createGlobMatcher, globToRegex } from './globMatch';

describe('globToRegex', () => {
  it('translates * without crossing directory separators', () => {
    const re = globToRegex('src/*.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/nested/a.ts')).toBe(false);
  });

  it('translates ** across directory separators and allows zero segments', () => {
    const re = globToRegex('src/**/*.ts');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/deeply/nested/a.ts')).toBe(true);
    expect(re.test('other/a.ts')).toBe(false);
  });

  it('translates ? as a single non-separator character', () => {
    const re = globToRegex('a?.ts');
    expect(re.test('ab.ts')).toBe(true);
    expect(re.test('a.ts')).toBe(false);
    expect(re.test('a/b.ts')).toBe(false);
  });

  it('expands braces containing plain alternatives', () => {
    const re = globToRegex('**/*.{ts,tsx}');
    expect(re.test('src/a.ts')).toBe(true);
    expect(re.test('src/a.tsx')).toBe(true);
    expect(re.test('src/a.js')).toBe(false);
  });

  // 回归：花括号分支里的 `*` 曾被当作字面量转义，生成 `(?:*\.ts|*\.js)`，
  // 直接抛 "Nothing to repeat"。
  it('expands braces whose alternatives contain wildcards', () => {
    expect(() => globToRegex('{*.ts,*.js}')).not.toThrow();
    const re = globToRegex('{*.ts,*.js}');
    expect(re.test('a.ts')).toBe(true);
    expect(re.test('a.js')).toBe(true);
    expect(re.test('a.md')).toBe(false);
  });

  it('expands braces with directory wildcards in the alternatives', () => {
    const re = globToRegex('{src/**/*.ts,test/**/*.ts}');
    expect(re.test('src/deep/a.ts')).toBe(true);
    expect(re.test('test/b.ts')).toBe(true);
    expect(re.test('lib/c.ts')).toBe(false);
  });

  it('supports nested braces and does not split on nested commas', () => {
    const re = globToRegex('*.{ts,{js,mjs}}');
    expect(re.test('a.ts')).toBe(true);
    expect(re.test('a.js')).toBe(true);
    expect(re.test('a.mjs')).toBe(true);
    expect(re.test('a.css')).toBe(false);
  });

  it('treats an unmatched brace as a literal', () => {
    expect(() => globToRegex('a{b.ts')).not.toThrow();
    expect(globToRegex('a{b.ts').test('a{b.ts')).toBe(true);
  });

  it('escapes regex metacharacters in literal segments', () => {
    const re = globToRegex('a+b(c).ts');
    expect(re.test('a+b(c).ts')).toBe(true);
    expect(re.test('aab c .ts')).toBe(false);
  });

  it('matches case-sensitively', () => {
    expect(globToRegex('*.ts').test('A.TS')).toBe(false);
    expect(globToRegex('*.ts').test('A.ts')).toBe(true);
  });
});

describe('createGlobMatcher', () => {
  it('matches a bare pattern against the basename as well as the full path', () => {
    const match = createGlobMatcher('*.ts');
    expect(match('a.ts')).toBe(true);
    expect(match('src/nested/a.ts')).toBe(true);
    expect(match('src/nested/a.js')).toBe(false);
  });

  it('does not fall back to basename when the pattern contains a separator', () => {
    const match = createGlobMatcher('src/*.ts');
    expect(match('src/a.ts')).toBe(true);
    expect(match('other/a.ts')).toBe(false);
  });

  it('compiles once and stays stable across repeated calls', () => {
    const match = createGlobMatcher('*.{ts,js}');
    for (let i = 0; i < 5; i++) {
      expect(match('a.ts')).toBe(true);
      expect(match('a.js')).toBe(true);
      expect(match('a.md')).toBe(false);
    }
  });
});
