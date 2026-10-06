/**
 * Launch wiring for the installed-package suite, apart from `runInstalledTests.ts` so a
 * test checks it without starting VS Code. The suite runs the extension as a user gets
 * it: VS Code installs the packaged .vsix into an empty extensions directory, and no
 * development path loads the repository's own build.
 */

import * as path from 'path';
import {
  DISABLE_GPU_ENV,
  gpuLaunch,
  SUITE_STARTED_MARKER_ENV,
  type IntegrationLaunchOptions,
} from '../integration/integrationLaunch';

/** The variable that names the extensions directory to the suite inside the extension host. */
export const INSTALLED_EXTENSIONS_DIR_ENV = 'TEXTSCENE_INSTALLED_EXTENSIONS_DIR';

/**
 * The manifest of the extension that carries the suite into the host. VS Code loads a
 * test runner only through a development extension, so this one contributes nothing and
 * leaves the installed package as the only TextScene code in the window.
 */
export const SUITE_HOST_MANIFEST = {
  name: 'textscene-installed-suite-host',
  publisher: 'textscene-test',
  version: '0.0.0',
  engines: { vscode: '*' },
};

/** Every path the launch uses. */
export interface InstalledLaunchPaths {
  /** Removed and recreated each run, so VS Code starts with no extension and no settings. */
  root: string;
  extensionsDir: string;
  userDataDir: string;
  workspaceRoot: string;
  /** The folder of the extension that `SUITE_HOST_MANIFEST` describes. */
  suiteHostPath: string;
  extensionTestsPath: string;
  /** The suite writes this file as it starts, so the launcher knows a test may have run. */
  suiteStartedMarker: string;
}

/**
 * Resolves the launch paths. `runnerDir` is the directory of the runner module,
 * `<vscode-app>/dist/test/installed` once compiled. `root` should be short: macOS caps
 * an IPC socket path, which VS Code puts in the user data directory, at 103 characters.
 */
export function installedLaunchPaths(runnerDir: string, root: string): InstalledLaunchPaths {
  return {
    root,
    extensionsDir: path.join(root, 'extensions'),
    userDataDir: path.join(root, 'user-data'),
    workspaceRoot: path.join(root, 'workspace'),
    suiteHostPath: path.join(root, 'suite-host'),
    extensionTestsPath: path.resolve(runnerDir, './suite/index'),
    suiteStartedMarker: path.join(root, 'suite-started'),
  };
}

/** The user settings of the second launch, in which a user has turned the agent tools off. */
export const TOOLS_OFF_SETTINGS = { 'textscene.agentTools.enabled': false } as const;

/**
 * The paths of the second launch: the same extensions directory and workspace, a user data
 * directory of its own that holds {@link TOOLS_OFF_SETTINGS}, and the suite in `toolsOff/`.
 * The setting is off before the window opens, so the suite checks the tools as a user who
 * never turned them on meets them.
 */
export function toolsOffLaunchPaths(paths: InstalledLaunchPaths, runnerDir: string): InstalledLaunchPaths {
  return {
    ...paths,
    userDataDir: path.join(paths.root, 'user-data-tools-off'),
    extensionTestsPath: path.resolve(runnerDir, './toolsOff/index'),
    suiteStartedMarker: path.join(paths.root, 'suite-started-tools-off'),
  };
}

/** The settings file VS Code reads from a user data directory. */
export function userSettingsFile(userDataDir: string): string {
  return path.join(userDataDir, 'User', 'settings.json');
}

/** The file name `vsce package` gives the package of `manifest`. */
export function vsixFileName(manifest: { name: string; version: string }): string {
  return `${manifest.name}-${manifest.version}.vsix`;
}

/** The VS Code CLI arguments that install `vsixPath` into the run's own directories. */
export function installArgs(paths: InstalledLaunchPaths, vsixPath: string): string[] {
  return [
    '--install-extension',
    vsixPath,
    `--extensions-dir=${paths.extensionsDir}`,
    `--user-data-dir=${paths.userDataDir}`,
  ];
}

/**
 * The options VS Code launches the suite with. `platform` and `requestedGpuOff` are the
 * host's own unless a test names others. No `--disable-extensions`: it would disable the
 * package under test.
 */
export function installedLaunchOptions(
  paths: InstalledLaunchPaths,
  platform: string = process.platform,
  requestedGpuOff: string | undefined = process.env[DISABLE_GPU_ENV]
): IntegrationLaunchOptions {
  const gpu = gpuLaunch(platform, requestedGpuOff);
  return {
    extensionDevelopmentPath: paths.suiteHostPath,
    extensionTestsPath: paths.extensionTestsPath,
    launchArgs: [
      paths.workspaceRoot,
      `--extensions-dir=${paths.extensionsDir}`,
      `--user-data-dir=${paths.userDataDir}`,
      ...gpu.launchArgs,
    ],
    extensionTestsEnv: {
      [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker,
      [INSTALLED_EXTENSIONS_DIR_ENV]: paths.extensionsDir,
      ...gpu.extensionTestsEnv,
    },
  };
}
