/**
 * <Decal> component tests: the decal object it puts into the scene, the texture it holds in the
 * decal atlas, the projector box gizmo (drawn for every node, faint while unselected,
 * `decal_gizmo_plugin.cpp:128`) and the Node3D pass-through. The mix itself runs in the shader, which
 * `scripts/decal-gpu` draws.
 */

import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Decal } from './Component';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { InsideLockedInstance, lineOpacities } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import {
  AnimatedValueProvider,
  useAnimatedValueRegistry,
  type AnimatedValueRegistry,
} from '../../../r3f/contexts/AnimatedValueContext';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';
import { parseDecal } from './parser';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { reportsMaxTextureSize } from '../../../r3f/testing/reportsMaxTextureSize';
import { decalAtlasRect, decalAtlasTexture, updateDecalAtlas } from './decalAtlas';
import { TreeOrderProvider } from '../../../r3f/contexts/TreeOrderContext';
import { isDecal, type DecalObject } from '../../../r3f/decal/decalObject';

const TEXTURE_PATH = 'res://textures/decal.png';
const NODE_NAME = 'MyDecal';

/** The context a decal's atlas fits: the GPU limit the test canvas reports. */
const GPU_TEXTURE_SIZE = 4096;

function create(tree: ReactNode) {
  return ReactThreeTestRenderer.create(tree, { beforeReturn: reportsMaxTextureSize(GPU_TEXTURE_SIZE) });
}

function makeTexture(width = 64, height = 64): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width, height };
  return t;
}

function wrapper(id: string, type: string, data: Record<string, string>): TscnInternalResource {
  return { id, type, data };
}

function makeNode(props: Record<string, string> = {}, name = NODE_NAME): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'Decal',
    children: [],
    properties: parseDecal({ type: 'node', attributes: { type: 'Decal', name } }, props),
  };
}

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

interface RenderOptions {
  node: TscnNode;
  externals?: TscnExternalResource[];
  internals?: TscnInternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
  children?: ReactNode;
  selectedPath?: string;
  /** The Gizmos toggle. On unless a test turns it off. */
  showGizmos?: boolean;
  /** Places the decal inside an instance the edited scene does not list as editable. */
  instantiated?: boolean;
}

/** The mounted tree, separated from `create` so a test can re-render it. */
function decalTree(opts: RenderOptions, loader: ReturnType<typeof createFakeResourceLoader>['loader']) {
  const decal = <Decal node={opts.node}>{opts.children}</Decal>;
  return (
    <SceneStack
      loader={loader}
      scene={{ externalResources: opts.externals ?? [], internalResources: opts.internals ?? [] }}
      selectedPath={opts.selectedPath}
      showGizmos={opts.showGizmos ?? true}
    >
      <NodePathProvider path={opts.node.name}>
        {opts.instantiated ? <InsideLockedInstance>{decal}</InsideLockedInstance> : decal}
      </NodePathProvider>
    </SceneStack>
  );
}

function seededLoader(cached: RenderOptions['cached']) {
  const fake = createFakeResourceLoader();
  for (const { path, texture } of cached ?? []) {
    fake.textures.seed(path, texture === 'missing' ? null : texture);
  }
  return fake.loader;
}

async function render(opts: RenderOptions) {
  return create(decalTree(opts, seededLoader(opts.cached)));
}

/** The decal objects in the mounted scene. */
function decalObjects(renderer: { scene: { instance: THREE.Object3D } }): DecalObject[] {
  const found: DecalObject[] = [];
  renderer.scene.instance.traverse((object) => {
    if (isDecal(object)) found.push(object);
  });
  return found;
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: NODE_NAME,
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    render({ node: makeNode(), selectedPath: selectedPath ?? undefined, showGizmos, instantiated }),
};
describeGizmoToggle('<Decal>', GIZMO_CASE);
describeInstantiatedGizmo('<Decal>', GIZMO_CASE);

