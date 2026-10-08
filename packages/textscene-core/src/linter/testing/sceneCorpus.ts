/** The repository's `scenes/` corpus, walked the way the CLI expands a directory argument. */

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isGodotTextResourcePath } from '../../godot/index.js';

/** The repository's `scenes/` directory. */
export const SCENES_ROOT = resolve(import.meta.dirname, '../../../../../scenes');

/**
 * Both text formats Godot writes, through the predicate the CLI walk and the editor's document filter use: a `.tres`
 * validates against the same registry a `[sub_resource]` block does, so the resource slices are gated too. Every
 * folder under `dir`, sorted.
 */
export function godotTextFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(isGodotTextResourcePath)
    .map((file) => join(dir, file))
    .sort();
}
