/**
 * <Decal> component tests. The test-renderer mounts no sibling meshes, so a bare decal bakes
 * nothing, but a receiver child is projected onto (the effect runs `scene.updateMatrixWorld(true)`
 * itself). That makes `cull_mask` observable end to end, beside the projector box gizmo (drawn for
 * every node, faint while unselected, `decal_gizmo_plugin.cpp:128`), the absent standalone quad
 * and the Node3D pass-through.
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
import { fireSceneRender } from '../../../r3f/testing/fireSceneRender';
import { reportsMaxTextureSize } from '../../../r3f/testing/reportsMaxTextureSize';
import { decalAtlasRect, decalAtlasTexture, holdDecalTexture, releaseDecalTexture } from './decalAtlas';

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

/**
 * A receiver on Godot render layer 2, the layer Truck Town's blob shadows exclude. Big enough to
 * straddle the decal's default 2x2x2 box.
 */
function Receiver({ visible = true, y = 0 }: { visible?: boolean; y?: number }) {
  return (
    <mesh name="receiver" userData={{ godotLayers: 2 }} visible={visible} position={[0, y, 0]}>
      <boxGeometry args={[4, 0.1, 4]} />
      <meshBasicMaterial />
    </mesh>
  );
}

/** Decal projections are added to the projection group imperatively, so they
 *  live on the real THREE graph rather than in the test renderer's fiber tree. */
