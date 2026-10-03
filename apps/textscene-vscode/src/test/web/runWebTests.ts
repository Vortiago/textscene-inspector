/**
 * Entry point for the web suite: it runs the suite in VS Code for the Web, in headless
 * Chromium, against the `browser` build of the extension.
 */
import * as fs from 'fs';
import { runTests } from '@vscode/test-web';
import { writeSmokeProject } from '../smokeProject/writeSmokeProject';
import { webLaunchOptions, webLaunchPaths } from './webLaunch';

async function main() {
  const paths = webLaunchPaths(__dirname);
  fs.rmSync(paths.workspaceRoot, { recursive: true, force: true });
  writeSmokeProject(paths.workspaceRoot);

  await runTests(webLaunchOptions(paths));
}

main().catch((err) => {
  console.error('Failed to run tests:', err);
  process.exit(1);
});
