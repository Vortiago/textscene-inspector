/**
 * Test runner for VS Code extension integration tests.
 * Downloads VS Code and runs tests in Extension Development Host.
 */
import * as path from 'path';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to the extension test runner script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // The test workspace path (will be set up by setupWorkspace)
    const testWorkspace = path.resolve(__dirname, '../../../.test-workspace');

    // Use shorter user data path to avoid macOS IPC socket path length limit (103 chars)
    const userDataDir = path.join(os.tmpdir(), 'vscode-test-data');

    console.log('Extension Development Path:', extensionDevelopmentPath);
    console.log('Extension Tests Path:', extensionTestsPath);
    console.log('Test Workspace:', testWorkspace);
    console.log('User Data Dir:', userDataDir);

    // Download VS Code, unzip it and run the integration tests
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions', // Disable other extensions to avoid interference
        `--user-data-dir=${userDataDir}`, // Use shorter path for IPC socket
      ],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
