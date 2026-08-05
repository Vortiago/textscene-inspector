/**
 * Launch wiring for the VS Code extension-host integration suite.
 *
 * Split out of `runTests.ts` so the one ordering constraint that matters here
 * is assertable without downloading and starting VS Code: the test workspace
 * must be on disk BEFORE the host window opens.
 *
 * VS Code resolves each folder path in its launch arguments once, while the
 * window opens. A path that does not exist yet is not retried and does not
 * become a workspace folder when it later appears — the window simply opens
 * with none, and `workspace.getWorkspaceFolder` then returns `undefined` for
 * every file for the rest of the session. Any host code that maps a file back
 * to its folder, which is how a `res://` reference is resolved, fails for the
 * whole run.
 *
 * That is why `prepareWorkspace` runs out here rather than inside the suite:
 * a suite runs after the window is already open, so it is too late to affect
 * what the window opened with. Preparing it here also stops the suite from
 * deleting and recreating a directory the running window holds open.
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
 * Resolve the launch paths relative to `runnerDir` — the directory holding the
 * runner module, `<vscode-app>/dist/test/integration` once compiled.
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
   * Resolves however the launcher likes — `@vscode/test-electron`'s `runTests`
   * resolves with the host's exit code and REJECTS on a failing run, so the
   * value is not the signal and is deliberately not narrowed here.
   */
  launch: (options: IntegrationLaunchOptions) => Promise<unknown>;
}

/**
 * Populate the test workspace, then start the extension host against it.
 *
 * The order is the contract: see this module's header for what a window that
 * opened without a workspace folder does to the rest of the run.
 */
export async function launchIntegrationTests(
  deps: IntegrationLaunchDeps,
): Promise<void> {
  deps.prepareWorkspace(deps.paths.workspaceRoot);
  await deps.launch(integrationLaunchOptions(deps.paths));
}
