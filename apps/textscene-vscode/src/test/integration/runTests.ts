/**
 * Entry point for the VS Code extension-host integration suite.
 * Downloads VS Code, populates the test workspace, and runs the suite in an
 * Extension Development Host.
 *
 * The ordering constraint — workspace on disk before the window opens — and
 * why it is not the suite's job lives in `integrationLaunch.ts`.
 */
import { runTests } from '@vscode/test-electron';
import { integrationLaunchPaths, launchIntegrationTests } from './integrationLaunch';
import { setupTestWorkspace } from './setupWorkspace';

async function main() {
  const paths = integrationLaunchPaths(__dirname);

  console.log('Extension Development Path:', paths.extensionDevelopmentPath);
  console.log('Extension Tests Path:', paths.extensionTestsPath);
  console.log('Test Workspace:', paths.workspaceRoot);
  console.log('User Data Dir:', paths.userDataDir);

  try {
    await launchIntegrationTests({
      paths,
      prepareWorkspace: setupTestWorkspace,
      launch: (options) => runTests(options),
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
