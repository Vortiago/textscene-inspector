/**
 * Launch wiring for the installed-package suite, apart from `runInstalledTests.ts` so a
 * test checks it without starting VS Code. The suite runs the extension as a user gets
 * it: VS Code installs the packaged .vsix into an empty extensions directory, and no
 * development path loads the repository's own build.
 */

import * as path from 'path';
import { SUITE_STARTED_MARKER_ENV, type IntegrationLaunchOptions } from '../integration/integrationLaunch';

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
 * The options VS Code launches the suite with. `platform` is the host's own unless a
 * test names another. No `--disable-extensions`: it would disable the package under test.
 */
export function installedLaunchOptions(
  paths: InstalledLaunchPaths,
  platform: string = process.platform
): IntegrationLaunchOptions {
  return {
    extensionDevelopmentPath: paths.suiteHostPath,
    extensionTestsPath: paths.extensionTestsPath,
    launchArgs: [
      paths.workspaceRoot,
      `--extensions-dir=${paths.extensionsDir}`,
      `--user-data-dir=${paths.userDataDir}`,
      // The same software-GL stall as in integrationLaunchOptions.
      ...(platform === 'linux' ? ['--disable-gpu'] : []),
    ],
    extensionTestsEnv: {
      [SUITE_STARTED_MARKER_ENV]: paths.suiteStartedMarker,
      [INSTALLED_EXTENSIONS_DIR_ENV]: paths.extensionsDir,
    },
  };
}
