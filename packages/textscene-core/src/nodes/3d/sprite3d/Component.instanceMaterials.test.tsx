/**
 * A Sprite3D is a GeometryInstance3D, so `material_override` draws its quad in place of the
 * sprite's own material and `material_overlay` draws the quad again
 * (`render_forward_clustered.cpp:4206`, `:4228-4241`). The sprite's billboard and `fixed_size` are
 * flags of its own material (`sprite_3d.cpp:299`), so neither reaches the other two.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { albedoOf, instanceAs } from '../testing/reactThreeTestInstance';
import { subResource } from '../../../testing/subResource';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { parseSprite3D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import './index.r3f';
import { registeredComponent } from '../../../r3f/testing/registeredComponent';
import { quadUvWindow } from './testing/quadUvWindow';

const Sprite3D = registeredComponent('Sprite3D');

const TEXTURE_PATH = 'res://sprite.png';

const INTERNALS: readonly TscnInternalResource[] = [
  subResource('StandardMaterial3D', 'Mat_override', { albedo_color: 'Color(1, 0, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_overlay', { albedo_color: 'Color(0, 0, 1, 1)' }),
  subResource('StandardMaterial3D', 'Mat_alpha_overlay', {
    albedo_color: 'Color(0, 0, 1, 0.5)',
    transparency: '1',
  }),
  // The right half of the 64 px sheet, inside a 48 by 76 px cell.
  subResource('AtlasTexture', 'Atlas_cell', {
    atlas: 'ExtResource("1")',
    region: 'Rect2(32, 0, 32, 64)',
    margin: 'Rect2(8, 4, 16, 12)',
  }),
];

const ATLAS = { texture: 'SubResource("Atlas_cell")', pixel_size: '0.5' };
const OVERRIDE = { material_override: 'SubResource("Mat_override")' };
const OVERLAY = { material_overlay: 'SubResource("Mat_overlay")' };
/** Yawed a quarter turn, so a billboard under the test camera's identity basis shows. */
const YAWED = { transform: 'Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 3, 2, 0)' };

const SHEET_PX = 64;

/** A texture whose pixels read back, so an AtlasTexture can cut its cell from it. */
function texture(): THREE.Texture {
  return new THREE.DataTexture(new Uint8Array(SHEET_PX * SHEET_PX * 4), SHEET_PX, SHEET_PX, THREE.RGBAFormat);
}

/** Every mesh the sprite draws after two frames, in scene-graph order. */
async function drawnMeshes(raw: Record<string, string>): Promise<THREE.Mesh[]> {
  const rawProperties = { texture: 'ExtResource("1")', ...raw };
  const node: TscnNode = {
    rawProperties,
    name: 'Sprite',
    type: 'Sprite3D',
    children: [],
    properties: parseSprite3D(heading('Sprite3D', { name: 'Sprite' }), rawProperties),
  };
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEXTURE_PATH, texture());
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={INTERNALS}
        externalResources={[{ id: '1', type: 'Texture2D', path: TEXTURE_PATH }]}
      >
        <Sprite3D node={node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await renderer.advanceFrames(2, 16);
  (renderer.scene.instance as THREE.Object3D).updateMatrixWorld(true);
  return renderer.scene.findAllByType('Mesh').map((mesh) => instanceAs<THREE.Mesh>(mesh));
}

/** The world direction of the mesh's local +X. */
function worldRight(mesh: THREE.Mesh): number[] {
  return new THREE.Vector3()
    .setFromMatrixColumn(mesh.matrixWorld, 0)
    .normalize()
    .toArray()
    .map((component) => Math.round(component));
}

