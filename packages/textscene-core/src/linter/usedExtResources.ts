import { readsBeforeParseStop } from '../resources/loadFailure/fileReads.js';
import type { StrictScene } from '../parser/types.js';

/**
 * Where the uses of one `[ext_resource]` sit. `aborting`: a failed load of it fails the file's load. `node`: every use
 * is in a node's heading or body, which the loader leaves out and goes on.
 */
export type ExtResourceUse = 'aborting' | 'node';

type ScannedText = Pick<
  StrictScene,
  'externalResources' | 'internalResources' | 'fileValues' | 'headingStop'
>;

/** Each `[ext_resource]` id the values name before the parse stops, and where, as the preview reads them. */
export function extResourceUses(scene: ScannedText): Map<string, ExtResourceUse> {
  const uses = new Map<string, ExtResourceUse>();
  for (const { read, value } of readsBeforeParseStop(scene)) {
    if (read.kind !== 'ExtResource') continue;
    const use = value.place === 'node' ? 'node' : 'aborting';
    if (uses.get(read.id) !== 'aborting') uses.set(read.id, use);
  }
  return uses;
}
