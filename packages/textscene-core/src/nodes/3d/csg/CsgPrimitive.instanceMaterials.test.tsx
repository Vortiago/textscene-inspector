/**
 * A CSG shape is a GeometryInstance3D, so its `material_override` stands in front of the shape's
 * own material and its `material_overlay` draws the surface again
 * (`render_forward_clustered.cpp:4206`, `:4228-4241`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { albedoOf, drawnMeshes } from '../testing/reactThreeTestInstance';
import { subResource } from '../../../testing/subResource';
import './csgbox3d/index.r3f';
import { parseCSGBox3D } from './csgbox3d/parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';

const CSGBox3D = registeredComponent('CSGBox3D');

const INTERNALS: readonly TscnInternalResource[] = [
  subResource('StandardMaterial3D', 'Mat_own', { albedo_color: 'Color(0, 1, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_override', { albedo_color: 'Color(1, 0, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_overlay', { albedo_color: 'Color(0, 0, 1, 1)' }),
];

function boxNode(instanceMaterials: Record<string, string>): TscnNode {
  const properties = parseCSGBox3D(
    { type: 'node', attributes: { type: 'CSGBox3D', name: 'Box' } },
    { material: 'SubResource("Mat_own")', ...instanceMaterials }
  );
  return { rawProperties: {}, name: 'Box', type: 'CSGBox3D', children: [], properties };
}

/** The albedo of every mesh the box draws, in scene-graph order. */
async function drawnAlbedos(instanceMaterials: Record<string, string>): Promise<string[]> {
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNALS}>
      <CSGBox3D node={boxNode(instanceMaterials)} />
    </SceneResourcesProvider>
  );
  return drawnMeshes(renderer.scene).map(albedoOf);
}

describe('<CsgPrimitive> instance materials', () => {
  it('draws its own material when the node sets neither', async () => {
    expect(await drawnAlbedos({})).toEqual(['00ff00']);
  });

  it('draws material_override in place of its own material', async () => {
    expect(await drawnAlbedos({ material_override: 'SubResource("Mat_override")' })).toEqual(['ff0000']);
  });

  it('draws material_overlay as a second draw over its own material', async () => {
    expect(await drawnAlbedos({ material_overlay: 'SubResource("Mat_overlay")' })).toEqual([
      '00ff00',
      '0000ff',
    ]);
  });
});
