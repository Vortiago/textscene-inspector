/**
 * `useTexture2D`: the texture a Texture2D slot holds. A PointLight2D cookie is a `GradientTexture2D`
 * sub-resource, which a path resolver finds nothing for.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { extResourceAtlasTextureSize, inlineTexture2DSize, useTexture2D } from './useTexture2D';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { parseTresFile, type ParsedResource } from '../parser/parsedResource';
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
    // Godot draws a CanvasTexture's `diffuse_texture`, whatever it is. A path resolver sees only a
    // diffuse that has a path, so an inline one resolves to nothing.
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

  // A CanvasTexture's `diffuse_texture` can be an AtlasTexture. The atlas resolve against the
  // outer ref finds no atlas and hands back the whole sheet, so the unwrap runs first.
  it('crops an AtlasTexture that is reached through a CanvasTexture', () => {
    const sheet = new THREE.Texture();
    sheet.image = { width: 128, height: 128 };
    const externalResources: TscnExternalResource[] = [
      { id: '1', type: 'Texture2D', path: 'res://sheet.png' },
    ];
    const nested: TscnInternalResource[] = [
      {
        id: 'AtlasTexture_cell',
        type: 'AtlasTexture',
        data: { atlas: 'ExtResource("1")', region: 'Rect2(32, 32, 64, 64)' },
      },
      {
        id: 'CanvasTexture_atlas',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("AtlasTexture_cell")' },
      },
    ];

    const { result } = renderHook(
      () => useTexture2D('SubResource("CanvasTexture_atlas")', externalResources, nested),
      { wrapper: withLoader({ path: 'res://sheet.png', texture: sheet }) }
    );

    expect(result.current.missing).toBe(false);
    // The whole sheet coming back unchanged is the failure this pins.
    expect(result.current.texture).not.toBe(sheet);
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
 * The size, asked without React: `r3f/controls/native/buildSolveTree.ts` solves a Control's
 * minimum size outside any component, and must agree with the hook's pixels for the same slot.
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
    // Godot 4.6.3: a TextureRect with a GradientTexture2D and no `gradient` still reserves the
    // declared 160x160 in a VBoxContainer, since `get_width`/`get_height` read the authored
    // members. A size tied to rasterisation would collapse the layout on a resource error.
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

  it("reports the REGION size through a CanvasTexture, not the sheet's", () => {
    // The raw ref sees only the wrapper, so the caller's cache would reserve the whole sheet for a
    // 64x64 cell.
    const wrapped: TscnInternalResource[] = [
      ...resources,
      {
        id: 'CanvasTexture_atlas',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("AtlasTexture_cell")' },
      },
    ];
    expect(inlineTexture2DSize('SubResource("CanvasTexture_atlas")', wrapped)).toEqual({
      x: 64,
      y: 64,
    });
  });

  it('reports the size through a CHAIN of CanvasTexture wrappers', () => {
    // The painter resolves the whole chain, so the size must too: a fixed depth reserves 0x0 for a
    // slot that draws at its declared size, collapsing the node in a BoxContainer.
    const chained: TscnInternalResource[] = [
      ...resources,
      {
        id: 'CanvasTexture_outer',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("CanvasTexture_middle")' },
      },
      {
        id: 'CanvasTexture_middle',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("CanvasTexture_gradient")' },
      },
    ];
    expect(inlineTexture2DSize('SubResource("CanvasTexture_outer")', chained)).toEqual({
      x: 160,
      y: 96,
    });
  });

  it("reports a chained wrapper's REGION size, never the sheet's", () => {
    // The window shows only with every wrapper off: a half-peeled ref still sees a CanvasTexture,
    // and the caller's cache answers the whole sheet.
    const chained: TscnInternalResource[] = [
      ...resources,
      {
        id: 'CanvasTexture_outer',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("CanvasTexture_atlas")' },
      },
      {
        id: 'CanvasTexture_atlas',
        type: 'CanvasTexture',
        data: { diffuse_texture: 'SubResource("AtlasTexture_cell")' },
      },
    ];
    expect(inlineTexture2DSize('SubResource("CanvasTexture_outer")', chained)).toEqual({
      x: 64,
      y: 64,
    });
  });

  it('declines an AtlasTexture whose region falls back to the atlas size', () => {
    // A zero-size axis reports `atlas->get_width()` (:34-38), which only the loaded sheet knows,
    // so the cache lookup answers it.
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
 * An inline `AtlasTexture` cell in a plain Texture2D slot. Godot presents it as a texture of the
 * region's size, so the slot hands over one: a consumer sizes from `image.width`/`image.height`
 * and overwrites `repeat`/`offset`, so a pre-windowed shared sheet paints whole.
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
   * happy-dom has no 2D context, so a fake on the prototype records the crop. Replacing
   * `createElement` would break every other element, the R3F renderer's canvas included.
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

/**
 * The same cell saved as its own `.tres`, as Kenney's input-prompt packs ship every icon. The
 * ExtResource's `type=` routes the fetch to the `resource` bus, since the file is no image.
 */
