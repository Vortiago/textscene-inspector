/**
 * `<TextureRect>` render contract. `nodes/2d/marker2d/Component.test.tsx`
 * is the canonical `@react-three/test-renderer` shape this follows; the
 * texture-loading rig mirrors `sprite2d/Component.parity.test.tsx`
 * (`createFakeResourceLoader` + `ResourceLoaderProvider` +
 * `SceneResourcesProvider`, since `useResource` needs a live provider to ever
 * leave `pending`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { parseTextureRect } from './parser';
import { TextureRect } from './Component';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const TEX = 'res://portrait.png';
const heading = { type: 'node', attributes: { type: 'TextureRect', name: 'Portrait' } };

function textureRectNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Portrait',
    type: 'TextureRect',
    children: [],
    properties: parseTextureRect(heading, { texture: 'ExtResource("1")', ...raw }),
  };
}

function solveNode(node: TscnNode): SolveNode {
  return { ...emptySolveNode(), path: node.name, node };
}

/** A 320x160 texture — the same non-square size `nativeSolver.test.ts` uses. */
function fakeTexture(): THREE.Texture {
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 320, height: 160 };
  return tex;
}

interface RenderOptions {
  modulateContext?: { r: number; g: number; b: number; a: number };
}

async function renderIsolated(raw: Record<string, string> = {}, rect: Rect2, options: RenderOptions = {}) {
  const fake = createFakeResourceLoader();
  fake.textures.seed(TEX, fakeTexture());
  const node = textureRectNode(raw);

  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
        {options.modulateContext ? (
          <Modulate2DContext.Provider value={options.modulateContext}>
            <TextureRect {...painterEnv()} solveNode={solveNode(node)} rect={rect} renderOrder={0} />
          </Modulate2DContext.Provider>
        ) : (
          <TextureRect {...painterEnv()} solveNode={solveNode(node)} rect={rect} renderOrder={0} />
        )}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  return ReactThreeTestRenderer.create(tree);
}

