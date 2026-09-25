/**
 * Every node type that reads a Texture2D slot, given an inline procedural texture. A path resolver
 * finds no path in a `SubResource`, so each consumer is checked here at the shared seam, not only
 * in its slice. Godot 4.6.3 renders all five (`scenes/fixtures/unit-*-gradienttexture.tscn`,
 * probes per case), so drawing nothing is a divergence.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnInternalResource, TscnNode } from '../parser/types';
import { SceneResourcesProvider } from '../r3f/SceneResourcesContext';
import { SelectionProvider } from '../r3f/contexts/SelectionContext';
import { CanvasWorkspaceProvider } from '../r3f/contexts/CanvasWorkspaceContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { painterEnv } from '../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../r3f/controls/native/solveTree';
import type { Rect2 } from '../r3f/controls/native/rect';
import { Sprite2D } from '../nodes/2d/sprite2d/Component';
import { parseSprite2D } from '../nodes/2d/sprite2d/parser';
import { Sprite3D } from '../nodes/3d/sprite3d/Component';
import { parseSprite3D } from '../nodes/3d/sprite3d/parser';
import { Decal } from '../nodes/3d/decal/Component';
import { parseDecal } from '../nodes/3d/decal/parser';
import { TextureRect } from '../nodes/2d/ui/texturerect/Component';
import { parseTextureRect } from '../nodes/2d/ui/texturerect/parser';
import { Button } from '../nodes/2d/ui/button/Component';
import { parseButton } from '../nodes/2d/ui/button/parser';

/**
 * The radial cookie the 2D fixtures carry: opaque `Color(0.1, 0.6, 0.9)` at the
 * centre falling to fully transparent at the rim, 256x256.
 */
const GRADIENT_RESOURCES: TscnInternalResource[] = [
  {
    id: 'Gradient_1',
    type: 'Gradient',
    data: {
      offsets: 'PackedFloat32Array(0, 1)',
      colors: 'PackedColorArray(0.1, 0.6, 0.9, 1, 0.1, 0.6, 0.9, 0)',
    },
  },
  {
    id: 'GradientTexture2D_1',
    type: 'GradientTexture2D',
    data: {
      gradient: 'SubResource("Gradient_1")',
      width: '256',
      height: '256',
      fill: '1',
      fill_from: 'Vector2(0.5, 0.5)',
      fill_to: 'Vector2(1, 0.5)',
    },
  },
];

const INLINE_REF = 'SubResource("GradientTexture2D_1")';

function provide(children: ReactNode, workspace?: '2d') {
  const fake = createFakeResourceLoader();
  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={GRADIENT_RESOURCES} externalResources={[]}>
        <SelectionProvider>{children}</SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return ReactThreeTestRenderer.create(
    workspace ? <CanvasWorkspaceProvider workspace={workspace}>{tree}</CanvasWorkspaceProvider> : tree
  );
}

/**
 * A decoded texture's pixel dimensions. three types `THREE.Texture.image` as `unknown`, and every
 * texture here is a rasterised gradient with a width and a height.
 */
function imageSize(texture: THREE.Texture): { width: number; height: number } {
  return texture.image as { width: number; height: number };
}

/** Every `map`/`uCookie` texture bound anywhere in the rendered subtree. */
function mapsIn(renderer: Awaited<ReturnType<typeof provide>>): THREE.Texture[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => ((m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined)?.map)
    .filter((t): t is THREE.Texture => Boolean(t));
}

