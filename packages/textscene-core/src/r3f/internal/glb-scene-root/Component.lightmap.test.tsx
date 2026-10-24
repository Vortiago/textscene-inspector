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
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { settleLoads } from '../../testing/settleLoads';
import type { TscnNode } from '../../../parser/types';
import { SceneStack } from '../../testing/SceneStack';
import { manualCameraAt, renderScene } from '../../testing/renderScene';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { GLBSceneRoot } from './Component';
import { GLB_SCENE_ROOT_TYPE } from '../../../resources/glbSceneRoot';
import { GlbInstanceProvider } from './GlbInstanceContext';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { assignedUsers, LightmapInstance, lightmapsOf } from '../../lightmap/sceneLightmaps';
import { NodeDispatcher } from '../../NodeDispatcher';
import { parsedNode } from '../../../parser/testing/parserKit';
import '../../nodes/index';
import '../../../nodes/3d/meshinstance3d/index';
import '../../../nodes/node/index';
import { unfadedMaterial } from '../../materials/fadedMeshMaterials';
import { UV2_ATTRIBUTE } from '../../../resources/meshes/uv2';
import { markReadsNoLightmap } from '../../../resources/formats/glb/meshInstances';

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

async function lampGlb(): Promise<THREE.Object3D> {
  return withUv2(await createGLBMesh(nodesGlb([{ name: 'Single', mesh: 0 }]), NO_SIDECAR));
}

/** `lampGlb` as the importer leaves a mesh it unwrapped and the previewer could not rebuild. */
async function unrebuiltLampGlb(): Promise<THREE.Object3D> {
  const glb = await lampGlb();
  glb.traverse(markReadsNoLightmap);
  return glb;
}

/** The material Lamp's GLB mesh Single draws with, once a LightmapGI names `named`. */
async function singleMaterial(named: string, glb = lampGlb()): Promise<THREE.Material> {
  const fake = createFakeResourceLoader();
  fake.glbMeshes.seed(GLB_PATH, await glb);
  const camera = manualCameraAt({ x: 0.5, y: 0.5, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={{ internalResources: [] }}>
      <GlbInstanceProvider node={LAMP} path="Root/Lamp">
        <NodePathProvider path="Root/Lamp">
          <GLBSceneRoot node={GLB_ROOT} />
        </NodePathProvider>
      </GlbInstanceProvider>
    </SceneStack>,
    { camera }
  );
  const scene = renderer.scene.instance as THREE.Scene;
  await ReactThreeTestRenderer.act(async () => {
    lightmapsOf(scene).add(lightmapNaming(named));
  });
  await settleLoads();
  await renderScene(renderer, camera);
  return (scene.getObjectByName('Single') as THREE.Mesh).material as THREE.Material;
}

describe('a GLB mesh lightmap', () => {
  it('draws a copy of its material that reads the lightmap of the LightmapGI that names it', async () => {
    const material = await singleMaterial('Root/Lamp/Single');
    expect(unfadedMaterial(material)).not.toBe(material);
    expect(material.customProgramCacheKey()).toContain('godot-lightmap-read');
  });

  it('draws its own material when the importer unwrapped the mesh and the previewer cannot rebuild it', async () => {
    const material = await singleMaterial('Root/Lamp/Single', unrebuiltLampGlb());
    expect(material.customProgramCacheKey()).not.toContain('godot-lightmap-read');
  });

  it('draws its own material when no LightmapGI names it (edge case)', async () => {
    const material = await singleMaterial('Root/Lamp/Other');
    expect(material.customProgramCacheKey()).not.toContain('godot-lightmap-read');
  });
});

/** A MeshInstance3D named Marker, added to the GLB node Group by an instancing scene. */
const MARKER: TscnNode = {
  ...parsedNode({ name: 'Marker', type: 'MeshInstance3D' }, { mesh: 'SubResource("box")' }),
  instanceSubPath: 'Group',
};

describe('a lightmap user path naming a typed node attached into a GLB', () => {
  async function markerMaterial(named: string): Promise<THREE.Material> {
    const fake = createFakeResourceLoader();
    seedGlbInstance(
      fake,
      GLB_PATH,
      Object.assign(new THREE.Group(), { children: [Object.assign(new THREE.Group(), { name: 'Group' })] })
    );
    const lamp: TscnNode = {
      ...parsedNode({ name: 'Lamp', type: 'Node', instance: 'ExtResource("lamp")' }),
      children: [MARKER],
    };
    const root: TscnNode = { ...parsedNode({ name: 'Root', type: 'Node3D' }), children: [lamp] };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack
        loader={fake.loader}
        scene={{
          internalResources: [{ id: 'box', type: 'BoxMesh', data: { add_uv2: 'true' } }],
          externalResources: [{ id: 'lamp', path: GLB_PATH, type: 'PackedScene' }],
        }}
      >
        <NodeDispatcher nodes={[root]} />
      </SceneStack>
    );
    const lightmap = new LightmapInstance(new THREE.Object3D());
    lightmap.isDrawn = true;
    lightmap.users = assignedUsers(
      'Root/LightmapGI',
      [{ path: `../${named}`, uvScale: { x: 0, y: 0, width: 1, height: 1 }, sliceIndex: 0, subInstance: -1 }],
      undefined
    );
    await settleLoads();
    await ReactThreeTestRenderer.act(async () => {
      lightmapsOf(renderer.scene.instance as THREE.Scene).add(lightmap);
    });
    const meshes = new Set(renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh));
    expect(meshes.size).toBe(1);
    return [...meshes][0]!.material as THREE.Material;
  }

  it('gives the node the lightmap, by the path Godot gives it', async () => {
    const material = await markerMaterial('Lamp/Group/Marker');
    expect(material.customProgramCacheKey()).toContain('godot-lightmap-read');
  });

  it('gives the node none for a path through the GLB file name (edge case)', async () => {
    const material = await markerMaterial('Lamp/lamp/Group/Marker');
    expect(material.customProgramCacheKey()).not.toContain('godot-lightmap-read');
  });
});
