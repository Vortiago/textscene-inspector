/**
 * CSG `material` accepts an ExtResource `.tres`, not just a SubResource.
 *
 * `resolveStandardMaterial` only understands `SubResource("id")`, so every CSG
 * node in scenes/demos/3d/csg/csg.tscn — 33 `material = ExtResource(...)` lines
 * — rendered as Godot's default white. Both existing CSG fixtures declare their
 * materials inline as sub-resources, so no golden could see it.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CsgPrimitive } from './CsgPrimitive';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';

const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_blue', path: 'res://blue_material.tres', type: 'Material' },
];

const INTERNALS: readonly TscnInternalResource[] = [
  { id: 'Mat_inline', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
];

const node: TscnNode = { name: 'Box', type: 'CSGBox3D', children: [], properties: {} };

async function render(material: string | undefined, seed?: THREE.Material) {
  const fake = createFakeResourceLoader();
  if (seed) fake.materials.seed('res://blue_material.tres', seed);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
        <CsgPrimitive
          node={node}
          properties={{ name: 'Box', material }}
          geometry={<boxGeometry args={[1, 1, 1]} />}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function materialOf(renderer: Awaited<ReturnType<typeof render>>) {
  return renderer.scene.findByType('Mesh').instance.material as THREE.MeshStandardMaterial;
}

describe('<CsgPrimitive> material resolution', () => {
  it('loads a StandardMaterial3D from an ExtResource .tres', async () => {
    const loaded = new THREE.MeshStandardMaterial({ color: 0x5ab7ff });
    const renderer = await render('ExtResource("1_blue")', loaded);
    expect(materialOf(renderer)).toBe(loaded);
  });

  it('still parses an inline SubResource material', async () => {
    const renderer = await render('SubResource("Mat_inline")');
    expect(materialOf(renderer).color.getHex()).not.toBe(0xffffff);
  });

  it('falls back to Godot default white when the .tres has not loaded', async () => {
    const renderer = await render('ExtResource("1_blue")');
    expect(materialOf(renderer).color.getHex()).toBe(0xffffff);
  });

  it('falls back to Godot default white when no material is declared', async () => {
    const renderer = await render(undefined);
    expect(materialOf(renderer).color.getHex()).toBe(0xffffff);
  });
});
