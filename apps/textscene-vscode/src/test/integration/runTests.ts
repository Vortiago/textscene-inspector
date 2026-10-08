/**
 * Entry point for the extension-host integration suite: it downloads VS Code,
 * populates the test workspace and runs the suite in an Extension Development Host.
 * `integrationLaunch.ts` holds the ordering constraint.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';
import {
  integrationLaunchPaths,
  launchIntegrationTests,
  VSCODE_VERSION_ENV,
  vscodeTestVersion,
} from './integrationLaunch';
import { setupTestWorkspace } from './setupWorkspace';

async function main() {
  const paths = integrationLaunchPaths(__dirname);
  const version = vscodeTestVersion(
    process.env[VSCODE_VERSION_ENV],
    readEnginesRange(paths.extensionDevelopmentPath)
  );

  console.log('Extension Development Path:', paths.extensionDevelopmentPath);
  console.log('Extension Tests Path:', paths.extensionTestsPath);
  console.log('Test Workspace:', paths.workspaceRoot);
  console.log('User Data Dir:', paths.userDataDir);
  console.log('VS Code Version:', version);

  try {
    await launchIntegrationTests({
      paths,
      prepareWorkspace: setupTestWorkspace,
      launch: (options) => runTests({ ...options, version }),
    });
    // An aborted VS Code download leaves its `tar` children alive, and they hold the event
    // loop open after the suite passes until CI cancels the job.
    process.exit(0);
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

/** The manifest's `engines.vscode` range. */
function readEnginesRange(extensionDevelopmentPath: string): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionDevelopmentPath, 'package.json'), 'utf8'));
  return manifest.engines.vscode;
}

main();
