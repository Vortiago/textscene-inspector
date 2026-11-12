/** `<StandardMaterialSlot>` reads the lightmap its GeometryInstance3D base holds for the instance. */

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { standardMaterialBags } from '../../resources/materials/standardmaterial3d/materialBag';
import { StandardMaterialSlot } from './StandardMaterialSlot';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import { NodePathProvider } from '../contexts/NodePathContext';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../../nodes/3d/geometryinstance3d/types';
import type { TscnNode } from '../../parser/types';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { withGeometryInstance } from '../visibilityRange/geometryInstance';
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

const LEAF: TscnNode = {
  rawProperties: {},
  name: 'Leaf',
  type: 'MeshInstance3D',
  children: [],
  properties: { ...GEOMETRY_INSTANCE_DEFAULTS, name: 'Leaf' },
};

/** `surface` as what a GeometryInstance3D draws. */
function underInstance(surface: ReactNode): ReactNode {
  const Leaf = withGeometryInstance(() => surface);
  return (
    <SceneResourcesProvider internalResources={[]}>
      <Leaf node={LEAF} />
    </SceneResourcesProvider>
  );
}

/** The material a slot for `data` draws with at `path`, once a LightmapGI names `Root/Floor`. */
async function materialAt(
  path: string,
  data: Record<string, string> = {},
  mounted: (surface: ReactNode) => ReactNode = underInstance
): Promise<THREE.Material> {
  const renderer = await ReactThreeTestRenderer.create(
    <NodePathProvider path={path}>
      {mounted(
        <mesh>
          <StandardMaterialSlot bags={standardMaterialBags(parseStandardMaterial3DScalars(data))} />
        </mesh>
      )}
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
  it('reads the lightmap of the LightmapGI that names its instance', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR))).toBe(true);
  });

  it('reads none on a node no LightmapGI names', async () => {
    expect(readsDrawnLightmap(await materialAt('Root/Wall'))).toBe(false);
  });

  it('reads none under no GeometryInstance3D, which holds no instance a LightmapGI can light', async () => {
    // `Object::cast_to<VisualInstance3D>` fails for such a node (`lightmap_gi.cpp:1551-1552`).
    expect(readsDrawnLightmap(await materialAt(FLOOR, {}, (surface) => surface))).toBe(false);
  });

  it('reads none on a transparent surface, which Godot draws outside the opaque pass', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR, { transparency: '1' }))).toBe(false);
  });

  it('reads none on an unshaded surface, which reads no light (edge case)', async () => {
    expect(readsDrawnLightmap(await materialAt(FLOOR, { shading_mode: '0' }))).toBe(false);
  });
});
