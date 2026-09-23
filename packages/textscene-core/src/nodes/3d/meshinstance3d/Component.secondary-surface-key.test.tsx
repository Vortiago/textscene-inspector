/**
 * A `material-N` (N > 0) slot's key carries every baked program parameter an edit
 * can move, here the `opaque` composite and the side flags. A re-parse mutates the
 * compiled material, and three re-derives parameters (`WebGLPrograms.js:56`) only on
 * a `material.version` bump or `WebGLRenderer.js:2388`'s fixed re-checks.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { MeshInstance3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import type { MeshInstance3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';
import { inlineTwoSurfaceMesh } from './testing/twoSurfaceMesh';

/** Surface 1 of a two-surface mesh, the only slot this suite overrides. */
function makeNode(): TscnNode {
  const props: MeshInstance3DProperties = {
    name: 'Panel',
    mesh: 'SubResource("Mesh_1")',
    surfaceMaterialOverrides: new Map([[1, 'SubResource("Mat_1")']]),
  };
  return { name: 'Panel', type: 'MeshInstance3D', children: [], properties: props };
}

/** Whether surface 1 got a different THREE.Material after the edit. */
async function rebuilds(
  before: Record<string, string>,
  after: Record<string, string>
): Promise<boolean> {
  const tree = (data: Record<string, string>) => {
    const resources: TscnInternalResource[] = [
      inlineTwoSurfaceMesh('Mesh_1'),
      { id: 'Mat_1', type: 'StandardMaterial3D', data },
    ];
    return (
      <SceneResourcesProvider internalResources={resources}>
        <MeshInstance3D node={makeNode()} />
      </SceneResourcesProvider>
    );
  };
  const renderer = await ReactThreeTestRenderer.create(tree(before));
  const surface1 = () => (findMesh(renderer.scene).material as THREE.Material[])[1]!;
  const first = surface1();
  await renderer.update(tree(after));
  return surface1() !== first;
}

const ALPHA = { transparency: '1' };

describe('secondary-surface material rebuilds when a baked program parameter moves', () => {
  it.each([
    ['transparency 0 → 1 crosses the `opaque` composite', ALPHA],
    ['blend_mode MIX → ADD moves the same composite', { blend_mode: '1' }],
    ['cull_mode BACK → DISABLED moves doubleSided/flipSided', { cull_mode: '2' }],
  ])('%s', async (_case, after) => {
    expect(await rebuilds({}, after)).toBe(true);
  });
});

describe('secondary-surface material keeps the compiled material for a plain uniform', () => {
  it.each([
    ['opacity', { ...ALPHA, albedo_color: 'Color(1, 1, 1, 0.25)' }],
    ['albedo colour', { ...ALPHA, albedo_color: 'Color(1, 0, 0, 1)' }],
    ['roughness', { ...ALPHA, roughness: '0.25' }],
  ])('%s', async (_case, after) => {
    expect(await rebuilds(ALPHA, after)).toBe(false);
  });
});
