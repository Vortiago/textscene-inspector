/**
 * Launch wiring for the web suite, apart from `runWebTests.ts` so a test checks it
 * without starting a browser. `@vscode/test-web` serves VS Code for the Web, loads the
 * repository app as a development extension and runs the suite in its web extension host.
 */

import * as path from 'path';
import type { runTests } from '@vscode/test-web';

export type WebLaunchOptions = Parameters<typeof runTests>[0];

/** Every path the launch uses. */
export interface WebLaunchPaths {
  /** The extension under test: the folder of its `package.json`, whose `browser` entry the host loads. */
  appRoot: string;
  /** Removed and rewritten each run. The browser sees it as `vscode-test-web://mount/`. */
  workspaceRoot: string;
  extensionTestsPath: string;
}

/** Resolves the launch paths. `runnerDir` is the directory of the runner module, `<app>/dist/test/web` once compiled. */
export function webLaunchPaths(runnerDir: string): WebLaunchPaths {
  const appRoot = path.resolve(runnerDir, '../../../');
  return {
    appRoot,
    workspaceRoot: path.join(appRoot, '.test-workspace-web'),
    extensionTestsPath: path.resolve(runnerDir, './suite/index.js'),
  };
}

/** The options `@vscode/test-web` launches the suite with. */
export function webLaunchOptions(paths: WebLaunchPaths): WebLaunchOptions {
  return {
    browserType: 'chromium',
    headless: true,
    // The build vscode.dev serves. The package's own default is insiders.
    quality: 'stable',
    extensionDevelopmentPath: paths.appRoot,
    extensionTestsPath: paths.extensionTestsPath,
    folderPath: paths.workspaceRoot,
  };
}
