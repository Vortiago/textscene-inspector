/**
 * The integration suite's launch ordering.
 *
 * A cold checkout has no `.test-workspace`, and VS Code resolves its launch
 * folder argument once, as the window opens — so a workspace created after the
 * launch never becomes a workspace folder, and every `res://` resolution in
 * the run fails with "No workspace folder found". The suite passed on every
 * run after the first only because the previous run had left the directory
 * behind. These tests pin the fix: the workspace is populated first.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  integrationLaunchOptions,
  integrationLaunchPaths,
  launchIntegrationTests,
  type IntegrationLaunchOptions,
  type IntegrationLaunchPaths,
} from './test/integration/integrationLaunch';

function fakePaths(workspaceRoot: string): IntegrationLaunchPaths {
  return {
    extensionDevelopmentPath: '/repo/apps/textscene-vscode',
    extensionTestsPath: '/repo/apps/textscene-vscode/dist/test/integration/suite/index',
    workspaceRoot,
    userDataDir: '/tmp/vscode-test-data',
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

    // A directory that appears only after this moment is invisible to the
    // window for the rest of the run — the failure this ordering prevents.
    expect(existedAtLaunch).toBe(true);
  });

  it('propagates a launch failure rather than reporting a green run', async () => {
    await expect(
      launchIntegrationTests({
        paths: fakePaths('/repo/apps/textscene-vscode/.test-workspace'),
        prepareWorkspace: () => {},
        launch: () => Promise.reject(new Error('host exited 1')),
      }),
    ).rejects.toThrow('host exited 1');
  });
});