describe('<Decal>', () => {
  it('draws the box gizmo at its colour alpha 0.9 when the node is selected', async () => {
    const renderer = await render({ node: makeNode(), selectedPath: NODE_NAME });
    expect(lineOpacities(renderer)).toEqual([0.9]);
  });

  it.each([
    ['nothing is selected', undefined],
    ['a different node is selected', 'SomethingElse'],
  ])('draws the box gizmo faintly, at 0.9 times 0.3, when %s', async (_label, selectedPath) => {
    const renderer = await render({ node: makeNode(), selectedPath });
    expect(lineOpacities(renderer)).toHaveLength(1);
    expect(lineOpacities(renderer)[0]).toBeCloseTo(0.27, 10);
  });

  it('scales the box gizmo by size', async () => {
    const renderer = await render({
      node: makeNode({ size: 'Vector3(3, 2, 4)' }),
      selectedPath: NODE_NAME,
    });
    const box = renderer.scene.findAllByType('LineSegments');
    expect(box).toHaveLength(1);
    const scale = sizingGroup(box[0]!.instance as THREE.Object3D).scale;
    expect([scale.x, scale.y, scale.z]).toEqual([3, 2, 4]);
  });

  it('draws no mesh of its own: the scene mixes the decal into the surfaces under it', async () => {
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('puts one decal object into the scene, with the look of its node', async () => {
    const renderer = await render({ node: makeNode({ albedo_mix: '0.7', normal_fade: '0.4' }) });

    const [decal, ...others] = decalObjects(renderer);
    expect(others).toEqual([]);
    expect(decal!.look).toMatchObject({ albedo_mix: 0.7, normal_fade: 0.4 });
  });

  it('gives the decal object its place in tree order', async () => {
    const renderer = await create(
      <SceneStack loader={createFakeResourceLoader().loader} scene={{ externalResources: [] }}>
        <TreeOrderProvider order={[2, 5]}>
          <Decal node={makeNode()} />
        </TreeOrderProvider>
      </SceneStack>
    );

    expect(decalObjects(renderer)[0]!.treeOrder).toEqual([2, 5]);
  });

  it('puts the decal object at the transform of its node', async () => {
    const renderer = await render({
      node: makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 1, -2)' }, 'Placed'),
    });
    const scene = renderer.scene.instance as THREE.Scene;
    scene.updateMatrixWorld();

    const { elements } = decalObjects(renderer)[0]!.matrixWorld;
    expect([elements[12], elements[13], elements[14]]).toEqual([5, 1, -2]);
  });

  describe('the decal atlas', () => {
    /** A producer whose bytes the atlas can read: a Repeat-wrapped, untagged, unmipped RGBA8 texture. */
    function readableProducer(size = 64, rgba: readonly number[] = [255, 0, 0, 255]): THREE.DataTexture {
      const data = new Uint8Array(size * size * 4);
      for (let texel = 0; texel < size * size; texel++) data.set(rgba, texel * 4);
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      return texture;
    }

    async function mount(producer: THREE.Texture, props: Record<string, string> = {}) {
      const renderer = await render({
        node: makeNode({ texture_albedo: 'ExtResource("1_tex")', ...props }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        cached: [{ path: TEXTURE_PATH, texture: producer }],
      });
      updateDecalAtlas(GPU_TEXTURE_SIZE);
      return renderer;
    }

    it('hands the decal object the texture its node names', async () => {
      const producer = readableProducer();
      const renderer = await mount(producer);

      expect(decalObjects(renderer)[0]!.albedo).toBe(producer);
    });

    it('holds the texture in the shared atlas, clamped, in sRGB, over a mip chain, whatever the producer is', async () => {
      // Godot blits the albedo into an RGBA8 atlas (`texture_storage.cpp:3163`) that the shader
      // reads through its sRGB view (`render_forward_clustered.cpp:3213`), clamped and mipmapped
      // (`copy_effects.cpp:592`, `rendering_server.cpp:3804`).
      const producer = readableProducer();
      await mount(producer);

      const atlas = decalAtlasTexture();
      expect(decalAtlasRect(producer)).toBeDefined();
      expect(atlas.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(atlas.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(atlas.mipmaps).toHaveLength(5);
      expect(producer.wrapS).toBe(THREE.RepeatWrapping);
      expect(producer.colorSpace).toBe(THREE.NoColorSpace);
    });

    it("holds an AtlasTexture's whole sheet, which its RID names", async () => {
      const sheet = readableProducer();
      await render({
        node: makeNode({ texture_albedo: 'SubResource("AtlasTexture_cell")' }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        internals: [
          wrapper('AtlasTexture_cell', 'AtlasTexture', {
            atlas: 'ExtResource("1_tex")',
            region: 'Rect2(0, 0, 8, 8)',
          }),
        ],
        cached: [{ path: TEXTURE_PATH, texture: sheet }],
      });
      updateDecalAtlas(GPU_TEXTURE_SIZE);

      expect(decalAtlasRect(sheet)).toBeDefined();
    });

    it('hands the decal object no texture while none loaded (edge case)', async () => {
      const renderer = await render({
        node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        cached: [{ path: TEXTURE_PATH, texture: 'missing' }],
      });

      expect(decalObjects(renderer)[0]!.albedo).toBeNull();
    });

    it('leaves the atlas when it unmounts, and never disposes the shared cache entry', async () => {
      // The atlas borrows the entry, so a dispose of it would free it for every other consumer
      // still sampling it.
      const producer = readableProducer();
      let disposed = false;
      producer.addEventListener('dispose', () => {
        disposed = true;
      });
      const renderer = await mount(producer);
      expect(decalAtlasRect(producer)).toBeDefined();

      await renderer.unmount();
      updateDecalAtlas(GPU_TEXTURE_SIZE);

      expect(decalAtlasRect(producer)).toBeUndefined();
      expect(disposed).toBe(false);
    });
  });

  it('renders children passed to the component', async () => {
    const renderer = await render({
      node: makeNode(),
      children: (
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      ),
    });
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('overrides the gizmo size with an AnimationPlayer-pushed value, reverting on release (ADR-0017)', async () => {
    let registry: AnimatedValueRegistry | null = null;
    function Capture() {
      registry = useAnimatedValueRegistry();
      return null;
    }
    const renderer = await create(
      <SceneStack
        loader={createFakeResourceLoader().loader}
        scene={{ externalResources: [] }}
        selectedPath="D"
      >
        <AnimatedValueProvider>
          <Capture />
          <NodePathProvider path="D">
            <Decal node={makeNode({ size: 'Vector3(2, 2, 2)' }, 'D')} />
          </NodePathProvider>
        </AnimatedValueProvider>
      </SceneStack>
    );
    // The gizmo (visible because 'D' is selected) rides the size-scaled group.
    const sizingScale = () => {
      const s = sizingGroup(renderer.scene.findByType('LineSegments').instance as THREE.Object3D).scale;
      return [s.x, s.y, s.z];
    };
    expect(sizingScale()).toEqual([2, 2, 2]); // authored size
    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'size', [6, 5, 4]));
    expect(sizingScale()).toEqual([6, 5, 4]); // driven size
    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'size', null));
    expect(sizingScale()).toEqual([2, 2, 2]); // released → authored size
  });

  it('hands the decal object an AnimationPlayer-pushed modulate, reverting on release (ADR-0017)', async () => {
    let registry: AnimatedValueRegistry | null = null;
    function Capture() {
      registry = useAnimatedValueRegistry();
      return null;
    }
    const renderer = await create(
      <SceneStack loader={createFakeResourceLoader().loader} scene={{ externalResources: [] }}>
        <AnimatedValueProvider>
          <Capture />
          <NodePathProvider path="D">
            <Decal node={makeNode({ modulate: 'Color(1, 1, 1, 1)' }, 'D')} />
          </NodePathProvider>
        </AnimatedValueProvider>
      </SceneStack>
    );
    const modulate = () => decalObjects(renderer)[0]!.look.modulate;

    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'modulate', [1, 0.5, 0.25, 0.1]));
    expect(modulate()).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.1 });
    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'modulate', null));
    expect(modulate()).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});

/** The group a decal's box gizmo rides: it holds `size` as its scale, and the gizmo's group is inside it. */
function sizingGroup(boxLines: THREE.Object3D): THREE.Object3D {
  return boxLines.parent!.parent!;
}