function projections(renderer: { scene: { instance: THREE.Object3D } }): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  renderer.scene.instance.traverse((obj) => {
    if (obj.userData.isDecalProjection === true) found.push(obj as THREE.Mesh);
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

  it('never draws a standalone quad — projection needs live scene geometry', async () => {
    // Albedo loads, but no receiver meshes exist in isolation, so nothing is baked.
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
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

    /** Mounts a decal with `producer` over a receiver and fires the render that places it in the atlas. */
    async function draw(producer: THREE.Texture, props: Record<string, string> = {}) {
      const renderer = await render({
        node: makeNode({ texture_albedo: 'ExtResource("1_tex")', ...props }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        cached: [{ path: TEXTURE_PATH, texture: producer }],
        children: <Receiver />,
      });
      const scene = renderer.scene.instance as THREE.Scene;
      scene.updateMatrixWorld();
      await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));
      return renderer;
    }

    it('samples the shared atlas, clamped, in sRGB, over a mip chain, whatever the producer is', async () => {
      // Godot blits the albedo into an RGBA8 atlas (`texture_storage.cpp:3163`) that the shader
      // reads through its sRGB view (`render_forward_clustered.cpp:3213`), clamped and mipmapped
      // (`copy_effects.cpp:592`, `rendering_server.cpp:3804`).
      const producer = readableProducer();
      const renderer = await draw(producer);

      const map = (projections(renderer)[0]!.material as THREE.MeshStandardMaterial).map!;
      expect(map).toBe(decalAtlasTexture());
      expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(map.wrapS).toBe(THREE.ClampToEdgeWrapping);
      expect(map.mipmaps).toHaveLength(5);
      expect(producer.wrapS).toBe(THREE.RepeatWrapping);
      expect(producer.colorSpace).toBe(THREE.NoColorSpace);
    });

    it("keeps a projection's UV inside its texture's rectangle", async () => {
      const producer = readableProducer();
      const renderer = await draw(producer);

      const rect = decalAtlasRect(producer)!;
      const uv = projections(renderer)[0]!.geometry.getAttribute('uv');
      const [us, vs] = [0, 1].map((axis) =>
        Array.from({ length: uv.count }, (_, i) => (axis ? uv.getY(i) : uv.getX(i)))
      );
      // The 2 x 2 x 2 box over a 4 x 4 receiver projects the whole texture.
      expect(Math.min(...us!)).toBeCloseTo(rect.x, 5);
      expect(Math.max(...us!)).toBeCloseTo(rect.x + rect.width, 5);
      expect(Math.min(...vs!)).toBeCloseTo(rect.y, 5);
      expect(Math.max(...vs!)).toBeCloseTo(rect.y + rect.height, 5);
    });

    it("follows its rectangle when another decal's texture moves it", async () => {
      const producer = readableProducer();
      const renderer = await draw(producer);
      const before = decalAtlasRect(producer)!;

      const wide = readableProducer(300);
      holdDecalTexture(wide);
      const scene = renderer.scene.instance as THREE.Scene;
      await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));

      const after = decalAtlasRect(producer)!;
      expect(after.width).not.toBe(before.width);
      const uv = projections(renderer)[0]!.geometry.getAttribute('uv');
      expect(Math.max(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))).toBeCloseTo(
        after.x + after.width,
        5
      );
      releaseDecalTexture(wide);
    });

    it("projects an AtlasTexture's whole sheet, which its RID names", async () => {
      const sheet = readableProducer();
      const renderer = await render({
        node: makeNode({ texture_albedo: 'SubResource("AtlasTexture_cell")' }),
        externals: [extRef('1_tex', TEXTURE_PATH)],
        internals: [
          wrapper('AtlasTexture_cell', 'AtlasTexture', {
            atlas: 'ExtResource("1_tex")',
            region: 'Rect2(0, 0, 8, 8)',
          }),
        ],
        cached: [{ path: TEXTURE_PATH, texture: sheet }],
        children: <Receiver />,
      });
      const scene = renderer.scene.instance as THREE.Scene;
      scene.updateMatrixWorld();
      await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));

      expect(decalAtlasRect(sheet)).toBeDefined();
    });

    it('draws nothing while its texture cannot be read (edge case)', async () => {
      const renderer = await draw(makeTexture());

      const [projection] = projections(renderer);
      expect(projection!.visible).toBe(false);
    });

    it('leaves the atlas when it unmounts, and never disposes the shared cache entry', async () => {
      // The projection borrows the entry, so its cleanup may free only what the decal made. A
      // dispose of the entry would free it for every other consumer still sampling it.
      const producer = readableProducer();
      let disposed = false;
      producer.addEventListener('dispose', () => {
        disposed = true;
      });
      const renderer = await draw(producer);
      expect(decalAtlasRect(producer)).toBeDefined();

      await renderer.unmount();

      expect(decalAtlasRect(producer)).toBeUndefined();
      expect(disposed).toBe(false);
    });
  });

  it('projects onto a receiver whose render layers the cull_mask admits', async () => {
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });
    expect(projections(renderer).length).toBeGreaterThan(0);
  });

  it('projects nothing onto a receiver the cull_mask culls', async () => {
    // Truck Town's blob shadows: `cull_mask` clears layer 2 and every vehicle
    // mesh sets `layers = 2`, so Godot never paints the vehicle with its own
    // shadow. Same node, same box, same albedo as the test above: only the mask differs.
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")', cull_mask: '1048573' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });
    expect(projections(renderer)).toEqual([]);
  });

  it('projects onto a receiver that mounts after the decal baked', async () => {
    // A Label3D builds its glyph mesh once its font loads, so the decal can bake first. Godot's
    // clustered decal finds a late receiver by its next frame.
    const loader = seededLoader([{ path: TEXTURE_PATH, texture: makeTexture() }]);
    const options = {
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
    };
    const renderer = await create(decalTree(options, loader));
    expect(projections(renderer)).toEqual([]);

    await renderer.update(decalTree({ ...options, children: <Receiver /> }, loader));
    const scene = renderer.scene.instance as THREE.Scene;
    scene.updateMatrixWorld();
    await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));

    expect(projections(renderer).length).toBeGreaterThan(0);
  });

  describe('a receiver edited in place, with no remount', () => {
    const externals = [extRef('1_tex', TEXTURE_PATH)];
    /** A scene edit parses every node afresh, the decal's too. */
    const parsedDecal = () => makeNode({ texture_albedo: 'ExtResource("1_tex")' });
    const loader = () => seededLoader([{ path: TEXTURE_PATH, texture: makeTexture() }]);

    async function editAndRender(before: React.ReactElement, after: React.ReactElement) {
      const sharedLoader = loader();
      const renderer = await create(
        decalTree({ node: parsedDecal(), externals, children: before }, sharedLoader)
      );
      await renderer.update(decalTree({ node: parsedDecal(), externals, children: after }, sharedLoader));
      const scene = renderer.scene.instance as THREE.Scene;
      scene.updateMatrixWorld();
      await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));
      return renderer;
    }

    it('stops projecting onto a receiver that is hidden', async () => {
      const renderer = await editAndRender(<Receiver />, <Receiver visible={false} />);

      expect(projections(renderer)).toEqual([]);
    });

    it('projects onto a receiver that is shown', async () => {
      const renderer = await editAndRender(<Receiver visible={false} />, <Receiver />);

      expect(projections(renderer).length).toBeGreaterThan(0);
    });

    it('projects onto a receiver that moves into the box', async () => {
      const renderer = await editAndRender(<Receiver y={50} />, <Receiver y={0} />);

      expect(projections(renderer).length).toBeGreaterThan(0);
    });
  });

  it('keeps a receiver that stays mounted baked once, across renders', async () => {
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });
    const scene = renderer.scene.instance as THREE.Scene;
    const before = projections(renderer);
    await ReactThreeTestRenderer.act(async () => fireSceneRender(scene, farCamera()));

    expect(projections(renderer)).toEqual(before);
  });

  it('bakes the fade into a vertex-alpha attribute the material opts into', async () => {
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });

    const projection = projections(renderer)[0];
    const color = projection!.geometry.getAttribute('color');
    expect(color).toBeDefined();
    // itemSize 4 is what makes three read the alpha channel, not only RGB.
    expect(color.itemSize).toBe(4);
    expect((projection!.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });

  it('keeps albedo_mix x modulate.a in opacity and the geometric fade in vertex alpha', async () => {
    // Godot's blend weight is tex.a x modulate.a x fade x albedo_mix. Split across `opacity` and
    // the baked attribute, neither may carry the other's factor: 0.7 x 0.8 lands in opacity alone,
    // and vertex alpha stays the near-1 depth fade of a receiver just below the decal origin.
    const renderer = await render({
      node: makeNode({
        texture_albedo: 'ExtResource("1_tex")',
        albedo_mix: '0.7',
        modulate: 'Color(1, 1, 1, 0.8)',
      }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });

    const projection = projections(renderer)[0];
    expect((projection!.material as THREE.MeshStandardMaterial).opacity).toBeCloseTo(0.56, 6);

    const color = projection!.geometry.getAttribute('color');
    for (let i = 0; i < color.count; i++) {
      // Had opacity been folded in too, every alpha would sit at or below 0.56.
      expect(color.getW(i)).toBeGreaterThan(0.9);
    }
  });

  it('restores a distance-faded decal when the fade is turned back off', async () => {
    // A render culls a decal past `begin + length` by hiding its group and zeroing opacity. The
    // rebuild effect ignores both, so after a re-parse disables the fade the fade itself must
    // settle back at full strength, or the decal stays invisible.
    const loader = seededLoader([{ path: TEXTURE_PATH, texture: makeTexture() }]);
    const options = {
      externals: [extRef('1_tex', TEXTURE_PATH)],
      children: <Receiver />,
    };
    const faded = {
      texture_albedo: 'ExtResource("1_tex")',
      distance_fade_enabled: 'true',
      // The render's camera sits metres away, so anything past this is culled.
      distance_fade_begin: '0.01',
      distance_fade_length: '0.01',
    };

    const renderer = await create(decalTree({ ...options, node: makeNode(faded) }, loader));
    const scene = renderer.scene.instance as THREE.Scene;
    scene.updateMatrixWorld();
    fireSceneRender(scene, farCamera());

    const projection = projections(renderer)[0]!;
    // The group is the component's own ref and outlives a rebuild; the meshes
    // and material inside it do not.
    const group = projection.parent!;
    expect(group.visible).toBe(false);
    expect((projection.material as THREE.MeshStandardMaterial).opacity).toBe(0);

    await renderer.update(
      decalTree({ ...options, node: makeNode({ ...faded, distance_fade_enabled: 'false' }) }, loader)
    );
    fireSceneRender(scene, farCamera());

    expect(group.visible).toBe(true);
    const rebuilt = projections(renderer)[0]!;
    expect((rebuilt.material as THREE.MeshStandardMaterial).opacity).toBe(1);
  });

  it('applies the Node3D transform and wraps children', async () => {
    const renderer = await render({
      node: {
        ...makeNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 1, -2)' }, 'Placed'),
        children: [],
      },
    });
    const group = renderer.scene.findByProps({ name: 'Placed' });
    expect(group.instance.position.x).toBe(5);
    expect(group.instance.position.z).toBe(-2);
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
});

/** The group a decal's box gizmo rides: it holds `size` as its scale, and the gizmo's group is inside it. */
function sizingGroup(boxLines: THREE.Object3D): THREE.Object3D {
  return boxLines.parent!.parent!;
}

/** A camera metres from the origin, past a tight fade's end. */
function farCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 5);
  camera.updateMatrixWorld();
  return camera;
}
