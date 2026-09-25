/**
 * Sprite3D component tests: texture loading, billboard persistence, quad sizing, modulate,
 * transparency, the alpha_cut arms, the derived wrap mode, sprite-sheet UV, region cropping, render
 * priority and transform application.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type {
  TscnExternalResource,
  TscnNode,
} from '../../../parser/types';
import type { Sprite3DProperties } from './types';
import {
  AlphaCutMode,
  AxisMode,
  BillboardMode,
  AlphaAntiAliasing,
  TextureFilterMode,
} from './types';
import { findMesh, instanceAs } from '../testing/reactThreeTestInstance';

const TEXTURE_PATH = 'res://textures/sprite.png';

/** Build a THREE.Texture with explicit image dimensions for sizing/region tests. */
function makeTexture(imageWidth = 256, imageHeight = 256): THREE.Texture {
  const t = new THREE.Texture();
  // The test renderer needs only width and height to drive quad sizing. No GPU upload happens, so
  // `needsUpdate` stays false.
  (t as unknown as { image: { width: number; height: number } }).image = {
    width: imageWidth,
    height: imageHeight,
  };
  return t;
}

function makeNode(overrides: Partial<Sprite3DProperties> = {}): TscnNode {
  const props: Sprite3DProperties = {
    name: overrides.name ?? 'Sprite',
    billboard: BillboardMode.BILLBOARD_DISABLED,
    shaded: false,
    no_depth_test: false,
    fixed_size: false,
    alpha_scissor_threshold: 0.5,
    alpha_hash_scale: 1.0,
    alpha_antialiasing_mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF,
    alpha_antialiasing_edge: 0.0,
    texture_filter: TextureFilterMode.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS,
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
    double_sided: true,
    transparent: true,
    ...overrides,
  };
  return { name: props.name ?? 'Sprite', type: 'Sprite3D', children: [], properties: props };
}

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

