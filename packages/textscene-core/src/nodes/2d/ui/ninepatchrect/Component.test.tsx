/**
 * `<NinePatchRect>` render contract. `texturerect/Component.test.tsx` is the
 * shape this follows for texture resolution/scope/filter; the geometry MATH
 * itself is `ninePatchGeometry.test.ts`'s job — these tests only check that
 * the painter wires the right numbers into it and mounts a mesh correctly.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { parseNinePatchRect } from './parser';
import { NinePatchRect } from './Component';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const TEX = 'res://panel.png';
const heading = { type: 'node', attributes: { type: 'NinePatchRect', name: 'Panel' } };

function ninePatchNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Panel',
    type: 'NinePatchRect',
    children: [],
    properties: parseNinePatchRect(heading, { texture: 'ExtResource("1")', ...raw }),
  };
}

const SCOPE = {
  externalResources: [{ id: '1', type: 'Texture2D', path: TEX }],
  internalResources: [],
};

function solveNode(node: TscnNode): SolveNode {
  return { ...emptySolveNode(), path: node.name, node, resources: SCOPE };
}

/** A 20x20 texture, easy to hand-check margin math against. */
function fakeTexture(): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 20, height: 20 };
  return tex;
}

interface RenderOptions {
  tint?: NativeControlComponentProps['tint'];
}

async function renderIsolated(raw: Record<string, string> = {}, rect: Rect2, options: RenderOptions = {}) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEX, fakeTexture());
  const node = ninePatchNode(raw);

  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
        <NinePatchRect
          {...painterEnv()}
          {...(options.tint ? { tint: options.tint } : {})}
          solveNode={solveNode(node)}
          rect={rect}
          renderOrder={0}
        />
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return ReactThreeTestRenderer.create(tree);
}

describe('<NinePatchRect> resolves its texture in its OWN scene scope', () => {
  it('draws a texture the ambient provider does not carry', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(TEX, fakeTexture());
    const node = ninePatchNode();
    const own = { ...solveNode(node), resources: SCOPE };

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[]}>
          <NinePatchRect {...painterEnv()} solveNode={own} rect={{ x: 0, y: 0, w: 40, h: 30 }} renderOrder={0} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});

describe('<NinePatchRect> (isolated painter contract)', () => {
  it('draws nothing when no texture is referenced', async () => {
    const renderer = await renderIsolated({ texture: '' }, { x: 0, y: 0, w: 40, h: 30 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('emits 9 quads (36 vertices) for symmetric margins on both axes', async () => {
    const renderer = await renderIsolated(
      { patch_margin_left: '4', patch_margin_top: '4', patch_margin_right: '4', patch_margin_bottom: '4' },
      { x: 0, y: 0, w: 40, h: 30 }
    );
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(36);
    expect(geometry.getIndex()!.count).toBe(9 * 6);
  });

  it('draw_center = false drops the middle cell down to 8 quads', async () => {
    const renderer = await renderIsolated(
      {
        patch_margin_left: '4',
        patch_margin_top: '4',
        patch_margin_right: '4',
        patch_margin_bottom: '4',
        draw_center: 'false',
      },
      { x: 0, y: 0, w: 40, h: 30 }
    );
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(32);
  });

  it('no margins: a single quad, full UV', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 40, h: 30 });
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(4);
    const uv = geometry.getAttribute('uv');
    expect(Array.from(uv.array)).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('maps texture_filter NEAREST (1) to THREE.NearestFilter', async () => {
    const renderer = await renderIsolated({ texture_filter: '1' }, { x: 0, y: 0, w: 40, h: 30 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.magFilter).toBe(THREE.NearestFilter);
    expect(material.map!.minFilter).toBe(THREE.NearestFilter);
  });

  it('an absent texture_filter (PARENT_NODE) resolves to LinearFilter, the CanvasItem root default', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 40, h: 30 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.magFilter).toBe(THREE.LinearFilter);
  });

  it('every UV stays clamped, never repeat-wrapped', async () => {
    const renderer = await renderIsolated({ axis_stretch_horizontal: '1' }, { x: 0, y: 0, w: 40, h: 30 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(material.map!.wrapT).toBe(THREE.ClampToEdgeWrapping);
  });

  it(
    'draws the walker-composed tint AS-IS — NinePatchRect has no base colour of its own to fold in',
    async () => {
      const renderer = await renderIsolated(
        {},
        { x: 0, y: 0, w: 10, h: 10 },
        { tint: painterTint({ r: 0.5, g: 0.25, b: 0.5, a: 0.5 }) }
      );
      const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
      const expected = new THREE.Color().setRGB(0.5, 0.25, 0.5, THREE.SRGBColorSpace);
      expect(material.color.r).toBeCloseTo(expected.r);
      expect(material.color.g).toBeCloseTo(expected.g);
      expect(material.color.b).toBeCloseTo(expected.b);
      expect(material.opacity).toBeCloseTo(0.5);
    }
  );

  it('is transparent, double-sided and does not write depth (2D canvas-item convention)', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 40, h: 30 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
  });
});
