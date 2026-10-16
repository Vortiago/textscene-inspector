/**
 * The closure of one scene in a Godot checkout: the files its `ext_resource` paths reach, scene by
 * scene, with the import sidecar of each.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEXT_RESOURCE = /\.(tscn|tres)$/;

/** The `res://` paths, without the scheme, that the `ext_resource` headers of `text` name. */
function extResourcePaths(text) {
  return [...text.matchAll(/^\[ext_resource [^\n]*\bpath="res:\/\/([^"]+)"/gm)].map((m) => m[1]);
}

/** The files `entry` reaches under `root`, as sorted root-relative paths. */
export function reachableFiles(root, entry) {
  const reached = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift();
    if (reached.has(file)) continue;
    reached.add(file);
    if (existsSync(join(root, `${file}.import`))) reached.add(`${file}.import`);
    if (!TEXT_RESOURCE.test(file)) continue;
    for (const path of extResourcePaths(readFileSync(join(root, file), 'utf8'))) {
      if (!existsSync(join(root, path))) {
        throw new Error(`${file} references res://${path}, which is not in the checkout`);
      }
      queue.push(path);
    }
  }
  return [...reached].sort();
}
