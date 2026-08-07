/**
 * `useTexture2D` — one answer for "what texture does this Texture2D slot hold?".
 *
 * The case that motivated it: every PointLight2D in the vendored isometric
 * dungeon uses a `GradientTexture2D` sub-resource for its cookie. That is
 * described entirely inside the scene, so the path-based resolver returns
 * nothing for it and all 23 lights fell back to a missing-resource placeholder,
 * even though a faithful rasteriser for it already existed — reachable only
 * from MeshInstance3D.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { proceduralTexture2DSize, useTexture2D } from './useTexture2D';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from '../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';

import '../r3f/nodes/index';

/** A PointLight2D whose cookie is an inline radial GradientTexture2D. */
const LIGHT_WITH_GRADIENT_COOKIE = `[gd_scene format=3]

[sub_resource type="Gradient" id="g"]
offsets = PackedFloat32Array(0.0111732, 0.636872)
colors = PackedColorArray(0.648926, 0.648926, 0.648926, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="t"]
gradient = SubResource("g")
width = 64
height = 64
fill = 1
fill_from = Vector2(0.5, 0.5)

[node name="Root" type="Node2D"]

[node name="Torch" type="PointLight2D" parent="."]
color = Color(1, 0.466667, 0.0352941, 1)
energy = 2.0
texture = SubResource("t")
`;

/**
 * The cookie a light quad actually samples. A PointLight2D emits Godot's light
 * term through a ShaderMaterial rather than painting a textured quad on the
 * canvas, so the texture arrives as the `uCookie` uniform, not as `map`.
 */
function cookieOf(mesh: unknown): THREE.Texture | undefined {
  const material = (mesh as THREE.Mesh).material as THREE.ShaderMaterial;
  return material.uniforms?.uCookie?.value as THREE.Texture | undefined;
}

