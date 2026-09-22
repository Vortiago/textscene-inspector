/**
 * A CSG `material` reaches the same slot whichever way it arrives — an
 * ExtResource `.tres` or an inline `[sub_resource]` — because the node holds only
 * a `Ref<Material>` and cannot tell them apart.
 *
 * Every CSG fixture in the golden bag declares its material inline, so no golden
 * can see the external arrival at all; this is the only thing that gates it.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CsgPrimitive } from './CsgPrimitive';
// CsgPrimitive builds the solid from the registered builder, so the node type under
// test has to have its slice wired.
import './csgbox3d/index.r3f';
import { parseCSGBox3D } from './csgbox3d/parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import type { CSGBox3DProperties } from './csgbox3d/types';
import { findMesh } from '../testing/reactThreeTestInstance';

const ALBEDO_PATH = 'res://textures/albedo.png';

const EXTERNALS: readonly TscnExternalResource[] = [
  { id: '1_blue', path: 'res://blue_material.tres', type: 'Material' },
  { id: '2_tex', path: ALBEDO_PATH, type: 'Texture2D' },
];

const INTERNALS: readonly TscnInternalResource[] = [
  { id: 'Mat_inline', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  {
    id: 'Mat_textured',
    type: 'StandardMaterial3D',
    data: { albedo_texture: 'ExtResource("2_tex")' },
  },
];

function makeNode(material: string | undefined): TscnNode {
  const properties = parseCSGBox3D(
    { type: 'node', attributes: { type: 'CSGBox3D', name: 'Box' } },
    material ? { material } : {}
  );
  return { name: 'Box', type: 'CSGBox3D', children: [], properties };
}

async function render(material: string | undefined, seed?: THREE.Material) {
  const fake = createFakeResourceLoader();
  if (seed) fake.materials.seed('res://blue_material.tres', seed);
  const albedo = new THREE.Texture();
  albedo.needsUpdate = false;
  fake.textures.seed(ALBEDO_PATH, albedo);
  const node = makeNode(material);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={INTERNALS} externalResources={EXTERNALS}>
        <CsgPrimitive node={node} properties={node.properties as CSGBox3DProperties} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function materialOf(renderer: Awaited<ReturnType<typeof render>>) {
  return findMesh(renderer.scene).material as THREE.MeshStandardMaterial;
}

describe('<CsgPrimitive> material resolution', () => {
  it('loads a StandardMaterial3D from an ExtResource .tres', async () => {
    const loaded = new THREE.MeshStandardMaterial({ color: 0x5ab7ff });
    const renderer = await render('ExtResource("1_blue")', loaded);
    expect(materialOf(renderer)).toBe(loaded);
  });

  it('resolves an inline material\'s texture slots, as a mesh surface does', async () => {
    const renderer = await render('SubResource("Mat_textured")');
    expect(materialOf(renderer).map).toBeInstanceOf(THREE.Texture);
  });

  it('still parses an inline SubResource material', async () => {
    const renderer = await render('SubResource("Mat_inline")');
    expect(materialOf(renderer).color.getHex()).not.toBe(0xffffff);
  });

  it('shows the unresolved-resource placeholder while the .tres has not loaded', async () => {
    const renderer = await render('ExtResource("1_blue")');
    // The pending placeholder IS the default material — an unresolved path is the
    // same case as no material at all, so it must not be a distinct colour.
    const linear = materialOf(renderer).color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(linear.r).toBeCloseTo(0.6, 5);
  });

  it('keeps the default material when the ExtResource is not a Material', async () => {
    // `material` is a `Ref<Material>`; a Texture2D does not load into it, so the
    // write is dropped and the solid keeps Godot's default shader (not the
    // unresolved-resource white).
    const renderer = await render('ExtResource("2_tex")');
    const linear = materialOf(renderer).color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(linear.r).toBeCloseTo(0.6, 5);
  });

  it('falls back to Godot’s default material shader when no material is declared', async () => {
    const renderer = await render(undefined);
    // ALBEDO = vec3(0.6) in Godot's hardcoded default shader, linear.
    const linear = materialOf(renderer).color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(linear.r).toBeCloseTo(0.6, 5);
  });
});
