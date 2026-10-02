/**
 * Launch wiring for the extension-host integration suite, apart from `runTests.ts`
 * so a test asserts its ordering without starting VS Code. VS Code resolves its
 * launch folder once, as the window opens, so the workspace is on disk before
 * launch, never prepared inside the suite.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** The variable that names the suite's start marker inside the extension host. */
export const SUITE_STARTED_MARKER_ENV = 'TEXTSCENE_SUITE_STARTED_MARKER';

/** The variable that picks the VS Code build the suite runs on. */
export const VSCODE_VERSION_ENV = 'TEXTSCENE_VSCODE_VERSION';

/**
 * The value of `VSCODE_VERSION_ENV` that names the oldest VS Code the manifest
 * accepts, so CI tests the `engines.vscode` floor without repeating its number.
 */
export const ENGINES_FLOOR = 'min';

/**
 * Resolves the requested build to a version `@vscode/test-electron` downloads.
 * Nothing requested means `stable`. `min` means the floor of `enginesRange`, the
 * manifest's `engines.vscode`. Any other value, `insiders` or `1.90.0`, passes through.
 */
export function vscodeTestVersion(requested: string | undefined, enginesRange: string): string {
  if (!requested) return 'stable';
  if (requested !== ENGINES_FLOOR) return requested;
  const floor = /^\^(\d+\.\d+\.\d+)$/.exec(enginesRange)?.[1];
  if (!floor) throw new Error(`expected engines.vscode as ^major.minor.patch, got ${enginesRange}`);
  return floor;
}

/** The subset of `@vscode/test-electron`'s options this runner supplies. */
export interface IntegrationLaunchOptions {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  launchArgs: string[];
  extensionTestsEnv: Record<string, string>;
}

/** Every path the launch derives from the directory the runner was loaded from. */
export interface IntegrationLaunchPaths {
  extensionDevelopmentPath: string;
  extensionTestsPath: string;
  workspaceRoot: string;
  userDataDir: string;
  /** The suite writes this file as it starts, so the launcher knows a test may have run. */
  suiteStartedMarker: string;
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
    suiteStartedMarker: path.join(os.tmpdir(), 'vscode-test-suite-started'),
  };
}

/**
 * Build the argument list VS Code is launched with. `platform` is the host's own
 * unless a test names another.
 */
export function integrationLaunchOptions(
  paths: IntegrationLaunchPaths,
  platform: string = process.platform
): IntegrationLaunchOptions {
  return {
    extensionDevelopmentPath: paths.extensionDevelopmentPath,
    extensionTestsPath: paths.extensionTestsPath,
    launchArgs: [
      paths.workspaceRoot,
      // Keep other installed extensions out of the run.
      '--disable-extensions',
      `--user-data-dir=${paths.userDataDir}`,
      // Xvfb has no GPU, so Chromium emulates one in software. On the Ubuntu runner
      // the window stalls before the workbench opens, and only Linux runs this way.
      ...(platform === 'linux' ? ['--disable-gpu'] : []),
    ],
    extensionTestsEnv: { [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker },
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
export async function launchIntegrationTests(deps: IntegrationLaunchDeps): Promise<void> {
  deps.prepareWorkspace(deps.paths.workspaceRoot);
  await relaunchIfHostExitsEarly(deps.paths.suiteStartedMarker, () =>
    deps.launch(integrationLaunchOptions(deps.paths))
  );
}

/**
 * Runs `launch`, and once more when it fails before the suite writes `suiteStartedMarker`.
 * VS Code exits with code 1 on the first unresponsive window of a CLI test run
 * (`windowImpl.ts:1020-1022`, 1.140.0), and a stalled CI window hits that before any test
 * runs. A failure after the suite starts is never retried.
 */
export async function relaunchIfHostExitsEarly(
  suiteStartedMarker: string,
  launch: () => Promise<unknown>
): Promise<void> {
  const launchOnce = async () => {
    fs.rmSync(suiteStartedMarker, { force: true });
    await launch();
  };
  try {
    await launchOnce();
  } catch (err) {
    if (fs.existsSync(suiteStartedMarker)) throw err;
    console.warn(`[IntegrationLaunch] VS Code exited before the suite started (${err}). Relaunching once.`);
    await launchOnce();
  }
}