/** The single magenta placeholder marker, if the node fell back to one. */
function placeholderCount(renderer: Awaited<ReturnType<typeof provide>>): number {
  return renderer.scene
    .findAllByType('Mesh')
    .filter((m) => {
      const material = (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      return material?.color?.getHexString() === 'ff00ff';
    }).length;
}

function node(type: string, properties: TscnNode['properties']): TscnNode {
  return { name: 'N', type, children: [], properties };
}

function solveNodeFor(n: TscnNode): SolveNode {
  // The same pools `provide` puts in the ambient context: a Control painter
  // resolves its own refs in its own scope, and here the two are one scene.
  return {
    ...emptySolveNode(),
    path: n.name,
    node: n,
    resources: { internalResources: GRADIENT_RESOURCES, externalResources: [] },
  };
}

const heading = (type: string) => ({ type: 'node', attributes: { type, name: 'N' } });
const RECT: Rect2 = { x: 0, y: 0, w: 320, h: 160 };

describe('inline GradientTexture2D reaches every Texture2D-valued slot', () => {
  it('Sprite2D — draws the rasterised gradient instead of a missing-resource placeholder', async () => {
    // Godot 4.6.3, `unit-sprite2d-gradienttexture.tscn` at the project
    // viewport: the sprite's centre pixel reads rgb(27, 153, 230) against an
    // rgb(216, 216, 204) backdrop: the gradient's own opaque centre.
    const renderer = await provide(
      <Sprite2D node={node('Sprite2D', parseSprite2D(heading('Sprite2D'), { texture: INLINE_REF }))} />,
      '2d'
    );

    expect(placeholderCount(renderer)).toBe(0);
    const maps = mapsIn(renderer);
    expect(maps).toHaveLength(1);
    expect(imageSize(maps[0]!).width).toBe(256);
    expect(imageSize(maps[0]!).height).toBe(256);
  });

  it('Sprite2D — the centre texel is the gradient stop, at 8-bit', async () => {
    // `Color::get_r8()` on Color(0.1, 0.6, 0.9) → (26, 153, 230), which is what
    // Godot's own probe reads through one alpha step of blending above.
    const renderer = await provide(
      <Sprite2D node={node('Sprite2D', parseSprite2D(heading('Sprite2D'), { texture: INLINE_REF }))} />,
      '2d'
    );
    const data = (mapsIn(renderer)[0]!.image as { data: Uint8Array }).data;
    const centre = (128 + (255 - 128) * 256) * 4;
    expect([data[centre], data[centre + 1], data[centre + 2]]).toEqual([26, 153, 230]);
  });

  it('Sprite2D — borrows one rasterisation and paints a CLONE of it per node', async () => {
    // Sprite2D disposes what it draws, while the procedural cache owns the texture. Two sprites on
    // one gradient pin both halves: one shared pixel buffer, and two texture objects, so each
    // sprite's dispose reaches only its own clone and never the buffer another node samples.
    const sprite = () => (
      <Sprite2D node={node('Sprite2D', parseSprite2D(heading('Sprite2D'), { texture: INLINE_REF }))} />
    );
    const renderer = await provide(
      <>
        {sprite()}
        {sprite()}
      </>,
      '2d'
    );

    const maps = mapsIn(renderer);
    expect(maps).toHaveLength(2);
    expect(maps[0]).not.toBe(maps[1]);
    expect(maps[0]!.image).toBe(maps[1]!.image);
    await renderer.unmount();
  });

  it('Sprite3D — draws the rasterised gradient instead of a missing-resource placeholder', async () => {
    // Godot 4.6.3, `unit-sprite3d-gradienttexture.tscn`: the quad is painted,
    // not absent: probe (400, 378) reads rgb(215, 70, 88) where the unlit
    // background would be rgb(164, 165, 167).
    const renderer = await provide(
      <Sprite3D node={node('Sprite3D', parseSprite3D(heading('Sprite3D'), { texture: INLINE_REF }))} />
    );

    expect(placeholderCount(renderer)).toBe(0);
    const maps = mapsIn(renderer);
    expect(maps).toHaveLength(1);
    expect(imageSize(maps[0]!).width).toBe(256);
  });

  it('TextureRect — paints its quad from the inline gradient', async () => {
    // Godot 4.6.3, `unit-texturerect-gradienttexture.tscn`: probe (110, 200)
    // reads rgb(224, 51, 57) inside the rect, so the quad is drawn.
    const n = node('TextureRect', parseTextureRect(heading('TextureRect'), { texture: INLINE_REF }));
    const renderer = await provide(
      <TextureRect {...painterEnv()} solveNode={solveNodeFor(n)} rect={RECT} renderOrder={0} />,
      '2d'
    );

    const maps = mapsIn(renderer);
    expect(maps).toHaveLength(1);
    expect(imageSize(maps[0]!).width).toBe(256);
  });

  it('Button — paints its icon slot from the inline gradient', async () => {
    // Godot 4.6.3, `unit-button-icon-gradienttexture.tscn`: probe (158, 136)
    // reads rgb(254, 214, 51), the icon's own centre, inside a button whose
    // box is rgb(51, 128, 89).
    const n = node(
      'Button',
      parseButton(heading('Button'), { icon: INLINE_REF })
    );
    const solved: SolveNode = {
      ...solveNodeFor(n),
      textureSize: { x: 256, y: 256 },
    };
    const renderer = await provide(
      <Button
        {...painterEnv()}
        solveNode={solved}
        rect={RECT}
        renderOrder={0}
      />,
      '2d'
    );

    const maps = mapsIn(renderer);
    expect(maps).toHaveLength(1);
    expect(imageSize(maps[0]!).width).toBe(256);
  });

  it('Decal — projects the inline gradient onto a receiver surface', async () => {
    // Godot 4.6.3, `unit-decal-gradienttexture.tscn`: probe (477, 378) reads
    // rgb(237, 165, 160) on the floor where the undecorated plane reads
    // rgb(225, 228, 232): the projection is drawn.
    const decal = node(
      'Decal',
      parseDecal(heading('Decal'), { texture_albedo: INLINE_REF, size: 'Vector3(3, 3, 3)' })
    );
    const renderer = await provide(
      <>
        <mesh name="Receiver" rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial />
        </mesh>
        <Decal node={decal} />
      </>
    );

    // The projection meshes are added imperatively to the decal's own group
    // (see that component's doc for why), so they live in the THREE scene
    // rather than in the test renderer's React view of it.
    const projected: THREE.Texture[] = [];
    (renderer.scene.instance as THREE.Object3D).traverse((obj) => {
      if (obj.userData.isDecalProjection !== true) return;
      const map = ((obj as THREE.Mesh).material as THREE.MeshStandardMaterial).map;
      if (map) projected.push(map);
    });
    expect(projected).toHaveLength(1);
    expect(imageSize(projected[0]!).width).toBe(256);
  });
});