describe('<Sprite3D> instance materials', () => {
  it('draws its own textured material when the node sets neither', async () => {
    const [quad, ...extra] = await drawnMeshes({});

    expect((quad!.material as THREE.MeshBasicMaterial).map).not.toBeNull();
    expect(extra).toEqual([]);
  });

  it('draws material_override in place of its own material', async () => {
    const [quad, ...extra] = await drawnMeshes(OVERRIDE);

    expect(albedoOf(quad!)).toBe('ff0000');
    expect((quad!.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect(extra).toEqual([]);
  });

  it('draws material_overlay as a second draw of the quad', async () => {
    const [quad, overlay] = await drawnMeshes(OVERLAY);

    expect((quad!.material as THREE.MeshBasicMaterial).map).not.toBeNull();
    expect(albedoOf(overlay!)).toBe('0000ff');
    expect(overlay!.geometry).toBe(quad!.geometry);
  });

  it('draws an alpha-pass overlay before the alpha-pass sprite, as Godot sorts the two', async () => {
    const [quad, overlay] = await drawnMeshes({ material_overlay: 'SubResource("Mat_alpha_overlay")' });

    expect(overlay!.renderOrder).toBeLessThan(quad!.renderOrder);
  });

  it('gives the override no billboard of the sprite', async () => {
    const [quad] = await drawnMeshes({ ...OVERRIDE, ...YAWED, billboard: '1' });

    expect(worldRight(quad!)).toEqual([0, 0, -1]);
  });

  it('gives the override no fixed_size of the sprite', async () => {
    const [quad] = await drawnMeshes({ ...OVERRIDE, fixed_size: 'true' });

    expect(new THREE.Vector3().setFromMatrixScale(quad!.matrixWorld).toArray()).toEqual([1, 1, 1]);
  });

  it('keeps the overlay at the node pose while the sprite billboards', async () => {
    const [quad, overlay] = await drawnMeshes({ ...OVERLAY, ...YAWED, billboard: '1' });

    expect(worldRight(quad!)).toEqual([1, 0, 0]);
    expect(worldRight(overlay!)).toEqual([0, 0, -1]);
  });

  it('casts the shadow of the override, whatever the sprite material would cast', async () => {
    // A transparent sprite joins no shadow pass. Its opaque override does.
    const [own] = await drawnMeshes({});
    const [overridden] = await drawnMeshes(OVERRIDE);

    expect(own!.castShadow).toBe(false);
    expect(overridden!.castShadow).toBe(true);
  });

  it('hands the override the flipped frame in the quad UVs, as the sprite mesh holds it', async () => {
    const [quad] = await drawnMeshes({ ...OVERRIDE, hframes: '2', frame: '1', flip_h: 'true' });

    expect(quadUvWindow(quad!.geometry)).toEqual({ offset: { x: 1, y: 0 }, repeat: { x: -0.5, y: 1 } });
  });

  it('hands the override the modulate as the vertex colour, cut to eight bits', async () => {
    const [quad] = await drawnMeshes({ ...OVERRIDE, modulate: 'Color(0.2, 1, 0.5, 0.999)' });

    const colours = quad!.geometry.getAttribute('color');
    expect(colours.normalized).toBe(true);
    expect(Array.from(colours.array.slice(0, 4))).toEqual([51, 255, 127, 254]);
  });

  it('hands the override the UVs of the atlas for an AtlasTexture', async () => {
    const [quad] = await drawnMeshes({ ...ATLAS, ...OVERRIDE });

    expect(quadUvWindow(quad!.geometry)).toEqual({ offset: { x: 0.5, y: 0 }, repeat: { x: 0.5, y: 1 } });
  });

  it('cuts the quad to the region of an AtlasTexture, at the margin position from the top left', async () => {
    const [quad] = await drawnMeshes({ ...ATLAS, ...OVERRIDE });
    quad!.geometry.computeBoundingBox();
    const { min, max } = quad!.geometry.boundingBox!;

    // The 48 by 76 px cell is centred: 8 px in from its left, 4 px down from its top.
    expect([min.x, max.x]).toEqual([-8, 8]);
    expect([min.y, max.y]).toEqual([-15, 17]);
  });

  it('samples the atlas itself with its own material, not the cut cell', async () => {
    const [quad] = await drawnMeshes(ATLAS);

    const image = (quad!.material as THREE.MeshBasicMaterial).map!.image as { width: number };
    expect(image.width).toBe(SHEET_PX);
  });
});
