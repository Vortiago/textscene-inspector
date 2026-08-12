/**
 * Sets up the test workspace by mirroring the fixtures res:// root.
 * Mirrors the web app's copy-fixtures.js pattern.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Copy a source tree verbatim into the workspace.
 *
 * No filter at all: what the directory contains IS the res:// namespace, and
 * the extension resolves res:// against the workspace root, so anything left
 * out would make VS Code disagree with Godot and the web previewer about what
 * a fixture's references mean. (copy-fixtures.js drops files over Cloudflare
 * Pages' 25 MiB ceiling; nothing deploys from a test workspace, so that one
 * deployment-limit skip has no counterpart here.)
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

  // Clean and create workspace directory
  try {
    rmSync(workspaceRoot, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  mkdirSync(workspaceRoot, { recursive: true });

  // Derive the repo root from the workspace path, not from __dirname: this
  // module is inlined into whichever test bundle imports it, so __dirname
  // would point at the importer's output directory, not this file's.
  // workspaceRoot is <repo>/apps/textscene-vscode/.test-workspace.
  const projectRoot = join(workspaceRoot, '../../..');
  const fixturesSource = join(projectRoot, 'scenes', 'fixtures');
  const fixturesTarget = join(workspaceRoot, 'fixtures');

  mkdirSync(fixturesTarget, { recursive: true });
  copyRecursive(fixturesSource, fixturesTarget);

  console.log('  Mirrored scenes/fixtures/ to fixtures/ (res:// root)');
}
