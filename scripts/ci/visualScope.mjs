#!/usr/bin/env node
/**
 * Decides whether a pull request needs the golden-image run. The run is skipped only when
 * every changed file matches a pattern below, each a file that no golden scene renders
 * through. Anything unlisted runs it, so a new directory is covered until someone lists it.
 * CI passes `git diff --name-only` on stdin and appends `visual=true|false` to $GITHUB_OUTPUT.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Paths that no golden scene reads: the harness captures the web app's WebGL canvas only. */
export const NON_RENDERING_PATHS = [
  // Prose, and the parity gallery's own images, which are not goldens.
  /\.md$/,
  /^docs\//,
  /^LICENSE$/,
  // Tests and test kits run in the unit shards.
  /\.test\.(ts|tsx|js|mjs)$/,
  /\.testkit\.ts$/,
  // Agent and hook configuration.
  /^\.claude\//,
  /^githooks\//,
  /^\.github\/(ISSUE_TEMPLATE\/|pull_request_template\.md$|dependabot\.yml$)/,
  /^\.github\/workflows\/(pages|pr-title|release)\.yml$/,
  // The other apps: the harness builds and drives the web previewer alone.
  /^apps\/textscene-(linter|vscode)\//,
  // The linter's half of core. It feeds the Source pane's gutter, never the canvas.
  /^packages\/textscene-core\/src\/linter\//,
  /^packages\/textscene-core\/src\/.+\/(linter|linterParser|index\.linter)\.ts$/,
  // Scripts the harness does not import (it imports visual/, godot-ref/, showcase/ and
  // corpusRoots.mjs, so those stay unlisted).
  /^scripts\/(githooks|vendor|compare-docs|coverage-report|new-node-slice|vscode|e2e|ci)\//,
  /^scripts\/(coverage-report|new-node-slice|check-bundle-size|check-public-site)\.mjs$/,
];

/**
 * @param {string[]} changedPaths - repo-relative paths, as `git diff --name-only` prints them.
 * @returns {boolean} true unless every path is listed. An empty list runs it too: a diff
 *   that came back empty is more likely a broken checkout than a change to nothing.
 */
export function needsVisualRun(changedPaths) {
  if (changedPaths.length === 0) return true;
  return changedPaths.some((path) => !NON_RENDERING_PATHS.some((pattern) => pattern.test(path)));
}

function main() {
  const changedPaths = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  const visual = needsVisualRun(changedPaths);
  console.error(`[visualScope] ${changedPaths.length} changed file(s): visual=${visual}`);
  console.log(`visual=${visual}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
