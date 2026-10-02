/**
 * Entry point for the installed-package suite: it installs the packaged .vsix into a
 * clean VS Code and runs the suite against that copy. `pnpm vsc:package` writes the
 * .vsix, and CI downloads the one its build job packaged.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from '@vscode/test-electron';
import {
  relaunchIfHostExitsEarly,
  VSCODE_VERSION_ENV,
  vscodeTestVersion,
} from '../integration/integrationLaunch';
import {
  installArgs,
  installedLaunchOptions,
  installedLaunchPaths,
  SUITE_HOST_MANIFEST,
  vsixFileName,
  type InstalledLaunchPaths,
} from './installedLaunch';
import { writeInstalledWorkspace } from './installedWorkspace';

async function main() {
  const appRoot = path.resolve(__dirname, '../../../');
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const vsixPath = path.join(appRoot, vsixFileName(manifest));
  if (!fs.existsSync(vsixPath)) {
    throw new Error(`expected the package at ${vsixPath}, found none. Run pnpm vsc:package first.`);
  }
  const version = vscodeTestVersion(process.env[VSCODE_VERSION_ENV], manifest.engines.vscode);
  const paths = installedLaunchPaths(__dirname, path.join(os.tmpdir(), 'tsi-installed'));

  console.log('Package:', vsixPath);
  console.log('VS Code Version:', version);
  console.log('Extensions Dir:', paths.extensionsDir);

  prepareCleanProfile(paths);
  const vscodeExecutablePath = await downloadAndUnzipVSCode(version);
  const install = await runVSCodeCommand(installArgs(paths, vsixPath), { version });
  console.log(install.stdout.trim());

  await relaunchIfHostExitsEarly(paths.suiteStartedMarker, () =>
    runTests({ ...installedLaunchOptions(paths), vscodeExecutablePath })
  );
}

/** Empties every directory VS Code reads, and writes the suite host and the workspace. */
function prepareCleanProfile(paths: InstalledLaunchPaths): void {
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.mkdirSync(paths.suiteHostPath, { recursive: true });
  fs.writeFileSync(path.join(paths.suiteHostPath, 'package.json'), JSON.stringify(SUITE_HOST_MANIFEST));
  writeInstalledWorkspace(paths.workspaceRoot);
}

main().catch((err) => {
  console.error('Failed to run tests:', err);
  process.exit(1);
});
