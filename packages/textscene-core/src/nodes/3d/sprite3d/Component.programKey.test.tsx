/**
 * Sprite3D's material is mounted, so a `.tscn` re-parse feeds new props to the
 * same `THREE.MeshBasicMaterial`. three baked its program parameters at the
 * first compile (`WebGLPrograms.js:56` `getParameters`) and re-derives only on a
 * `material.version` bump or one of `WebGLRenderer.js:2388`'s fixed re-checks —
 * so the element's key has to carry what a sprite can actually change:
 * the `opaque` composite and the side flags.
 *
 * FrontSide throughout, since Godot's `double_sided` default renders a
 * transparent sprite twice (`WebGLRenderer.js:2133-2141`) and that per-pass
 * `needsUpdate` would mask the staleness.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import { AlphaCutMode, AxisMode, BillboardMode, type Sprite3DProperties } from './types';
import { findMesh } from '../testing/reactThreeTestInstance';

const TEXTURE_PATH = 'res://textures/sprite.png';

function makeNode(overrides: Partial<Sprite3DProperties>): TscnNode {
  const props: Sprite3DProperties = {
    name: 'Sprite',
    texture: 'ExtResource("1_tex")',
    billboard: BillboardMode.BILLBOARD_DISABLED,
    alpha_cut: AlphaCutMode.ALPHA_CUT_DISABLED,
    axis: AxisMode.AXIS_Y,
    pixel_size: 0.01,
    transparency: 0,
    hframes: 1,
    vframes: 1,
    frame: 0,
    offset: { x: 0, y: 0 },
    region_enabled: false,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    render_priority: 0,
    centered: true,
    flip_h: false,
    flip_v: false,
    // Single-sided: the DoubleSide default would self-heal via three's
    // transparent double-pass and hide the staleness these cases pin.
    double_sided: false,
    transparent: true,
    ...overrides,
  };
  return { name: 'Sprite', type: 'Sprite3D', children: [], properties: props };
}

/** Whether the sprite handed the mesh a DIFFERENT THREE.Material after the edit. */
async function rebuilds(
  before: Partial<Sprite3DProperties>,
  after: Partial<Sprite3DProperties>
): Promise<boolean> {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = {
    width: 64,
    height: 64,
  };
  fake.textures.seed(TEXTURE_PATH, texture);
  const tree = (props: Partial<Sprite3DProperties>) => (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        externalResources={[{ id: '1_tex', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <Sprite3D node={makeNode(props)} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree(before));
  const first = findMesh(renderer.scene).material;
  await renderer.update(tree(after));
  return findMesh(renderer.scene).material !== first;
}

const BLENDED: Partial<Sprite3DProperties> = { transparency: 0.5 };

describe('<Sprite3D> rebuilds its material when a baked program parameter moves', () => {
  it('transparency 0 → 0.5 crosses the `opaque` composite', async () => {
    expect(await rebuilds({}, BLENDED)).toBe(true);
  });

  it('transparent true → false forces the sprite back into the opaque pass', async () => {
    expect(await rebuilds(BLENDED, { ...BLENDED, transparent: false })).toBe(true);
  });

  it('double_sided false → true moves doubleSided/flipSided', async () => {
    expect(await rebuilds({}, { double_sided: true })).toBe(true);
  });

  it('alpha_cut on an opaque sprite, which also puts it in the alpha pass', async () => {
    expect(await rebuilds({}, { alpha_cut: AlphaCutMode.ALPHA_CUT_DISCARD })).toBe(true);
  });
});

describe('<Sprite3D> keeps the compiled material for a plain uniform', () => {
  it('transparency 0.5 → 0.25 is opacity alone', async () => {
    expect(await rebuilds(BLENDED, { transparency: 0.25 })).toBe(false);
  });

  it('modulate RGB is the colour uniform', async () => {
    expect(
      await rebuilds(BLENDED, { ...BLENDED, modulate: { r: 1, g: 0, b: 0, a: 1 } })
    ).toBe(false);
  });

  it('alpha_cut on an ALREADY-blended sprite: three bumps `version` itself', async () => {
    // Only `alphaTest` moves here (0 → 0.5), and `Material.js:494-502` bumps
    // `version` on that zero crossing — which is why it is not in the key.
    expect(
      await rebuilds(BLENDED, { ...BLENDED, alpha_cut: AlphaCutMode.ALPHA_CUT_DISCARD })
    ).toBe(false);
  });
});
