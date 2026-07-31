/**
 * <Decal> component tests.
 *
 * The decal PROJECTS its albedo onto scene surfaces via a post-mount scene walk;
 * the projection maths itself is covered in decalProjection.test.ts. The
 * test-renderer mounts no SIBLING meshes, so a bare decal bakes nothing — but a
 * receiver passed as a child does get projected onto (the effect calls
 * `scene.updateMatrixWorld(true)` itself, so stale world matrices are not an
 * obstacle). That makes the `cull_mask` wiring observable end to end here: two
 * otherwise-identical mounts, one masked and one not, bake different counts.
 * Also observable: the projection-box gizmo is selection-gated (ADR-0018) —
 * hidden by default, shown only when this node is selected — the node never
 * draws a standalone quad, and the Node3D transform / children pass through.
 */

import { useEffect, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Decal } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';
import {
  AnimatedValueProvider,
  useAnimatedValueRegistry,
  type AnimatedValueRegistry,
} from '../../../r3f/contexts/AnimatedValueContext';
import type { TscnExternalResource, TscnNode } from '../../../parser/types';
import { parseDecal } from './parser';

const TEXTURE_PATH = 'res://textures/decal.png';
const NODE_NAME = 'MyDecal';

function makeTexture(width = 64, height = 64): THREE.Texture {
  const t = new THREE.Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width, height };
  return t;
}

function makeNode(props: Record<string, string> = {}, name = NODE_NAME): TscnNode {
  return {
    name,
    type: 'Decal',
    children: [],
    properties: parseDecal({ type: 'node', attributes: { type: 'Decal', name } }, props),
  };
}

function extRef(id: string, path: string): TscnExternalResource {
  return { id, type: 'Texture2D', path };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

interface RenderOptions {
  node: TscnNode;
  externals?: TscnExternalResource[];
  cached?: Array<{ path: string; texture: THREE.Texture | 'missing' }>;
  children?: ReactNode;
  selectedPath?: string | null;
}

/** The mounted tree, separated from `create` so a test can re-render it. */
function decalTree(opts: RenderOptions, loader: ReturnType<typeof createFakeResourceLoader>['loader']) {
  return (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider externalResources={opts.externals ?? []}>
        <SelectionProvider>
          {opts.selectedPath !== undefined && <SelectSeeder path={opts.selectedPath} />}
          <NodePathProvider path={opts.node.name}>
            <Decal node={opts.node}>{opts.children}</Decal>
          </NodePathProvider>
        </SelectionProvider>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
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
  return ReactThreeTestRenderer.create(decalTree(opts, seededLoader(opts.cached)));
}

/**
 * A receiver on Godot render layer 2 — the layer Truck Town's blob shadows
 * exclude. Big enough to straddle the decal's default 2x2x2 box.
 */
function Receiver() {
  return (
    <mesh name="receiver" userData={{ godotLayers: 2 }}>
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

describe('<Decal>', () => {
  it('hides the projection-box gizmo by default (Godot runtime draws none)', async () => {
    const renderer = await render({ node: makeNode() });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws the box gizmo, scaled by size, when the node is selected', async () => {
    const renderer = await render({
      node: makeNode({ size: 'Vector3(3, 2, 4)' }),
      selectedPath: NODE_NAME,
    });
    const box = renderer.scene.findAllByType('LineSegments');
    expect(box).toHaveLength(1);
    const scale = (box[0].instance as THREE.Object3D).parent!.scale;
    expect([scale.x, scale.y, scale.z]).toEqual([3, 2, 4]);
  });

  it('hides the gizmo when a different node is selected', async () => {
    const renderer = await render({ node: makeNode(), selectedPath: 'SomethingElse' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('never draws a standalone quad — projection needs live scene geometry', async () => {
    // Albedo loads, but no receiver meshes exist in isolation, so nothing is
    // baked (the old floating mid-plane quad is gone).
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
    });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
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
    // shadow. Same node, same box, same albedo as the test above — only the
    // mask differs.
    const renderer = await render({
      node: makeNode({ texture_albedo: 'ExtResource("1_tex")', cull_mask: '1048573' }),
      externals: [extRef('1_tex', TEXTURE_PATH)],
      cached: [{ path: TEXTURE_PATH, texture: makeTexture() }],
      children: <Receiver />,
    });
    expect(projections(renderer)).toEqual([]);
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
    // itemSize 4 is what makes three read the ALPHA channel rather than just RGB.
    expect(color.itemSize).toBe(4);
    expect((projection!.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });

  it('keeps albedo_mix x modulate.a in opacity and the geometric fade in vertex alpha', async () => {
    // Godot's blend weight is tex.a x modulate.a x fade x albedo_mix. Splitting
    // it across `opacity` and the baked attribute is only correct if neither
    // carries the other's factor — so 0.7 x 0.8 must land in opacity ALONE, and
    // the vertex alpha must stay the near-1 depth fade of a receiver sitting
    // just below the decal origin.
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
    // The frame callback culls a decal past `begin + length` by hiding its
    // projection group and zeroing the material's opacity. Neither is part of
    // the rebuild effect's inputs, so a re-parse that DISABLES the fade rebuilds
    // nothing — the callback itself has to settle back at full strength, or the
    // decal stays invisible for the rest of the session.
    const loader = seededLoader([{ path: TEXTURE_PATH, texture: makeTexture() }]);
    const options = {
      externals: [extRef('1_tex', TEXTURE_PATH)],
      children: <Receiver />,
    };
    const faded = {
      texture_albedo: 'ExtResource("1_tex")',
      distance_fade_enabled: 'true',
      // The test renderer's camera sits metres away, so anything past this is culled.
      distance_fade_begin: '0.01',
      distance_fade_length: '0.01',
    };

    const renderer = await ReactThreeTestRenderer.create(
      decalTree({ ...options, node: makeNode(faded) }, loader)
    );
    await renderer.advanceFrames(1, 16);

    const projection = projections(renderer)[0]!;
    // The group is the component's own ref and outlives a rebuild; the meshes
    // and material inside it do not.
    const group = projection.parent!;
    expect(group.visible).toBe(false);
    expect((projection.material as THREE.MeshStandardMaterial).opacity).toBe(0);

    await renderer.update(
      decalTree(
        { ...options, node: makeNode({ ...faded, distance_fade_enabled: 'false' }) },
        loader
      )
    );
    await renderer.advanceFrames(1, 16);

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
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <SceneResourcesProvider externalResources={[]}>
          <SelectionProvider>
            <SelectSeeder path="D" />
            <AnimatedValueProvider>
              <Capture />
              <NodePathProvider path="D">
                <Decal node={makeNode({ size: 'Vector3(2, 2, 2)' }, 'D')} />
              </NodePathProvider>
            </AnimatedValueProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    // The gizmo (visible because 'D' is selected) rides the size-scaled group.
    const sizingScale = () => {
      const ls = renderer.scene.findByType('LineSegments').instance as THREE.Object3D;
      const s = ls.parent!.scale;
      return [s.x, s.y, s.z];
    };
    expect(sizingScale()).toEqual([2, 2, 2]); // authored size
    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'size', [6, 5, 4]));
    expect(sizingScale()).toEqual([6, 5, 4]); // driven size
    await ReactThreeTestRenderer.act(async () => registry!.set('D', 'size', null));
    expect(sizingScale()).toEqual([2, 2, 2]); // released → authored size
  });
});
