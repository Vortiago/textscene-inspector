/**
 * Launch wiring for the extension-host integration suite, apart from `runTests.ts`
 * so a test asserts its ordering without starting VS Code. VS Code resolves its
 * launch folder once, as the window opens, so the workspace is on disk before
 * launch, never prepared inside the suite.
 */

import * as os from 'os';
import * as path from 'path';

/** The subset of `@vscode/test-electron`'s options this runner supplies. */
export interface IntegrationLaunchOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs: string[];
}

/** Every path the launch derives from the directory the runner was loaded from. */
export interface IntegrationLaunchPaths {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  workspaceRoot: string;
  userDataDir: string;
}

/**
 * Resolves the launch paths against `runnerDir`, the directory of the runner
 * module: `<vscode-app>/dist/test/integration` once compiled.
 */
export function integrationLaunchPaths(runnerDir: string): IntegrationLaunchPaths {
  const extensionDevelopmentPath = path.resolve(runnerDir, '../../../');
  return {
    extensionDevelopmentPath,
    extensionTestsPath: path.resolve(runnerDir, './suite/index'),
    workspaceRoot: path.resolve(extensionDevelopmentPath, '.test-workspace'),
    // A short user-data path: macOS caps an IPC socket path at 103 characters.
    userDataDir: path.join(os.tmpdir(), 'vscode-test-data'),
  };
}

/** Build the argument list VS Code is launched with. */
export function integrationLaunchOptions(
  paths: IntegrationLaunchPaths,
): IntegrationLaunchOptions {
  return {
    extensionDevelopmentPath: paths.extensionDevelopmentPath,
    extensionTestsPath: paths.extensionTestsPath,
    launchArgs: [
      paths.workspaceRoot,
      // Keep other installed extensions out of the run.
      '--disable-extensions',
      `--user-data-dir=${paths.userDataDir}`,
    ],
  };
}

export interface IntegrationLaunchDeps {
  paths: IntegrationLaunchPaths;
  prepareWorkspace: (workspaceRoot: string) => void;
  /**
   * `@vscode/test-electron`'s `runTests` resolves with the exit code and rejects on
   * a failing run, so the value is not the signal and stays unnarrowed.
   */
  launch: (options: IntegrationLaunchOptions) => Promise<unknown>;
}

/**
 * Populates the test workspace, then starts the extension host against it. A window
 * that opens with no workspace folder answers `undefined` from
 * `workspace.getWorkspaceFolder` for the whole run, so every `res://` read fails.
 * Preparing here also keeps the suite from recreating a directory the window holds.
 */
export async function launchIntegrationTests(
  deps: IntegrationLaunchDeps,
): Promise<void> {
  deps.prepareWorkspace(deps.paths.workspaceRoot);
  await deps.launch(integrationLaunchOptions(deps.paths));
}
