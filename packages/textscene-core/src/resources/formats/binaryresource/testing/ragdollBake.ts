/** The vendored `ragdoll_physics` demo's bake, as the bytes a host provider hands over. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenesDir } from '../../../../parser/testing/parserKit';

/** A demo file as a standalone ArrayBuffer, since a Node Buffer is a view into a shared pool. */
export function ragdollBytes(file: string): ArrayBuffer {
  return new Uint8Array(readFileSync(resolve(scenesDir(), 'demos/3d/ragdoll_physics', file))).buffer;
}