async function render(tscn: string) {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

describe('useTexture2D — procedural cookies reach 2D canvas items', () => {
  it('gives a PointLight2D its GradientTexture2D cookie instead of a placeholder', async () => {
    const renderer = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);

    // The placeholder is a magenta plane with no cookie at all; the real light
    // quad samples the rasterised gradient.
    const cookie = cookieOf(meshes[0]!.instance);
    expect(cookie).toBeInstanceOf(THREE.DataTexture);
    const dataCookie = cookie as THREE.DataTexture;
    expect(dataCookie.image.width).toBe(64);
    expect(dataCookie.image.height).toBe(64);
  });

  it('rasterises ONE texture for every node pointing at the same gradient', async () => {
    // A scene aims many nodes at one cookie; a copy per consumer costs
    // width x height x 4 bytes and a GPU upload each time.
    const renderer = await render(`[gd_scene format=3]

[sub_resource type="Gradient" id="g"]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)

[sub_resource type="GradientTexture2D" id="t"]
gradient = SubResource("g")
width = 32
height = 32

[node name="Root" type="Node2D"]

[node name="A" type="PointLight2D" parent="."]
texture = SubResource("t")

[node name="B" type="PointLight2D" parent="."]
texture = SubResource("t")

[node name="C" type="PointLight2D" parent="."]
texture = SubResource("t")
`);
    const cookies = renderer.scene.findAllByType('Mesh').map((m) => cookieOf(m.instance));
    expect(cookies).toHaveLength(3);
    expect(new Set(cookies).size).toBe(1);
  });

  it('keeps the shared texture usable after one consumer unmounts', async () => {
    // The cache owns it; a consumer that disposed on unmount would leave the
    // others sampling a freed buffer.
    const first = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const shared = cookieOf(first.scene.findAllByType('Mesh')[0]!.instance)!;
    await first.unmount();

    const second = await render(LIGHT_WITH_GRADIENT_COOKIE);
    const after = cookieOf(second.scene.findAllByType('Mesh')[0]!.instance)!;
    expect(after.image).toBeTruthy();
    expect(shared.image).toBeTruthy();
  });

  it('still resolves a plain image reference through the async loader', async () => {
    const fake = createFakeResourceLoader();
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = {
      width: 8,
      height: 8,
    };
    fake.textures.seed('res://cookie.png', tex);
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="Texture2D" path="res://cookie.png" id="1"]

[node name="Root" type="Node2D"]

[node name="Torch" type="PointLight2D" parent="."]
texture = ExtResource("1")
`);
    const renderer = await ReactThreeTestRenderer.create(
      <CanvasWorkspaceProvider workspace="2d">
        <ResourceLoaderProvider loader={fake.loader}>
          <SceneResourcesProvider
            internalResources={scene.internalResources}
            externalResources={scene.externalResources}
          >
            <SelectionProvider>
              <NodeDispatcher nodes={scene.nodes} />
            </SelectionProvider>
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      </CanvasWorkspaceProvider>
    );
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(cookieOf(renderer.scene.findAllByType('Mesh')[0]!.instance)).toBe(tex);
  });
});

/**
 * The hook's own three branches, without a node type in the way: every case
 * above reaches it through PointLight2D, so a break anywhere in the 2D light
 * pipeline takes this hook's coverage down with it.
 */
describe('useTexture2D — reference forms', () => {
  const gradientResources: TscnInternalResource[] = [
    {
      id: 'Gradient_a',
      type: 'Gradient',
      data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' },
    },
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '16', height: '16' },
    },
  ];

  function withLoader(seeded?: { path: string; texture: THREE.Texture }) {
    const fake = createFakeResourceLoader();
    if (seeded) fake.textures.seed(seeded.path, seeded.texture);
    return function Wrapper({ children }: { children: ReactNode }) {
      return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
    };
  }

  it('rasterises an inline GradientTexture2D with no file round trip', () => {
    const { result } = renderHook(
      () => useTexture2D('SubResource("GradientTexture2D_a")', [], gradientResources),
      { wrapper: withLoader() }
    );

    expect(result.current.texture).toBeInstanceOf(THREE.DataTexture);
    expect((result.current.texture as THREE.DataTexture).image.width).toBe(16);
    expect(result.current.missing).toBe(false);
  });

  it('loads an ExtResource image through the resource pipeline', () => {
    const image = new THREE.Texture();
    const externalResources: TscnExternalResource[] = [
      { id: '1', type: 'Texture2D', path: 'res://cookie.png' },
    ];

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1")', externalResources, gradientResources),
      { wrapper: withLoader({ path: 'res://cookie.png', texture: image }) }
    );

    expect(result.current.texture).toBe(image);
    expect(result.current.missing).toBe(false);
  });

  it('reports a reference it cannot resolve as missing', () => {
    const { result } = renderHook(
      () => useTexture2D('ExtResource("404")', [], gradientResources),
      { wrapper: withLoader() }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(true);
  });

  it('treats an absent reference as nothing to show, not as missing', () => {
    const { result } = renderHook(() => useTexture2D(undefined, [], gradientResources), {
      wrapper: withLoader(),
    });

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(false);
  });
});

/**
 * The size question, asked without React. A Control's minimum size is solved
 * outside any component (`r3f/controls/native/buildSolveTree.ts`), so it cannot
 * call the hook above — but it needs the same answer for the same slot, and
 * "how big" and "what pixels" drifting apart is the whole defect this module
 * exists to close.
 */
describe('proceduralTexture2DSize', () => {
  const resources: TscnInternalResource[] = [
    {
      id: 'Gradient_a',
      type: 'Gradient',
      data: { colors: 'PackedColorArray(1, 1, 1, 1, 0, 0, 0, 1)' },
    },
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")', width: '160', height: '96' },
    },
    {
      id: 'GradientTexture2D_bare',
      type: 'GradientTexture2D',
      data: { width: '160', height: '96' },
    },
    {
      id: 'GradientTexture2D_default',
      type: 'GradientTexture2D',
      data: { gradient: 'SubResource("Gradient_a")' },
    },
    { id: 'CanvasTexture_a', type: 'CanvasTexture', data: { diffuse_texture: 'ExtResource("1")' } },
  ];

  it("reports an inline GradientTexture2D's declared pixel size", () => {
    expect(proceduralTexture2DSize('SubResource("GradientTexture2D_a")', resources)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it('falls back to the 64x64 a GradientTexture2D is constructed with', () => {
    expect(proceduralTexture2DSize('SubResource("GradientTexture2D_default")', resources)).toEqual({
      x: 64,
      y: 64,
    });
  });

  it('still reports the declared size when the gradient itself is unresolvable', () => {
    // Measured against Godot 4.6.3: a TextureRect holding a GradientTexture2D
    // with no `gradient` still reserves the declared 160x160 in a
    // VBoxContainer (the sibling below it does not move up), because
    // `get_width`/`get_height` read the authored members and never consult the
    // gradient. Tying the size to a successful rasterisation would collapse
    // the node's layout on a resource error.
    expect(proceduralTexture2DSize('SubResource("GradientTexture2D_bare")', resources)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it('declines a sub-resource that is not procedural, leaving the loader to answer', () => {
    expect(proceduralTexture2DSize('SubResource("CanvasTexture_a")', resources)).toBeNull();
  });

  it('declines an ExtResource, a res:// path, an unknown id and an absent reference', () => {
    expect(proceduralTexture2DSize('ExtResource("1")', resources)).toBeNull();
    expect(proceduralTexture2DSize('res://icon.png', resources)).toBeNull();
    expect(proceduralTexture2DSize('SubResource("nope")', resources)).toBeNull();
    expect(proceduralTexture2DSize(undefined, resources)).toBeNull();
  });
});
