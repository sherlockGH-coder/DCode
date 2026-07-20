import { buildWorkspaceBreadcrumbSegments, fileNameFromPath } from './workspaceBreadcrumb';

describe('workspaceBreadcrumb', () => {
  it('builds real project-relative segments from an absolute file path', () => {
    const segments = buildWorkspaceBreadcrumbSegments({
      title: 'ArtifactPanel.tsx',
      filePath: '/Users/conan/Code/DCode/src/renderer/components/ArtifactPanel.tsx',
      projectPath: '/Users/conan/Code/DCode',
    });

    expect(segments.map((segment) => segment.label)).toEqual([
      'DCode',
      'src',
      'renderer',
      'components',
      'ArtifactPanel.tsx',
    ]);
  });

  it('builds real project-relative segments from a relative file path', () => {
    const segments = buildWorkspaceBreadcrumbSegments({
      title: 'README.md',
      filePath: 'outputs/cutout_too/README.md',
      projectPath: '/Users/conan/Code/new-chat',
    });

    expect(segments.map((segment) => segment.label)).toEqual([
      'new-chat',
      'outputs',
      'cutout_too',
      'README.md',
    ]);
  });

  it('does not fake a project breadcrumb for previews without a file path', () => {
    const segments = buildWorkspaceBreadcrumbSegments({
      title: 'typescript',
      projectPath: '/Users/conan/Code/DCode',
    });

    expect(segments.map((segment) => segment.label)).toEqual(['typescript']);
  });

  it('does not attach an external file path to the active project', () => {
    const segments = buildWorkspaceBreadcrumbSegments({
      title: 'report.md',
      filePath: '/tmp/reports/report.md',
      projectPath: '/Users/conan/Code/DCode',
    });

    expect(segments.map((segment) => segment.label)).toEqual(['tmp', 'reports', 'report.md']);
  });

  it('normalizes backslash paths before extracting file names', () => {
    expect(fileNameFromPath('C:\\Users\\conan\\report.md')).toBe('report.md');
  });
});
