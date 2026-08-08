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
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { inlineTexture2DSize, useTexture2D } from './useTexture2D';
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

  it('rasterises a GradientTexture2D wrapped in a CanvasTexture', () => {
    // A CanvasTexture is a Texture2D wrapper; Godot draws its `diffuse_texture`,
    // whatever that is. Resolving the wrapper to a PATH can only see the map
    // that HAS one, so an inline diffuse resolved to nothing at all.
    const wrapped: TscnInternalResource[] = [
      ...gradientResources,
      {
        id: 'CanvasTexture_a',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("GradientTexture2D_a")' },
      },
    ];

    const { result } = renderHook(
      () => useTexture2D('SubResource("CanvasTexture_a")', [], wrapped),
      { wrapper: withLoader() }
    );

    expect(result.current.texture).toBeInstanceOf(THREE.DataTexture);
    expect((result.current.texture as THREE.DataTexture).image.width).toBe(16);
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
describe('inlineTexture2DSize', () => {
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
    {
      id: 'CanvasTexture_gradient',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'SubResource("GradientTexture2D_a")' },
    },
    {
      id: 'AtlasTexture_cell',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("1")', region: 'Rect2(32, 32, 64, 64)' },
    },
    {
      id: 'AtlasTexture_margined',
      type: 'AtlasTexture',
      data: {
        atlas: 'ExtResource("1")',
        region: 'Rect2(96, 0, 32, 32)',
        margin: 'Rect2(8, 6, 16, 20)',
      },
    },
    {
      id: 'AtlasTexture_wholesheet',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("1")' },
    },
  ];

  it("reports an inline GradientTexture2D's declared pixel size", () => {
    expect(inlineTexture2DSize('SubResource("GradientTexture2D_a")', resources)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it('falls back to the 64x64 a GradientTexture2D is constructed with', () => {
    expect(inlineTexture2DSize('SubResource("GradientTexture2D_default")', resources)).toEqual({
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
    expect(inlineTexture2DSize('SubResource("GradientTexture2D_bare")', resources)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it('declines a CanvasTexture wrapping an image, leaving the loader to answer', () => {
    expect(inlineTexture2DSize('SubResource("CanvasTexture_a")', resources)).toBeNull();
  });

  it("reports a CanvasTexture-wrapped gradient's declared size", () => {
    // One `diffuse_texture` level off, then the same declared-size read: the
    // wrapper changes nothing about how big the slot is.
    expect(inlineTexture2DSize('SubResource("CanvasTexture_gradient")', resources)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it("reports an AtlasTexture's REGION size, never the sheet's", () => {
    // `get_width`/`get_height` (`atlas_texture.cpp:33-53`) read the region, so
    // the answer needs no atlas image and is available before any load.
    expect(inlineTexture2DSize('SubResource("AtlasTexture_cell")', resources)).toEqual({
      x: 64,
      y: 64,
    });
  });

  it('adds margin.size to the reported box', () => {
    expect(inlineTexture2DSize('SubResource("AtlasTexture_margined")', resources)).toEqual({
      x: 48,
      y: 52,
    });
  });

  it('declines an AtlasTexture whose region falls back to the atlas size', () => {
    // A zero-size axis reports `atlas->get_width()` (:34-38) — only the loaded
    // sheet knows that, so this answer belongs to the cache lookup instead.
    expect(inlineTexture2DSize('SubResource("AtlasTexture_wholesheet")', resources)).toBeNull();
  });

  it('declines an ExtResource, a res:// path, an unknown id and an absent reference', () => {
    expect(inlineTexture2DSize('ExtResource("1")', resources)).toBeNull();
    expect(inlineTexture2DSize('res://icon.png', resources)).toBeNull();
    expect(inlineTexture2DSize('SubResource("nope")', resources)).toBeNull();
    expect(inlineTexture2DSize(undefined, resources)).toBeNull();
  });
});

/**
 * An inline `AtlasTexture` — a sprite-sheet cell — in a PLAIN Texture2D slot.
 *
 * Godot presents one as a texture of the REGION's size that draws the sheet's
 * sub-rectangle, so the slot must hand its consumer a texture of that size: a
 * consumer reads `image.width`/`image.height` for its own sizing and overwrites
 * `repeat`/`offset` for its own cropping, so a shared sheet handed over with
 * pre-windowed UVs paints the WHOLE sheet at the WHOLE sheet's size.
 */
describe('useTexture2D — inline AtlasTexture', () => {
  const externalResources: TscnExternalResource[] = [
    { id: '1_sheet', type: 'Texture2D', path: 'res://sheet.png' },
  ];
  const resources: TscnInternalResource[] = [
    {
      id: 'AtlasTexture_cell',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("1_sheet")', region: 'Rect2(32, 32, 64, 64)' },
    },
    {
      id: 'AtlasTexture_orphan',
      type: 'AtlasTexture',
      data: { region: 'Rect2(0, 0, 8, 8)' },
    },
    {
      id: 'AtlasTexture_unknownsheet',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("404")', region: 'Rect2(0, 0, 8, 8)' },
    },
  ];

  function sheet(): THREE.Texture {
    const texture = new THREE.Texture();
    (texture as unknown as { image: { width: number; height: number } }).image = {
      width: 128,
      height: 128,
    };
    return texture;
  }

  /**
   * happy-dom has no 2D context, so the crop is recorded through one — faked on
   * the prototype rather than by replacing `createElement`, which every other
   * element in the tree (and the R3F renderer's own canvas) still needs.
   */
  function stubCanvas() {
    const calls: number[][] = [];
    const cut = { canvas: null as HTMLCanvasElement | null };
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage: (_image: unknown, ...args: number[]) => void calls.push(args),
    };
    const proto = globalThis.HTMLCanvasElement.prototype;
    const original = proto.getContext;
    vi.spyOn(proto, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type !== '2d') return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
      cut.canvas = this;
      return ctx as unknown as CanvasRenderingContext2D;
    } as typeof proto.getContext);
    return { calls, cut };
  }

  function withLoader(seeded?: { path: string; texture: THREE.Texture }) {
    const fake = createFakeResourceLoader();
    if (seeded) fake.textures.seed(seeded.path, seeded.texture);
    return function Wrapper({ children }: { children: ReactNode }) {
      return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crops the sheet to the region, at the region size', () => {
    const { calls, cut } = stubCanvas();
    const { result } = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_cell")', externalResources, resources),
      { wrapper: withLoader({ path: 'res://sheet.png', texture: sheet() }) }
    );

    expect(result.current.texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(result.current.texture!.image).toBe(cut.canvas);
    expect([cut.canvas!.width, cut.canvas!.height]).toEqual([64, 64]);
    expect(calls[0]).toEqual([32, 32, 64, 64, 0, 0, 64, 64]);
    expect(result.current.missing).toBe(false);
  });

  it('shares ONE crop between consumers of the same cell', () => {
    stubCanvas();
    const wrapper = withLoader({ path: 'res://sheet.png', texture: sheet() });
    const first = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_cell")', externalResources, resources),
      { wrapper }
    );
    const second = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_cell")', externalResources, resources),
      { wrapper }
    );

    expect(second.result.current.texture).toBe(first.result.current.texture);
  });

  it('shows nothing — not a placeholder — while the sheet is still loading', () => {
    stubCanvas();
    const { result } = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_cell")', externalResources, resources),
      { wrapper: withLoader() }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('reports an unresolvable or absent sheet as missing', () => {
    stubCanvas();
    const wrapper = withLoader();
    const unknown = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_unknownsheet")', externalResources, resources),
      { wrapper }
    );
    const orphan = renderHook(
      () => useTexture2D('SubResource("AtlasTexture_orphan")', externalResources, resources),
      { wrapper }
    );

    expect(unknown.result.current.missing).toBe(true);
    expect(orphan.result.current.missing).toBe(true);
  });
});
