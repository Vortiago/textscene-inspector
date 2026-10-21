/**
 * Godot imports each GLB node with a mesh as a MeshInstance3D, which a LightmapGI names by its path
 * in the instancing scene. Driven by one scene render from 11 units.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { nodesGlb } from '../../../resources/formats/glb/testing/nodesGlb';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import { SceneStack } from '../../testing/SceneStack';
import { manualCameraAt, renderScene } from '../../testing/renderScene';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { GLBSceneRoot } from './Component';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';
import { GlbInstanceProvider } from './GlbInstanceContext';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { LightmapInstance, lightmapsOf } from '../../lightmap/sceneLightmaps';
import { unfadedMaterial } from '../../materials/fadedMeshMaterials';
import { UV2_ATTRIBUTE } from '../../../resources/meshes/uv2';

const GLB_PATH = 'res://lamp.glb';

const GLB_ROOT: TscnNode = {
  rawProperties: {},
  name: 'lamp',
  type: GLB_SCENE_ROOT_TYPE,
  children: [],
  properties: { glbPath: GLB_PATH } as Record<string, unknown>,
};

const LAMP: TscnNode = { rawProperties: {}, name: 'Lamp', type: 'Node3D', children: [], properties: {} };

/** A LightmapGI that names the node at `path`. */
function lightmapNaming(path: string): LightmapInstance {
  const instance = new LightmapInstance(new THREE.Object3D());
  instance.isDrawn = true;
  instance.users = new Map([
    [
      path,
      {
        path: '../Lamp/Single',
        uvScale: { x: 0, y: 0, width: 1, height: 1 },
        sliceIndex: 0,
        subInstance: -1,
      },
    ],
  ]);
  return instance;
}

/** `glb` with UV2 on every mesh, as Godot bakes only a mesh with UV2. */
function withUv2(glb: THREE.Object3D): THREE.Object3D {
  glb.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const { count } = object.geometry.getAttribute('position');
    object.geometry.setAttribute(UV2_ATTRIBUTE, new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  });
  return glb;
}

/** The material Lamp's GLB mesh Single draws with, once a LightmapGI names `named`. */
async function singleMaterial(named: string): Promise<THREE.Material> {
  const fake = createFakeResourceLoader();
  fake.glbMeshes.seed(
    GLB_PATH,
    withUv2(await createGLBMesh(nodesGlb([{ name: 'Single', mesh: 0 }]), NO_SIDECAR))
  );
  const camera = manualCameraAt({ x: 0.5, y: 0.5, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: [] }}>
      <GlbInstanceProvider node={LAMP} path="Root/Lamp">
        <NodePathProvider path="Root/Lamp/lamp">
          <GLBSceneRoot node={GLB_ROOT} />
        </NodePathProvider>
      </GlbInstanceProvider>
    </SceneStack>,
    { camera }
  );
  const scene = renderer.scene.instance as THREE.Scene;
  await ReactThreeTestRenderer.act(async () => {
    lightmapsOf(scene).add(lightmapNaming(named));
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });
  await renderScene(renderer, camera);
  return (scene.getObjectByName('Single') as THREE.Mesh).material as THREE.Material;
}

describe('a GLB mesh lightmap', () => {
  it('draws a copy of its material that reads the lightmap of the LightmapGI that names it', async () => {
    const material = await singleMaterial('Root/Lamp/Single');
    expect(unfadedMaterial(material)).not.toBe(material);
    expect(material.customProgramCacheKey()).toContain('godot-lightmap-read');
  });

  it('draws its own material when no LightmapGI names it (edge case)', async () => {
    const material = await singleMaterial('Root/Lamp/Other');
    expect(material.customProgramCacheKey()).not.toContain('godot-lightmap-read');
  });
});
