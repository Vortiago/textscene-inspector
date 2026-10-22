/** `<StandardMaterialSlot>` reads the lightmap of the LightmapGI that names its node. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { standardMaterialBags } from '../../resources/materials/standardmaterial3d/materialBag';
import { StandardMaterialSlot } from './StandardMaterialSlot';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { NodePathProvider } from '../contexts/NodePathContext';
import { LightmapInstance, lightmapsOf } from '../lightmap/sceneLightmaps';
import type { ProgramShader } from '../materialProgramInputs';

const FLOOR = 'Root/Floor';

/** A drawn LightmapGI in the renderer's scene that names `Root/Floor`. */
function nameFloor(scene: THREE.Scene): LightmapInstance {
  const instance = new LightmapInstance(new THREE.Object3D());
  instance.isDrawn = true;
  instance.users = new Map([
    [
      FLOOR,
      { path: '../Floor', uvScale: { x: 0, y: 0, width: 1, height: 1 }, sliceIndex: 0, subInstance: -1 },
    ],
  ]);
  lightmapsOf(scene).add(instance);
  return instance;
}

/** The material a slot for `data` gives the node at `path`, once a LightmapGI names `Root/Floor`. */
async function materialAt(path: string, data: Record<string, string> = {}): Promise<THREE.Material> {
  const renderer = await ReactThreeTestRenderer.create(
    <NodePathProvider path={path}>
      <mesh>
        <StandardMaterialSlot bags={standardMaterialBags(parseStandardMaterial3DScalars(data))} />
      </mesh>
    </NodePathProvider>
  );
  await ReactThreeTestRenderer.act(async () => {
    nameFloor(renderer.scene.instance as unknown as THREE.Scene);
  });
  return (renderer.scene.findByType('Mesh').instance as unknown as THREE.Mesh).material as THREE.Material;
}

/** Whether `material` compiles with a lightmap that its uniforms read as drawn. */
function readsDrawnLightmap(material: THREE.Material): boolean {
  if (!material.customProgramCacheKey().includes('godot-lightmap-read')) return false;
  const shader: ProgramShader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  };
  material.onBeforeCompile.call(material, shader as never, null as never);
  return shader.uniforms.godotLightmapActive!.value === true;
}

describe('<StandardMaterialSlot> lightmap', () => {
  it('reads the lightmap of the LightmapGI that names its node', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR))).toBe(true);
  });

  it('reads none on a node no LightmapGI names', async () => {
    expect(readsDrawnLightmap(await materialAt('Root/Wall'))).toBe(false);
  });

  it('reads none on a transparent surface, which Godot draws outside the opaque pass', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR, { transparency: '1' }))).toBe(false);
  });

  it('reads none on an unshaded surface, which reads no light (edge case)', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR, { shading_mode: '0' }))).toBe(false);
  });
});
