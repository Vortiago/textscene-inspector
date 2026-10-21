/**
 * A MeshInstance3D a LightmapGI names reads its lightmap on every lit surface. Godot reads it in
 * any lit spatial shader (`scene_forward_clustered.glsl:1835-1876`), so a ShaderMaterial surface,
 * which draws as Godot's default surface here (ADR-0041), reads it too.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { assignedUsers, LightmapInstance, lightmapsOf } from '../../../r3f/lightmap/sceneLightmaps';
import { parseMeshInstance3D } from './parser';
import { findMesh } from '../testing/reactThreeTestInstance';
import './index.r3f';

const MeshInstance3D = registeredComponent('MeshInstance3D');

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: { add_uv2: 'true' } };
const SHADER: TscnInternalResource = { id: 'shader', type: 'ShaderMaterial', data: {} };

function boxNode(properties: Record<string, string>): TscnNode {
  const heading = { type: 'node', attributes: { type: 'MeshInstance3D', name: 'Floor' } };
  return {
    name: 'Floor',
    type: 'MeshInstance3D',
    rawProperties: properties,
    children: [],
    properties: parseMeshInstance3D(heading, { mesh: 'SubResource("box")', ...properties }),
  };
}

/** The material the box draws once a drawn LightmapGI names `Root/Floor`. */
async function materialOf(node: TscnNode): Promise<THREE.Material> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={loaderServing()} scene={{ internalResources: [BOX, SHADER] }}>
      <NodePathProvider path="Root/Floor">
        <MeshInstance3D node={node} />
      </NodePathProvider>
    </SceneStack>
  );
  const lightmap = new LightmapInstance(new THREE.Object3D());
  lightmap.isDrawn = true;
  lightmap.users = assignedUsers(
    'Root/LightmapGI',
    [{ path: '../Floor', uvScale: { x: 0, y: 0, width: 1, height: 1 }, sliceIndex: 0, subInstance: -1 }],
    undefined
  );
  await ReactThreeTestRenderer.act(async () => {
    lightmapsOf(renderer.scene.instance as THREE.Scene).add(lightmap);
  });
  return findMesh(renderer.scene).material as THREE.Material;
}

function readsLightmap(material: THREE.Material): boolean {
  return material.customProgramCacheKey().includes('godot-lightmap-read');
}

describe('<MeshInstance3D> lightmap', () => {
  it("reads the lightmap on a surface with no material, Godot's default surface", async () => {
    expect(readsLightmap(await materialOf(boxNode({})))).toBe(true);
  });

  it('reads the lightmap on a ShaderMaterial surface', async () => {
    expect(readsLightmap(await materialOf(boxNode({ material_override: 'SubResource("shader")' })))).toBe(
      true
    );
  });
});
