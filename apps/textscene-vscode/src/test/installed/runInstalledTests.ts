/**
 * Entry point for the installed-package suite: it installs the packaged .vsix into a
 * clean VS Code and runs the suite against that copy. A second launch runs the `toolsOff`
 * suite on the same copy, with the agent tools turned off in the user settings.
 * `pnpm vsc:package` writes the .vsix, and CI downloads the one its build job packaged.
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
  toolsOffLaunchPaths,
  TOOLS_OFF_SETTINGS,
  userSettingsFile,
  vsixFileName,
  type InstalledLaunchPaths,
} from './installedLaunch';
import { writeSmokeProject } from '../smokeProject/writeSmokeProject';

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

  // The second launch runs after a failed first one too, so one CI run reports both.
  const firstLaunch = await settled(
    relaunchIfHostExitsEarly(paths.suiteStartedMarker, () =>
      runTests({ ...installedLaunchOptions(paths), vscodeExecutablePath })
    )
  );

  const toolsOff = toolsOffLaunchPaths(paths, __dirname);
  writeUserSettings(toolsOff.userDataDir, TOOLS_OFF_SETTINGS);
  console.log('Second launch: the agent tools turned off in the user settings');
  await relaunchIfHostExitsEarly(toolsOff.suiteStartedMarker, () =>
    runTests({ ...installedLaunchOptions(toolsOff), vscodeExecutablePath })
  );

  if (firstLaunch !== undefined) throw firstLaunch;
}

/** The error `run` rejects with, or undefined when it resolves. */
async function settled(run: Promise<unknown>): Promise<unknown> {
  try {
    await run;
    return undefined;
  } catch (err) {
    return err ?? new Error('the first launch failed with no error');
  }
}

/** Writes the user settings VS Code reads at start, before the window opens. */
function writeUserSettings(userDataDir: string, settings: object): void {
  const file = userSettingsFile(userDataDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
}

/** Empties every directory VS Code reads, and writes the suite host and the workspace. */
function prepareCleanProfile(paths: InstalledLaunchPaths): void {
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.mkdirSync(paths.suiteHostPath, { recursive: true });
  fs.writeFileSync(path.join(paths.suiteHostPath, 'package.json'), JSON.stringify(SUITE_HOST_MANIFEST));
  writeSmokeProject(paths.workspaceRoot);
}

main().catch((err) => {
  console.error('Failed to run tests:', err);
  process.exit(1);
});
