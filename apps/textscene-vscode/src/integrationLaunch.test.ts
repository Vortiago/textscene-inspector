/**
 * The integration suite populates `.test-workspace` before launch. VS Code resolves
 * its launch folder once, as the window opens, so a workspace created later never
 * becomes a workspace folder and every `res://` read fails with "No workspace folder
 * found".
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  integrationLaunchOptions,
  integrationLaunchPaths,
  launchIntegrationTests,
  SUITE_STARTED_MARKER_ENV,
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

  it('names the start marker to the suite through the extension host environment', () => {
    expect(integrationLaunchOptions(paths).extensionTestsEnv).toEqual({
      [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker,
    });
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
