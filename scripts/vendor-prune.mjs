/**
 * The prune policy of the corpus vendor scripts (vendor-godot-demos/vendor.mjs,
 * vendor-godot-games.mjs): the Godot editor and source artefacts the previewer never reads. One
 * copy keeps both corpora stripped the same way.
 */

import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * The importers whose sidecars the previewer reads (ADR-0028): a scene's re-import options, a
 * texture's format and mip chain, and the slices of a 3D texture or a texture array, such as a
 * lightmap atlas. `import-sidecar-allowlist.test.mjs` asserts it against the importers core names.
 */
export const READ_IMPORTERS = new Set([
  'scene',
  'wavefront_obj',
  'texture',
  '3d_texture',
  '2d_array_texture',
]);

/** Copies the tree at `src` to `dest` without what the prune drops, and returns the file count. */
export function copyPruned(src, dest) {
  let files = 0;
  cpSync(src, dest, {
    recursive: true,
    filter: (path) => {
      if (isPruned(path)) return false;
      if (statSync(path).isFile()) files++;
      return true;
    },
  });
  return files;
}

export function isPruned(path) {
  const name = basename(path);
  if (name === '.godot' || name === 'screenshots' || name === '.git') return true;
  if (name === '.gitignore' || name === '.gitattributes' || name === '.gdignore') return true;
  if (name.endsWith('.import')) return !isReadSidecar(path);
  return /\.(psd|xcf|blend|blend1)$/.test(name);
}

/**
 * Whether the previewer reads the sidecar at `path`. One beside no asset, or beside an asset the
 * prune drops, such as a `.blend`, describes nothing.
 */
function isReadSidecar(path) {
  const asset = path.slice(0, -'.import'.length);
  if (!existsSync(asset) || isPruned(asset)) return false;
  return READ_IMPORTERS.has(sidecarImporter(readFileSync(path, 'utf8')));
}

const SECTION_LINE = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;
const IMPORTER_LINE = /^importer="([^"]*)"$/;

/** The `[remap] importer=` a sidecar's text names, or null when it names none. */
export function sidecarImporter(text) {
  let section = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = SECTION_LINE.exec(line);
    if (heading) section = heading[1];
    const importer = section === 'remap' ? IMPORTER_LINE.exec(line) : null;
    if (importer) return importer[1];
  }
  return null;
}
