/**
 * Sprite3D component tests.
 *
 * 12 assertions covering texture loading, billboard persistence, quad
 * sizing, modulate, transparency, alpha_cut, spritesheet UV (the
 * load-bearing new logic), region cropping, render priority, and
 * transform application.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Sprite3D } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type {
  TscnExternalResource,
  TscnInternalResource,
  TscnNode,
} from '../../../parser/types';
import type { Sprite3DProperties } from './types';
import {
  AlphaCutMode,
  AxisMode,
  BillboardMode,
} from './types';

const TEXTURE_PATH = 'res://textures/sprite.png';

/** Build a THREE.Texture with explicit image dimensions for sizing/region tests. */
function makeTexture(imageWidth = 256, imageHeight = 256): THREE.Texture {
  const t = new THREE.Texture();
  // The test renderer needs only width/height to drive quad sizing.
  // No actual GPU upload happens — `needsUpdate` stays false.
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
    alpha_cut: AlphaCutMode.ALPHA_CUT_DISABLED,
    axis: AxisMode.AXIS_Y,
    pixel_size: 0.01,
    transparency: 0,
    hframes: 1,
    vframes: 1,
    frame: 0,
    offset: { x: 0, y: 0 },
    centered: true,
    flip_h: false,
    flip_v: false,
    double_sided: true,
    transparent: true,
    region_enabled: false,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    render_priority: 0,
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
  internals?: TscnInternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
}) {
  const fake = createFakeResourceLoader();
  for (const { path, texture } of opts.cached ?? []) {
    fake.textures.seed(path, texture === 'missing' ? null : texture);
  }
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        externalResources={opts.externals ?? []}
        internalResources={opts.internals ?? []}
      >
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
    const mesh = renderer.scene.findByType('Mesh');
    const mat = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
      const mat = (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
    const mesh = renderer.scene.findByType('Mesh');
    const userData = mesh.instance.userData as { billboardMode: number; billboardAxis: number };
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
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as unknown as {
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
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    // Godot modulate is sRGB → converted to the linear working space: 1→1, 0→0,
    // 0.5→~0.214 (IEC 61966-2-1 inverse transfer).
    expect(mat.color.r).toBeCloseTo(1, 3);
    expect(mat.color.g).toBeCloseTo(0.2140411, 3);
    expect(mat.color.b).toBeCloseTo(0, 3);
  });

  it('combines modulate.a and transparency into opacity (transparent=true when opacity<1)', async () => {
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
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
    const mesh = renderer.scene.findByType('Mesh');
    const mat = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.map?.repeat.x).toBeCloseTo(0.5, 5);
    expect(mat.map?.repeat.y).toBeCloseTo(0.5, 5);
    // Y-flip: offset.y = 1 - (25 + 50) / 100 = 0.25
    expect(mat.map?.offset.x).toBeCloseTo(0.25, 5);
    expect(mat.map?.offset.y).toBeCloseTo(0.25, 5);
    // Quad sized to the sub-region.
    const geom = (mesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
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
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
        frame: 0, // ignored
        frame_coords: { x: 2, y: 0 },
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
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
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.alphaTest).toBeGreaterThan(0);
    expect(mat.depthWrite).toBe(true);
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
});

describe('<Sprite3D> texture sources through the shared seam', () => {
  it('renders a procedural SubResource texture instead of the placeholder', async () => {
    // A GradientTexture2D (and NoiseTexture2D, same machinery) is described
    // entirely by the scene, so no file exists to load; the sprite must ride
    // the shared procedural rasteriser exactly as Sprite2D does.
    const internals: TscnInternalResource[] = [
      {
        id: 'Gradient_g',
        type: 'Gradient',
        data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' },
      },
      {
        id: 'GradientTexture2D_t',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Gradient_g")', width: '8', height: '4' },
      },
    ];
    const renderer = await render({
      node: makeNode({ texture: 'SubResource("GradientTexture2D_t")' }),
      internals,
    });
    const mesh = renderer.scene.findByType('Mesh');
    const mat = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect((mat.map as Partial<THREE.DataTexture> | null)?.isDataTexture).toBe(true);
  });

  it('windows an AtlasTexture reference to its cell', async () => {
    // The atlas cell arrives as the source's region; the quad takes the cell
    // size and the map is windowed to it. Before the seam, Sprite3D resolved
    // the path only and drew the whole sheet.
    const tex = makeTexture(100, 50);
    const internals: TscnInternalResource[] = [
      {
        id: 'AtlasTexture_a',
        type: 'AtlasTexture',
        data: { atlas: 'ExtResource("1_tex")', region: 'Rect2(10, 5, 40, 20)' },
      },
    ];
    const renderer = await render({
      node: makeNode({ texture: 'SubResource("AtlasTexture_a")', pixel_size: 1 }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      internals,
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBeCloseTo(40, 5);
    expect(geom.parameters.height).toBeCloseTo(20, 5);
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.x).toBeCloseTo(0.4, 5);
  });

  it('draws a whole-image, unflipped sprite with the shared texture itself, not a clone', async () => {
    // Cloning marks needsUpdate on the shared Source, which forces a GPU
    // re-upload of pixels the cache already paid for; with nothing to window
    // the borrowed texture is drawn directly.
    const tex = makeTexture(64, 64);
    const renderer = await render({
      node: makeNode({ texture: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: tex }],
    });
    const mesh = renderer.scene.findByType('Mesh');
    const mat = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.map).toBe(tex);
  });
});
