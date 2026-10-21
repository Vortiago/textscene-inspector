/**
 * Applies this repository's changes to a godot-demo-projects checkout. Each file under
 * `text-resources/` is the Godot text copy of the binary resource of the same stem, which it
 * replaces, and `local-changes.patch` edits the upstream text files. Paths are relative to the
 * checkout root, so the patch reads against upstream.
 */

import { cpSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, extname, join, relative } from 'node:path';

/**
 * The binary forms a text copy replaces: a scene, and a mesh whose old surface format Godot
 * converts on load (`mesh.cpp:1662-1664`) and the ArrayMesh decoder does not.
 */
const BINARY_RESOURCE_EXTENSIONS = new Set(['.scn', '.mesh']);

export function applyLocalChanges(changesDir, checkout) {
  replaceBinaryResources(join(changesDir, 'text-resources'), checkout);
  applyPatch(join(changesDir, 'local-changes.patch'), checkout);
}

function replaceBinaryResources(textResources, checkout) {
  const files = readdirSync(textResources, { recursive: true, withFileTypes: true }).filter((e) =>
    e.isFile()
  );
  for (const entry of files) {
    const rel = relative(textResources, join(entry.parentPath, entry.name));
    rmSync(join(checkout, binaryResourceBeside(checkout, rel)));
    cpSync(join(textResources, rel), join(checkout, rel));
  }
}

/** The one binary resource in `checkout` with the stem of the text resource at `rel`. */
function binaryResourceBeside(checkout, rel) {
  const stem = basename(rel, extname(rel));
  const matches = readdirSync(join(checkout, dirname(rel)), { withFileTypes: true }).filter(
    (e) =>
      e.isFile() &&
      basename(e.name, extname(e.name)) === stem &&
      BINARY_RESOURCE_EXTENSIONS.has(extname(e.name))
  );
  if (matches.length !== 1) {
    throw new Error(`expected one binary resource beside ${rel} in the checkout, found ${matches.length}`);
  }
  return join(dirname(rel), matches[0].name);
}

function applyPatch(patch, checkout) {
  try {
    execFileSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: checkout, stdio: 'pipe' });
  } catch (e) {
    throw new Error(`${basename(patch)} does not apply to the checkout: ${e.stderr ?? e}`, {
      cause: e,
    });
  }
}