describe('<TextureRect> (isolated painter contract)', () => {
  it('draws nothing when no texture is referenced', async () => {
    const renderer = await renderIsolated({ texture: '' }, { x: 0, y: 0, w: 64, h: 32 });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('maps the loaded texture onto exactly one quad, cloned rather than the shared cached instance', async () => {
    const fake = createFakeResourceLoader();
    const cached = fakeTexture();
    fake.textures.seed(TEX, cached);
    const node = textureRectNode();

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
          <TextureRect
            {...painterEnv()}
            solveNode={solveNode(node)}
            rect={{ x: 0, y: 0, w: 300, h: 100 }}
            renderOrder={0}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const material = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map).not.toBeNull();
    // Cloned, not the same cached instance `useResource` handed out — mutating
    // filter/wrap/repeat/offset per-consumer must never bleed into siblings
    // sharing the SAME cached texture (the reason `composeFrameTexture` clones).
    expect(material.map).not.toBe(cached);
  });

  it('STRETCH_SCALE (default): the quad fills the FULL control rect', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 300, h: 100 });
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(300);
    expect(geometry.parameters.height).toBe(100);
  });

  it("STRETCH_KEEP (2): the quad is the texture's OWN intrinsic size, top-left", async () => {
    const renderer = await renderIsolated({ stretch_mode: '2' }, { x: 0, y: 0, w: 300, h: 100 });
    const mesh = renderer.scene.findByType('Mesh');
    const geometry = (mesh.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(320);
    expect(geometry.parameters.height).toBe(160);
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(0);
    expect(group.instance.position.y).toBeCloseTo(0);
  });

  it('STRETCH_KEEP_CENTERED (3): the drawn-image offset positions an outer group (can go negative)', async () => {
    const renderer = await renderIsolated({ stretch_mode: '3' }, { x: 0, y: 0, w: 300, h: 100 });
    // offset = ((300,100)-(320,160))/2 = (-10,-30); three's Y negates once.
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(-10);
    expect(group.instance.position.y).toBeCloseTo(30);
  });

  it('maps texture_filter NEAREST (1) to THREE.NearestFilter', async () => {
    const renderer = await renderIsolated({ texture_filter: '1' }, { x: 0, y: 0, w: 64, h: 32 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.magFilter).toBe(THREE.NearestFilter);
    expect(material.map!.minFilter).toBe(THREE.NearestFilter);
  });

  it('an absent texture_filter (PARENT_NODE) resolves to LinearFilter, the CanvasItem root default', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 64, h: 32 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.magFilter).toBe(THREE.LinearFilter);
  });

  it('maps texture_repeat ENABLED (2) to THREE.RepeatWrapping', async () => {
    const renderer = await renderIsolated({ texture_repeat: '2' }, { x: 0, y: 0, w: 64, h: 32 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
  });

  it('an absent texture_repeat (PARENT_NODE) resolves to ClampToEdgeWrapping, the CanvasItem root default', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 64, h: 32 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.wrapS).toBe(THREE.ClampToEdgeWrapping);
  });

  it('flip_h mirrors the UV in place (negative repeat.x, offset shifted to compensate)', async () => {
    const renderer = await renderIsolated({ flip_h: 'true' }, { x: 0, y: 0, w: 300, h: 100 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map!.repeat.x).toBeCloseTo(-1);
    expect(material.map!.offset.x).toBeCloseTo(1);
  });

  it('STRETCH_TILE (1) composed with flip_h: repeat magnitude equals the tile count, mirrored', async () => {
    const renderer = await renderIsolated(
      { stretch_mode: '1', flip_h: 'true' },
      { x: 0, y: 0, w: 300, h: 100 }
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    // tile repeat = 300/320 = 0.9375, mirrored: repeat -0.9375, offset 0.9375.
    expect(material.map!.repeat.x).toBeCloseTo(-0.9375);
    expect(material.map!.offset.x).toBeCloseTo(0.9375);
    expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
  });

  it(
    'self_modulate multiplies onto own pixels; the walker-provided context (ancestor × own modulate) ' +
      'is used AS-IS and never re-multiplied by this node\'s own modulate (double-application guard)',
    async () => {
      // If this painter re-ran `modulate` itself, using a modulate-authoring
      // node here would square the ambient value; it authors NONE, so the
      // guard is really that supplying an ambient context alone (no modulate
      // on this node) still lands on a SINGLE application of self_modulate.
      const renderer = await renderIsolated(
        { self_modulate: 'Color(1, 0.5, 1, 1)' },
        { x: 0, y: 0, w: 10, h: 10 },
        { modulateContext: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } }
      );
      const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
      // own(sRGB) = inherited(0.5,0.5,0.5,0.5) * self_modulate(1,0.5,1,1) * (no own colour) = (0.5,0.25,0.5,0.5)
      const expected = new THREE.Color().setRGB(0.5, 0.25, 0.5, THREE.SRGBColorSpace);
      expect(material.color.r).toBeCloseTo(expected.r);
      expect(material.color.g).toBeCloseTo(expected.g);
      expect(material.color.b).toBeCloseTo(expected.b);
      expect(material.opacity).toBeCloseTo(0.5);
    }
  );

  it('is transparent, double-sided and does not write depth (2D canvas-item convention)', async () => {
    const renderer = await renderIsolated({}, { x: 0, y: 0, w: 64, h: 32 });
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
  });
});

describe('<TextureRect> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('draws its quad through the real registry entry, at the walker-solved rect', async () => {
    controlComponentRegistry.register({ typeName: 'TextureRect', Component: TextureRect });
    controlSolverRegistry.clear();
    const fake = createFakeResourceLoader();
    fake.textures.seed(TEX, fakeTexture());

    const nodeWithRect: TscnNode = {
      ...textureRectNode(),
      properties: {
        ...textureRectNode().properties,
        anchorLeft: 0,
        anchorTop: 0,
        anchorRight: 0,
        anchorBottom: 0,
        offsetLeft: 0,
        offsetTop: 0,
        offsetRight: 300,
        offsetBottom: 100,
      },
    };
    const root = solveNode(nodeWithRect);

    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}>
          <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(300);
    expect(geometry.parameters.height).toBe(100);

    controlComponentRegistry.clear();
  });
});
