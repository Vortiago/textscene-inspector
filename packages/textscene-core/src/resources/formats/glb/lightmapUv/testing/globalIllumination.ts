/** The vendored `global_illumination` demo's files, read as the bytes a host provider hands over. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as THREE from 'three';
import { scenesDir } from '../../../../../parser/testing/parserKit';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { meshSurfaces } from '../../godotPrimitives';

const DEMO = resolve(scenesDir(), 'demos/3d/global_illumination');

/** A demo file as a standalone ArrayBuffer, since a Node Buffer is a view into a shared pool. */
export function demoBytes(file: string): ArrayBuffer {
  return new Uint8Array(readFileSync(resolve(DEMO, file))).buffer;
}

/** The geometry of each primitive of a demo GLB's first mesh, as three's GLTFLoader reads it. */
export async function demoMeshSurfaces(file: string): Promise<THREE.BufferGeometry[]> {
  const gltf = await new GLTFLoader().parseAsync(demoBytes(file), '');
  return [...(await meshSurfaces(gltf, 0)).values()];
}
