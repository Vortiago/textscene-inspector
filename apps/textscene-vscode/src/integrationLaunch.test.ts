/**
 * The integration suite populates `.test-workspace` before launch. VS Code resolves
 * its launch folder once, as the window opens, so a workspace created later never
 * becomes a workspace folder and every `res://` read fails with "No workspace folder
 * found".
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  integrationLaunchOptions,
  integrationLaunchPaths,
  launchIntegrationTests,
  SUITE_STARTED_MARKER_ENV,
  vscodeTestVersion,
  type IntegrationLaunchOptions,
  type IntegrationLaunchPaths,
} from './test/integration/integrationLaunch';

function fakePaths(
  workspaceRoot: string,
  suiteStartedMarker = '/nonexistent/suite-started'
): IntegrationLaunchPaths {
  return {
    extensionDevelopmentPath: '/repo/apps/textscene-vscode',
    extensionTestsPath: '/repo/apps/textscene-vscode/dist/test/integration/suite/index',
    workspaceRoot,
    userDataDir: '/tmp/vscode-test-data',
    suiteStartedMarker,
  };
}

describe('integrationLaunchPaths', () => {
  const paths = integrationLaunchPaths('/repo/apps/textscene-vscode/dist/test/integration');

  it('puts the test workspace inside the extension app, beside its manifest', () => {
    expect(paths.extensionDevelopmentPath).toBe('/repo/apps/textscene-vscode');
    expect(paths.workspaceRoot).toBe(`/repo/apps/textscene-vscode${sep}.test-workspace`);
  });

  it('opens the host on the test workspace, so files under it have a folder', () => {
    expect(integrationLaunchOptions(paths).launchArgs[0]).toBe(paths.workspaceRoot);
  });

  it('launches without the GPU on Linux, where the suite runs under Xvfb', () => {
    expect(integrationLaunchOptions(paths, 'linux').launchArgs).toContain('--disable-gpu');
  });

  it('keeps the GPU on macOS and Windows, which run on a real display', () => {
    expect(integrationLaunchOptions(paths, 'darwin').launchArgs).not.toContain('--disable-gpu');
    expect(integrationLaunchOptions(paths, 'win32').launchArgs).not.toContain('--disable-gpu');
  });

  it('names the start marker to the suite through the extension host environment', () => {
    expect(integrationLaunchOptions(paths).extensionTestsEnv).toEqual({
      [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker,
    });
  });
});

describe('vscodeTestVersion', () => {
  it('runs on the latest stable VS Code when nothing names a version', () => {
    expect(vscodeTestVersion(undefined, '^1.85.0')).toBe('stable');
    expect(vscodeTestVersion('', '^1.85.0')).toBe('stable');
  });

  it('resolves min to the floor of the engines.vscode range', () => {
    expect(vscodeTestVersion('min', '^1.85.0')).toBe('1.85.0');
  });

  it('passes an explicit version or channel through unchanged', () => {
    expect(vscodeTestVersion('1.90.2', '^1.85.0')).toBe('1.90.2');
    expect(vscodeTestVersion('insiders', '^1.85.0')).toBe('insiders');
  });

  it('refuses min when the engines range has no single floor', () => {
    expect(() => vscodeTestVersion('min', '>=1.85.0 <2.0.0')).toThrow(
      'expected engines.vscode as ^major.minor.patch, got >=1.85.0 <2.0.0'
    );
  });
});

describe('the extension manifest', () => {
  it('declares an engines.vscode range that min resolves', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    expect(vscodeTestVersion('min', manifest.engines.vscode)).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('launchIntegrationTests', () => {
  it('populates the workspace before the host launches, never after', async () => {
    const calls: string[] = [];
    await launchIntegrationTests({
      paths: fakePaths('/repo/apps/textscene-vscode/.test-workspace'),
      prepareWorkspace: () => void calls.push('prepare'),
      launch: async () => void calls.push('launch'),
    });

    expect(calls).toEqual(['prepare', 'launch']);
  });

  it('hands the launcher a workspace that already exists on disk', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'tsi-launch-'));
    const workspaceRoot = join(parent, '.test-workspace');
    let existedAtLaunch: boolean | null = null;

    try {
      await launchIntegrationTests({
        paths: fakePaths(workspaceRoot),
        prepareWorkspace: (root) => mkdirSync(root, { recursive: true }),
        launch: async (options: IntegrationLaunchOptions) => {
          existedAtLaunch = existsSync(options.launchArgs[0]!);
        },
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    // A directory that appears after this moment is invisible to the window for
    // the rest of the run.
    expect(existedAtLaunch).toBe(true);
  });

  it('propagates a launch failure rather than reporting a green run', async () => {
    await expect(
      launchIntegrationTests({
        paths: fakePaths('/repo/apps/textscene-vscode/.test-workspace'),
        prepareWorkspace: () => {},
        launch: () => Promise.reject(new Error('host exited 1')),
      })
    ).rejects.toThrow('host exited 1');
  });

  describe('when VS Code exits before the suite starts', () => {
    let markerDir: string;
    let marker: string;

    beforeEach(() => {
      markerDir = mkdtempSync(join(tmpdir(), 'tsi-marker-'));
      marker = join(markerDir, 'suite-started');
    });

    afterEach(() => rmSync(markerDir, { recursive: true, force: true }));

    it('relaunches once, and a passing second launch passes the run', async () => {
      let launches = 0;
      await launchIntegrationTests({
        paths: fakePaths('/ws', marker),
        prepareWorkspace: () => {},
        launch: async () => {
          launches += 1;
          if (launches === 1) throw new Error('host exited 1');
        },
      });

      expect(launches).toBe(2);
    });

    it('fails the run when the second launch also exits before the suite starts', async () => {
      let launches = 0;
      await expect(
        launchIntegrationTests({
          paths: fakePaths('/ws', marker),
          prepareWorkspace: () => {},
          launch: async () => {
            launches += 1;
            throw new Error(`host exited 1 on launch ${launches}`);
          },
        })
      ).rejects.toThrow('host exited 1 on launch 2');
    });

    it('never relaunches a run whose suite started, so a failing test fails at once', async () => {
      let launches = 0;
      await expect(
        launchIntegrationTests({
          paths: fakePaths('/ws', marker),
          prepareWorkspace: () => {},
          launch: async () => {
            launches += 1;
            writeFileSync(marker, '');
            throw new Error('1 tests failed.');
          },
        })
      ).rejects.toThrow('1 tests failed.');

      expect(launches).toBe(1);
    });

    it('ignores a marker that an earlier run left behind', async () => {
      writeFileSync(marker, '');
      let launches = 0;
      await launchIntegrationTests({
        paths: fakePaths('/ws', marker),
        prepareWorkspace: () => {},
        launch: async () => {
          launches += 1;
          if (launches === 1) throw new Error('host exited 1');
        },
      });

      expect(launches).toBe(2);
    });
  });
});