async function render(opts: {
  node: TscnNode;
  externals?: TscnExternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
}) {
  const fake = createFakeResourceLoader();
  for (const { path, texture } of opts.cached ?? []) {
    fake.textures.seed(path, texture === 'missing' ? null : texture);
  }
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={opts.externals ?? []}>
        <Sprite3D node={opts.node} />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('<Sprite3D> (WI-R3F-13)', () => {
  it('renders a textured mesh when the texture loads', async () => {
    const tex = makeTexture(64, 64);
    const renderer = await render({
      node: makeNode({ texture: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = findMesh(renderer.scene);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.map).toBeInstanceOf(THREE.Texture);
  });

  it('renders a magenta placeholder when the texture is missing', async () => {
    const renderer = await render({
      node: makeNode({ name: 'Missing', texture: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: 'missing' }],
    });
    const group = renderer.scene.findByProps({ name: 'Missing' });
    // Placeholder uses a magenta meshBasicMaterial; search for it.
    const meshes = renderer.scene.findAllByType('Mesh');
    const placeholder = meshes.find((m) => {
      const mat = instanceAs<THREE.Mesh>(m).material as THREE.MeshBasicMaterial;
      return mat.color.r === 1 && mat.color.g === 0 && mat.color.b === 1;
    });
    expect(group).toBeDefined();
    expect(placeholder).toBeDefined();
  });

  it('persists billboard mode + axis onto mesh.userData for runtime billboarding', async () => {
    const tex = makeTexture(32, 32);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        billboard: BillboardMode.BILLBOARD_FIXED_Y,
        axis: AxisMode.AXIS_Z,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = findMesh(renderer.scene);
    const userData = mesh.userData as { billboardMode: number; billboardAxis: number };
    expect(userData.billboardMode).toBe(BillboardMode.BILLBOARD_FIXED_Y);
    expect(userData.billboardAxis).toBe(AxisMode.AXIS_Z);
  });

  it('scales the quad by pixel_size × image dimensions', async () => {
    const tex = makeTexture(200, 100);
    const renderer = await render({
      node: makeNode({ texture: 'ExtResource("1_tex")', pixel_size: 0.01 }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const geom = findMesh(renderer.scene).geometry as unknown as {
      parameters: { width: number; height: number };
    };
    // 200 px × 0.01 = 2 world units wide; 100 px × 0.01 = 1 world unit tall.
    expect(geom.parameters.width).toBeCloseTo(2, 5);
    expect(geom.parameters.height).toBeCloseTo(1, 5);
  });

  it('applies modulate color to material.color', async () => {
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        modulate: { r: 1, g: 0.5, b: 0, a: 1 },
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    // Godot modulate is sRGB → converted to the linear working space: 1→1, 0→0,
    // 0.5→~0.214 (IEC 61966-2-1 inverse transfer).
    expect(mat.color.r).toBeCloseTo(1, 3);
    expect(mat.color.g).toBeCloseTo(0.2140411, 3);
    expect(mat.color.b).toBeCloseTo(0, 3);
  });

  it('combines modulate.a and transparency into opacity', async () => {
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        modulate: { r: 1, g: 1, b: 1, a: 0.8 },
        transparency: 0.5,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    // opacity = clamp01(0.8 * (1 - 0.5)) = 0.4
    expect(mat.opacity).toBeCloseTo(0.4, 5);
    expect(mat.transparent).toBe(true);
  });

  it('applies region_rect as a texture sub-rectangle when region_enabled', async () => {
    const tex = makeTexture(100, 100);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        region_enabled: true,
        region_rect: { x: 25, y: 25, width: 50, height: 50 },
        pixel_size: 0.01,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = findMesh(renderer.scene);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.map?.repeat.x).toBeCloseTo(0.5, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(0.5, 5);
    // Y-flip: offset.y = 1 - (25 + 50) / 100 = 0.25
    expect(mat.map?.offset.x).toBeCloseTo(0.25, 5);
    expect(mat.map?.offset.y).toBeCloseTo(0.25, 5);
    const geom = mesh.geometry as unknown as { parameters: { width: number; height: number } };
    expect(geom.parameters.width).toBeCloseTo(0.5, 5);
    expect(geom.parameters.height).toBeCloseTo(0.5, 5);
  });

  it('applies spritesheet UV: frame=0, hframes=4, vframes=2 → top-left tile', async () => {
    const tex = makeTexture(400, 200);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        hframes: 4,
        vframes: 2,
        frame: 0,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    // repeat = (1/4, 1/2); offset for top-left = (0, 1 - 1/2) = (0, 0.5)
    expect(mat.map?.repeat.x).toBeCloseTo(0.25, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(0.5, 5);
    expect(mat.map?.offset.x).toBeCloseTo(0, 5);
    expect(mat.map?.offset.y).toBeCloseTo(0.5, 5);
  });

  it('applies spritesheet UV: frame=5, hframes=4, vframes=2 → second row, second column', async () => {
    const tex = makeTexture(400, 200);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        hframes: 4,
        vframes: 2,
        frame: 5,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    // frame=5 → col = 5%4 = 1, row = floor(5/4) = 1
    // offset = (1/4, 1 - (1+1)/2) = (0.25, 0)
    expect(mat.map?.offset.x).toBeCloseTo(0.25, 5);
    expect(mat.map?.offset.y).toBeCloseTo(0, 5);
  });

  it('frame_coords overrides the linear frame index', async () => {
    const tex = makeTexture(300, 100);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        hframes: 3,
        vframes: 1,
        frame: 0,
        frame_coords: { x: 2, y: 0 },
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    // col=2, row=0 → offset = (2/3, 1 - 1/1) = (0.6667, 0)
    expect(mat.map?.offset.x).toBeCloseTo(2 / 3, 5);
    expect(mat.map?.offset.y).toBeCloseTo(0, 5);
  });

  it('alpha_cut=DISCARD configures alphaTest threshold + depthWrite', async () => {
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_DISCARD,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.alphaTest).toBeGreaterThan(0);
    expect(mat.depthWrite).toBe(true);
  });

  it('alpha_cut=DISCARD cuts at the authored alpha_scissor_threshold', async () => {
    // `sprite_3d.cpp:281` feeds the node's own `alpha_scissor_threshold` to the
    // material; the scissor compares against it (`scene_forward_clustered.glsl:1391`).
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_DISCARD,
        alpha_scissor_threshold: 0.25,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.alphaTest).toBe(0.25);
  });

  it('alpha_cut=DISABLED blends at full modulate alpha', async () => {
    // `sprite_3d.cpp:293` → TRANSPARENCY_ALPHA, which writes ALPHA in the generated shader
    // (`material.cpp:1836`) and so raises `uses_alpha` (`scene_shader_forward_clustered.cpp:123`).
    // That flag alone picks the alpha list (`scene_shader_forward_clustered.h:279-287`,
    // `render_forward_clustered.cpp:4079-4090`), and no colour is read.
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({ texture: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBe(1);
    expect(mat.transparent).toBe(true);
    // `depth_draw_opaque` on a blended surface writes no depth (`material.cpp:800`).
    expect(mat.depthWrite).toBe(false);
  });

  it('alpha_cut=DISCARD paints opaque', async () => {
    // `sprite_3d.cpp:287` → TRANSPARENCY_ALPHA_SCISSOR, whose fragment tail
    // forces `alpha = 1.0` (`scene_forward_clustered.glsl:1414-1416`), so the
    // surface lands in the opaque list rather than the blended one.
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_DISCARD,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(false);
    expect(mat.alphaHash).toBe(false);
  });

  it('alpha_cut=OPAQUE_PREPASS keeps blending and still writes depth', async () => {
    // `sprite_3d.cpp:289` → TRANSPARENCY_ALPHA_DEPTH_PRE_PASS: the colour pass still blends, and
    // the depth pass cuts at the scene's `opaque_prepass_threshold`
    // (`render_forward_clustered.cpp:1791`), never the node's own `alpha_scissor_threshold`.
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS,
        alpha_scissor_threshold: 0.25,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(true);
    expect(mat.alphaHash).toBe(false);
    expect(mat.alphaTest).not.toBe(0.25);
  });

  it('alpha_cut=HASH hashes rather than blends', async () => {
    // `sprite_3d.cpp:291-292` → TRANSPARENCY_ALPHA_HASH, whose fragment tail forces `alpha = 1.0`
    // (`scene_forward_clustered.glsl:1414-1416`): a dithered discard into the opaque pass, never a
    // blend.
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_HASH,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.alphaHash).toBe(true);
    expect(mat.alphaTest).toBe(0);
    expect(mat.depthWrite).toBe(true);
    expect(mat.transparent).toBe(false);
  });

  it('transparent=false disables hashing, as it disables the whole alpha-cut switch', async () => {
    // `sprite_3d.cpp:286` gates every `mat_transparency` arm on FLAG_TRANSPARENT.
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        alpha_cut: AlphaCutMode.ALPHA_CUT_HASH,
        transparent: false,
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.alphaHash).toBe(false);
  });

  it('clamps the sampler for a frame window inside [0, 1]', async () => {
    // `sprite_3d.cpp:163` derives `texture_repeat` from the frame's UV corners,
    // so the ordinary sprite is CLAMP and repeating it would smear a half-texel
    // of the opposite edge across all four borders under linear filtering.
    const tex = makeTexture(64, 64);
    const renderer = await render({
      node: makeNode({ texture: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.map?.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(mat.map?.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it('repeats the sampler only where the frame window overruns the texture', async () => {
    const tex = makeTexture(64, 64);
    const renderer = await render({
      node: makeNode({
        texture: 'ExtResource("1_tex")',
        region_enabled: true,
        region_rect: { x: 0, y: 0, width: 192, height: 128 },
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = findMesh(renderer.scene).material as THREE.MeshBasicMaterial;
    expect(mat.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(mat.map?.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('render_priority maps to mesh.renderOrder + transform origin propagates to mesh.position', async () => {
    const tex = makeTexture(8, 8);
    const renderer = await render({
      node: makeNode({
        name: 'Positioned',
        texture: 'ExtResource("1_tex")',
        render_priority: 7,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 3, y: 0, z: -1 },
        },
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = renderer.scene.findByProps({ name: 'Positioned' });
    expect(mesh.instance.renderOrder).toBe(7);
    expect(mesh.instance.position.x).toBe(3);
    expect(mesh.instance.position.z).toBe(-1);
  });

  // The region/frame path CLONES the loaded texture so it can carry its own
  // offset/repeat, and that clone belongs to this component. The source does
  // not: it is the loader's cached entry, shared with every other node
  // sampling the same file, so disposing it would blank them all.
  describe('texture ownership on unmount', () => {
    it('disposes the clone it made, and leaves the shared source alone', async () => {
      const tex = makeTexture(64, 64);
      const sourceDispose = vi.spyOn(tex, 'dispose');
      const renderer = await render({
        node: makeNode({ texture: 'ExtResource("1_tex")', hframes: 2, vframes: 2, frame: 1 }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        cached: [{ path: TEXTURE_PATH, texture: tex }],
      });
      const clone = (findMesh(renderer.scene).material as THREE.MeshBasicMaterial).map!;
      expect(clone).not.toBe(tex);
      const cloneDispose = vi.spyOn(clone, 'dispose');

      await renderer.unmount();

      expect(cloneDispose).toHaveBeenCalled();
      expect(sourceDispose).not.toHaveBeenCalled();
    });

    it('never disposes the shared source, region or no region', async () => {
      const tex = makeTexture(64, 64);
      const sourceDispose = vi.spyOn(tex, 'dispose');
      const renderer = await render({
        node: makeNode({ texture: 'ExtResource("1_tex")' }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        cached: [{ path: TEXTURE_PATH, texture: tex }],
      });

      await renderer.unmount();

      expect(sourceDispose).not.toHaveBeenCalled();
    });
  });
});
