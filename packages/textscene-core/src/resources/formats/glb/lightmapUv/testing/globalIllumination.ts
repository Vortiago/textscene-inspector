/** The vendored `global_illumination` demo's files, read as the bytes a host provider hands over. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type * as THREE from 'three';
import { scenesDir } from '../../../../../parser/testing/parserKit';
import { initGlbModules } from '../../glbProcessing';

const DEMO = resolve(scenesDir(), 'demos/3d/global_illumination');

/** A demo file as a standalone ArrayBuffer, since a Node Buffer is a view into a shared pool. */
export function demoBytes(file: string): ArrayBuffer {
  return new Uint8Array(readFileSync(resolve(DEMO, file))).buffer;
}

/** The geometry of each primitive of a demo GLB's first mesh, as three's GLTFLoader reads it. */
export async function demoMeshSurfaces(file: string): Promise<THREE.BufferGeometry[]> {
  const { GLTFLoader } = await initGlbModules();
  const gltf = await new GLTFLoader().parseAsync(demoBytes(file), '');
  const mesh = (await gltf.parser.getDependency('mesh', 0)) as THREE.Object3D;
  const primitives = (mesh as THREE.Mesh).isMesh ? [mesh] : mesh.children;
  return primitives.map((primitive) => (primitive as THREE.Mesh).geometry);
}
