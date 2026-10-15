/**
 * The prune policy of the corpus vendor scripts (vendor-godot-demos.mjs, vendor-godot-games.mjs):
 * the Godot editor and source artefacts the previewer never reads. One copy keeps both corpora
 * stripped the same way.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * The importers whose sidecars the previewer reads (ADR-0028): a scene's re-import options, a
 * texture's format and mip chain, and a 3D texture's slices.
 */
const READ_IMPORTERS = new Set(['scene', 'wavefront_obj', 'texture', '3d_texture']);

export function isPruned(path) {
  const name = basename(path);
  if (name === '.godot' || name === 'screenshots' || name === '.git') return true;
  if (name === '.gitignore' || name === '.gitattributes' || name === '.gdignore') return true;
  if (name.endsWith('.import')) return !isReadSidecar(path);
  return /\.(psd|xcf|blend|blend1)$/.test(name);
}

/** Whether the previewer reads the sidecar at `path`. One beside no asset describes nothing. */
function isReadSidecar(path) {
  const asset = path.slice(0, -'.import'.length);
  if (!existsSync(asset)) return false;
  const importer = /^importer="([^"]*)"/m.exec(readFileSync(path, 'utf8'))?.[1];
  return READ_IMPORTERS.has(importer);
}
