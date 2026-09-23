/**
 * The prune policy of the corpus vendor scripts (vendor-godot-demos.mjs, vendor-godot-games.mjs):
 * the Godot editor and source artefacts the previewer never reads. One copy keeps both corpora
 * stripped the same way.
 */

import { basename } from 'node:path';

export function isPruned(path) {
  const name = basename(path);
  if (name === '.godot' || name === 'screenshots' || name === '.git') return true;
  if (name === '.gitignore' || name === '.gitattributes' || name === '.gdignore') return true;
  return /\.(import|psd|xcf|blend|blend1|svg\.import)$/.test(name);
}
