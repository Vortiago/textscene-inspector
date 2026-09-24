/**
 * Sets up the test workspace as a mirror of the fixtures res:// root, like the web
 * app's copy-fixtures.js.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Copies a source tree into the workspace with no filter: the directory is the
 * res:// namespace, so a file left out makes VS Code disagree with Godot. The
 * 25 MiB Cloudflare Pages skip in copy-fixtures.js has no counterpart, since
 * nothing deploys from here.
 */
function copyRecursive(src: string, dest: string): void {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyRecursive(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

/**
 * Mirrors scenes/fixtures/ into the test workspace.
 * @param workspaceRoot - Root directory of the test workspace
 */
export function setupTestWorkspace(workspaceRoot: string): void {
  console.log('Setting up test workspace at:', workspaceRoot);

  try {
    rmSync(workspaceRoot, { recursive: true, force: true });
  } catch {
    // A workspace that does not exist yet needs no cleaning.
  }
  mkdirSync(workspaceRoot, { recursive: true });

  // From the workspace path, <repo>/apps/textscene-vscode/.test-workspace, not
  // from __dirname: this module is inlined into its importer's bundle.
  const projectRoot = join(workspaceRoot, '../../..');
  const fixturesSource = join(projectRoot, 'scenes', 'fixtures');
  const fixturesTarget = join(workspaceRoot, 'fixtures');

  mkdirSync(fixturesTarget, { recursive: true });
  copyRecursive(fixturesSource, fixturesTarget);

  console.log('  Mirrored scenes/fixtures/ to fixtures/ (res:// root)');
}
