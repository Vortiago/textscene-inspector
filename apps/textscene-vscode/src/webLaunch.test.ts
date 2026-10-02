/**
 * The web suite runs the repository app in VS Code for the Web, on the project the
 * runner writes beside it.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { webLaunchOptions, webLaunchPaths } from './test/web/webLaunch';

const paths = webLaunchPaths('/repo/apps/textscene-vscode/dist/test/web');

describe('webLaunchPaths', () => {
  it('develops the app three levels above the runner', () => {
    expect(paths.appRoot).toBe(join('/repo/apps/textscene-vscode'));
  });

  it('loads the suite bundle from beside the runner', () => {
    expect(paths.extensionTestsPath).toBe(join('/repo/apps/textscene-vscode/dist/test/web/suite/index.js'));
  });

  it('writes the workspace inside the app, to a folder the package leaves out', () => {
    const vscodeignore = readFileSync(join(import.meta.dirname, '..', '.vscodeignore'), 'utf8');

    expect(relative(paths.appRoot, paths.workspaceRoot)).toBe('.test-workspace-web');
    expect(vscodeignore.split('\n')).toContain('.test-workspace-web/');
  });

  it('finds the extension manifest from where the runner compiles to', () => {
    const runnerDir = join(import.meta.dirname, '..', 'dist', 'test', 'web');
    expect(existsSync(join(webLaunchPaths(runnerDir).appRoot, 'package.json'))).toBe(true);
  });
});

describe('webLaunchOptions', () => {
  const options = webLaunchOptions(paths);

  it('develops the repository app and opens the written workspace', () => {
    expect(options.extensionDevelopmentPath).toBe(paths.appRoot);
    expect(options.folderPath).toBe(paths.workspaceRoot);
    expect(options.extensionTestsPath).toBe(paths.extensionTestsPath);
  });

  it('runs the stable build in headless Chromium', () => {
    expect(options).toMatchObject({ browserType: 'chromium', headless: true, quality: 'stable' });
  });
});
