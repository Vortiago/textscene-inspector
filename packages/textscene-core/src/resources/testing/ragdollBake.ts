/** The vendored `ragdoll_physics` demo's lightmap bake and atlas, as the bytes a host provider hands over. */

import { resolve } from 'node:path';
import { scenesDir } from '../../parser/testing/parserKit';
import { fileBytes } from './fileBytes';

export function ragdollBytes(file: string): ArrayBuffer {
  return fileBytes(resolve(scenesDir(), 'demos/3d/ragdoll_physics', file));
}
