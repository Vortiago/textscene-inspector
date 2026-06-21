/**
 * Shared prune policy for the corpus vendor scripts (vendor-godot-demos.mjs,
 * vendor-godot-games.mjs): the Godot editor/source artifacts the previewer
 * never reads. Single-sourced so the two corpora can't silently diverge on
 * what gets stripped.
 */

import { basename } from 'node:path';

export function isPruned(path) {
  const name = basename(path);
  if (name === '.godot' || name === 'screenshots' || name === '.git') return true;
  if (name === '.gitignore' || name === '.gitattributes' || name === '.gdignore') return true;
  return /\.(import|psd|xcf|blend|blend1|svg\.import)$/.test(name);
}