describe('useTexture2D — .tres AtlasTexture', () => {
  const externalResources: TscnExternalResource[] = [
    { id: '1_atlas', type: 'AtlasTexture', path: 'res://icons/keyboard_arrow_left.tres' },
  ];

  // A Kenney-shaped file through the real `.tres` parser, its region sized to the fake sheet below.
  const atlasTres: ParsedResource = parseTresFile(`[gd_resource type="AtlasTexture" format=3]

[ext_resource type="Texture2D" path="res://sheet.png" id="1_tk63f"]

[resource]
atlas = ExtResource("1_tk63f")
region = Rect2(32, 32, 64, 64)
`);

  function sheet(): THREE.Texture {
    const texture = new THREE.Texture();
    (texture as unknown as { image: { width: number; height: number } }).image = {
      width: 128,
      height: 128,
    };
    return texture;
  }

  /** The inline block's fake: it records the crop the canvas 2D path draws. */
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

  function withLoader() {
    const fake = createFakeResourceLoader();
    return { fake, Wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>;
    } };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crops the sheet to the region, at the region size', () => {
    const { calls, cut } = stubCanvas();
    const { fake, Wrapper } = withLoader();
    fake.resources.seed('res://icons/keyboard_arrow_left.tres', atlasTres);
    fake.textures.seed('res://sheet.png', sheet());

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_atlas")', externalResources, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(result.current.texture!.image).toBe(cut.canvas);
    expect([cut.canvas!.width, cut.canvas!.height]).toEqual([64, 64]);
    expect(calls[0]).toEqual([32, 32, 64, 64, 0, 0, 64, 64]);
    expect(result.current.missing).toBe(false);
  });

  it('shows nothing — not missing — while the .tres itself is still loading', () => {
    stubCanvas();
    // Nothing seeded: the resource-bus request stays pending.
    const { Wrapper } = withLoader();

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_atlas")', externalResources, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('reports a missing .tres file as missing', () => {
    stubCanvas();
    const { fake, Wrapper } = withLoader();
    fake.resources.seed('res://icons/keyboard_arrow_left.tres', null);

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_atlas")', externalResources, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(true);
  });

  it('reports a .tres whose own header names a different resource type as missing', () => {
    stubCanvas();
    const { fake, Wrapper } = withLoader();
    fake.resources.seed('res://icons/keyboard_arrow_left.tres', {
      resourceType: 'StyleBoxFlat',
      properties: {},
      extResources: [],
      subResources: [],
    });

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_atlas")', externalResources, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(true);
  });

  it('leaves an ExtResource declared some OTHER type to the ordinary image pipeline', () => {
    // The outer reference never reads as an atlas .tres, so it fails as any unloadable Texture2D
    // path does.
    stubCanvas();
    const { Wrapper } = withLoader();
    const otherType: TscnExternalResource[] = [
      { id: '1_box', type: 'StyleBoxFlat', path: 'res://box.tres' },
    ];

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_box")', otherType, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeNull();
  });

  it('reports a .tres AtlasTexture that names no atlas as missing, not a crash', () => {
    stubCanvas();
    const { fake, Wrapper } = withLoader();
    fake.resources.seed(
      'res://icons/keyboard_arrow_left.tres',
      parseTresFile(`[gd_resource type="AtlasTexture" format=3]

[resource]
region = Rect2(0, 0, 8, 8)
`)
    );

    const { result } = renderHook(
      () => useTexture2D('ExtResource("1_atlas")', externalResources, []),
      { wrapper: Wrapper }
    );

    expect(result.current.texture).toBeNull();
    expect(result.current.missing).toBe(true);
  });
});

describe('extResourceAtlasTextureSize', () => {
  it("reports an ExtResource .tres AtlasTexture's region size", () => {
    const tres: ParsedResource = {
      resourceType: 'AtlasTexture',
      properties: { atlas: 'ExtResource("1")', region: 'Rect2(0, 0, 48, 24)' },
      extResources: [],
      subResources: [],
    };
    expect(extResourceAtlasTextureSize(tres, null)).toEqual({ x: 48, y: 24 });
  });

  it('falls back to the sheet size on a zero-size region axis', () => {
    const tres: ParsedResource = {
      resourceType: 'AtlasTexture',
      properties: {},
      extResources: [],
      subResources: [],
    };
    expect(extResourceAtlasTextureSize(tres, { width: 200, height: 100 })).toEqual({
      x: 200,
      y: 100,
    });
  });

  it('declines without the sheet size on a zero-size region axis', () => {
    const tres: ParsedResource = {
      resourceType: 'AtlasTexture',
      properties: {},
      extResources: [],
      subResources: [],
    };
    expect(extResourceAtlasTextureSize(tres, null)).toBeNull();
  });

  it('declines a .tres whose own header names a different resource type', () => {
    const tres: ParsedResource = {
      resourceType: 'GradientTexture2D',
      properties: { width: '64', height: '64' },
      extResources: [],
      subResources: [],
    };
    expect(extResourceAtlasTextureSize(tres, null)).toBeNull();
  });
});
