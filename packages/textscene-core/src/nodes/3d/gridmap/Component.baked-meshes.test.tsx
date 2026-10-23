/**
 * A GridMap with `baked_meshes` draws them in place of its cells (`grid_map.cpp:688`), each at the
 * GridMap's own transform (`:1037-1039`), and a LightmapGI names each by its index. Driven by the
 * Godot 4.6.3 bake in `unit-lightmap-gi-gridmap.tscn`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../../parser/TscnParser';
import { fixturesDir } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { assignedUsers, LightmapInstance, lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import type { LightmapUser } from '../../../resources/lightmapgidata/types';
import { drawnMeshes } from '../testing/reactThreeTestInstance';
import './index.r3f';
import '../meshinstance3d/index.r3f';
import { settleLoads } from '../../../r3f/testing/settleLoads';

const GridMap = registeredComponent('GridMap');

const scene = new TscnParser().parse(
  readFileSync(join(fixturesDir(), 'unit-lightmap-gi-gridmap.tscn'), 'utf8')
);
const gridMapNode = scene.nodes[0]!.children.find((node) => node.type === 'GridMap')!;

/** A drawn LightmapGI that names the GridMap's baked mesh `subInstance`. */
function lightmapNaming(subInstance: number): LightmapInstance {
  const instance = new LightmapInstance(new THREE.Object3D());
  instance.isDrawn = true;
  const user: LightmapUser = {
    path: '../GridMap',
    uvScale: { x: 0, y: 0, width: 1, height: 1 },
    sliceIndex: 0,
    subInstance,
  };
  instance.users = assignedUsers('Root/LightmapGI', [user], undefined);
  return instance;
}

async function render(node: TscnNode, lightmap?: LightmapInstance) {
  const camera = manualCameraAt({ x: 0, y: 4, z: 8 });
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={loaderServing()} scene={scene}>
      <NodePathProvider path="Root/GridMap">
        <GridMap node={node} />
      </NodePathProvider>
    </SceneStack>,
    { camera }
  );
  if (lightmap) {
    await ReactThreeTestRenderer.act(async () => {
      lightmapsOf(renderer.scene.instance as THREE.Scene).add(lightmap);
    });
    await settleLoads();
  }
  await renderScene(renderer, camera);
  return renderer;
}

function readsLightmap(mesh: THREE.Mesh): boolean {
  return (mesh.material as THREE.Material).customProgramCacheKey().includes('godot-lightmap-read');
}

describe('<GridMap> with baked meshes', () => {
  it('draws each baked mesh in place of its cells', async () => {
    const meshes = drawnMeshes((await render(gridMapNode)).scene);
    expect(meshes.filter((mesh) => mesh instanceof THREE.InstancedMesh)).toEqual([]);
    expect(meshes.map((mesh) => mesh.geometry.getAttribute('position').count)).toEqual([72, 48]);
  });

  it('draws its cells when it holds no baked mesh (edge case)', async () => {
    const cellsOnly = { ...gridMapNode, properties: { ...gridMapNode.properties, bakedMeshes: [] } };
    const meshes = drawnMeshes((await render(cellsOnly)).scene);
    expect(meshes.some((mesh) => mesh instanceof THREE.InstancedMesh)).toBe(true);
  });

  it('gives the baked mesh a LightmapGI names by its index that lightmap, and no other', async () => {
    const meshes = drawnMeshes((await render(gridMapNode, lightmapNaming(1))).scene);
    expect(meshes.map(readsLightmap)).toEqual([false, true]);
  });
});
