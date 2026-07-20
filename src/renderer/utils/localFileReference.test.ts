import { describe, expect, it } from 'vitest';
import { parseLocalFileReference, stripLocalFileReferenceSuffix } from './localFileReference';

describe('localFileReference', () => {
  it('parses colon line suffixes', () => {
    expect(parseLocalFileReference('/Users/conan/project/src/App.tsx:42')).toEqual({
      path: '/Users/conan/project/src/App.tsx',
      line: 42,
    });
  });

  it('parses hash line suffixes', () => {
    expect(parseLocalFileReference('local-file:///Users/conan/project/src/App.tsx#L17')).toEqual({
      path: '/Users/conan/project/src/App.tsx',
      line: 17,
    });
  });

  it('strips line suffixes before extension checks', () => {
    expect(stripLocalFileReferenceSuffix('/Users/conan/project/src/App.tsx:42')).toBe('/Users/conan/project/src/App.tsx');
    expect(stripLocalFileReferenceSuffix('/Users/conan/project/src/App.tsx#L42')).toBe('/Users/conan/project/src/App.tsx');
  });
});
