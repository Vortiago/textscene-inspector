/**
 * The installed-package suite installs the .vsix into its own empty directories and
 * launches VS Code on them, so the package under test is the only TextScene code the
 * window loads.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DISABLE_GPU_ENV, SUITE_STARTED_MARKER_ENV } from './test/integration/integrationLaunch';
import {
  INSTALLED_EXTENSIONS_DIR_ENV,
  installArgs,
  installedLaunchOptions,
  installedLaunchPaths,
  SUITE_HOST_MANIFEST,
  toolsOffLaunchPaths,
  userSettingsFile,
  vsixFileName,
} from './test/installed/installedLaunch';

const paths = installedLaunchPaths('/repo/apps/textscene-vscode/dist/test/installed', '/tmp/tsi-installed');

describe('installedLaunchPaths', () => {
  it('keeps every directory VS Code reads under the root the runner empties', () => {
    for (const dir of [paths.extensionsDir, paths.userDataDir, paths.workspaceRoot, paths.suiteHostPath]) {
      expect(relative('/tmp/tsi-installed', dir)).not.toMatch(/^\.\./);
    }
  });

  it('loads the suite from beside the runner', () => {
    expect(paths.extensionTestsPath).toBe(
      join('/repo/apps/textscene-vscode/dist/test/installed', 'suite', 'index')
    );
  });
});

describe('toolsOffLaunchPaths', () => {
  const runnerDir = '/repo/apps/textscene-vscode/dist/test/installed';
  const toolsOff = toolsOffLaunchPaths(paths, runnerDir);

  it('reuses the installed copy and the workspace of the first launch', () => {
    expect(toolsOff.extensionsDir).toBe(paths.extensionsDir);
    expect(toolsOff.workspaceRoot).toBe(paths.workspaceRoot);
  });

  it('gives the second launch its own settings, so the first launch keeps the tools on', () => {
    expect(toolsOff.userDataDir).not.toBe(paths.userDataDir);
    expect(relative('/tmp/tsi-installed', toolsOff.userDataDir)).not.toMatch(/^\.\./);
  });

  it('loads the toolsOff suite from beside the runner, with its own start marker', () => {
    expect(toolsOff.extensionTestsPath).toBe(join(runnerDir, 'toolsOff', 'index'));
    expect(toolsOff.suiteStartedMarker).not.toBe(paths.suiteStartedMarker);
  });
});

describe('userSettingsFile', () => {
  it('names the file VS Code reads the user settings from', () => {
    expect(userSettingsFile('/tmp/tsi-installed/user-data')).toBe(
      join('/tmp/tsi-installed/user-data', 'User', 'settings.json')
    );
  });
});

describe('vsixFileName', () => {
  it('names the package as vsce package writes it', () => {
    expect(vsixFileName({ name: 'textscene-inspector', version: '1.2.3' })).toBe(
      'textscene-inspector-1.2.3.vsix'
    );
  });

  it('names the package of the extension manifest', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    expect(vsixFileName(manifest)).toBe(`textscene-inspector-${manifest.version}.vsix`);
  });
});

describe('installArgs', () => {
  it('installs the package into the run directories, never the machine profile', () => {
    expect(installArgs(paths, '/repo/app/textscene-inspector-1.0.0.vsix')).toEqual([
      '--install-extension',
      '/repo/app/textscene-inspector-1.0.0.vsix',
      `--extensions-dir=${paths.extensionsDir}`,
      `--user-data-dir=${paths.userDataDir}`,
    ]);
  });
});

describe('installedLaunchOptions', () => {
  it('launches on the directories the package was installed into', () => {
    const { launchArgs } = installedLaunchOptions(paths, 'linux');

    expect(launchArgs[0]).toBe(paths.workspaceRoot);
    expect(launchArgs).toContain(`--extensions-dir=${paths.extensionsDir}`);
    expect(launchArgs).toContain(`--user-data-dir=${paths.userDataDir}`);
  });

  it('keeps installed extensions enabled, since the package under test is one', () => {
    expect(installedLaunchOptions(paths, 'linux').launchArgs).not.toContain('--disable-extensions');
  });

  it('develops only the suite host, never the repository app', () => {
    expect(installedLaunchOptions(paths).extensionDevelopmentPath).toBe(paths.suiteHostPath);
  });

  it('launches without the GPU on Linux, and elsewhere only on request', () => {
    expect(installedLaunchOptions(paths, 'linux', undefined).launchArgs).toContain('--disable-gpu');
    expect(installedLaunchOptions(paths, 'darwin', undefined).launchArgs).not.toContain('--disable-gpu');
    expect(installedLaunchOptions(paths, 'darwin', '1').launchArgs).toContain('--disable-gpu');
  });

  it('names the start marker, the extensions directory and the GPU launch to the suite', () => {
    expect(installedLaunchOptions(paths, 'linux', undefined).extensionTestsEnv).toEqual({
      [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker,
      [INSTALLED_EXTENSIONS_DIR_ENV]: paths.extensionsDir,
      [DISABLE_GPU_ENV]: '1',
    });
  });
});

describe('SUITE_HOST_MANIFEST', () => {
  it('contributes nothing, so the installed package is the only TextScene code in the window', () => {
    expect(Object.keys(SUITE_HOST_MANIFEST).sort()).toEqual(['engines', 'name', 'publisher', 'version']);
  });

  it('has an id apart from the extension under test', () => {
    expect(`${SUITE_HOST_MANIFEST.publisher}.${SUITE_HOST_MANIFEST.name}`).not.toBe(
      'vortiago.textscene-inspector'
    );
  });
});
