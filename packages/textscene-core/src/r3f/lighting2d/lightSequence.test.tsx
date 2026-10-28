/**
 * A light's draw order is its tree position, not its registration order: a light registers when
 * its cookie resolves, so a tree-earlier light can register second. These drive the live-tree
 * path the renderer uses, which numbers a light inside an instance where the instance sits
 * (ADR-0013).
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider } from './CanvasLighting2D';
import { litQuadRenderOrder } from './ShadowVolumeMask';
import { lightDrawSequence, lightPathsByCanvas } from './lightSequence';
import { liveTreeOf } from '../liveSceneTree';
import type { TscnNode } from '../../parser/types';
import { CanvasLightSequenceProvider, useDirectionalLightSlot, useLightSequence } from './useLightSequence';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { SceneStack } from '../testing/SceneStack';
import { settleLoads } from '../testing/settleLoads';
import '../nodes'; // side-effect: registers every node's r3f component

const COOKIE = 'res://light.png';

async function render(body: string) {
  const tscn = `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[node name="Root" type="Node2D"]
${body}`;
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  fake.textures.seed(COOKIE, cookieTexture());

  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(parsed), panelId: 'p' }}>
        <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
          <NodeDispatcher nodes={parsed.nodes} />
        </CanvasLighting2DProvider>
      </HierarchyProvider>
    </SceneStack>
  );
  await settleLoads();
  return renderer;
}

/**
 * A cookie shaped like the loader's hand-over (ADR-0044): sRGB-tagged, clamp-wrapped,
 * with the `image` dimensions the quad reads, so the light's clamp bind shares it.
 */
function cookieTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.image = { width: 64, height: 64 };
  return texture;
}

function lamp(name: string, parent = '.', extra = ''): string {
  return `
[node name="${name}" type="PointLight2D" parent="${parent}"]
texture = ExtResource("1")
${extra}`;
}

/** Every cookie quad's renderOrder, in the order the renderer mounted them. */
function quadOrders(renderer: Awaited<ReturnType<typeof render>>): number[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((o) => o.instance as { material?: { uniforms?: Record<string, unknown> }; renderOrder: number })
    .filter((m) => !!m.material?.uniforms?.uCookie && !!m.material?.uniforms?.uColor)
    .map((m) => m.renderOrder);
}

/**
 * The provider walks once per canvas and every light reads the result. Driven directly: with every
 * cookie resolving in one tick, the dispatcher cases cannot tell a sequence from an ordinal.
 */
describe('CanvasLightSequenceProvider', () => {
  const SCENE = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="A" type="PointLight2D" parent="."]
[node name="Mid" type="Node2D" parent="."]
[node name="B" type="PointLight2D" parent="Mid"]
[node name="C" type="PointLight2D" parent="."]
[node name="Prop" type="Sprite2D" parent="."]
`;

  function Probe({ path, seen }: { path: string; seen: (number | null)[] }) {
    return (
      <NodePathProvider path={path}>
        <Read seen={seen} />
      </NodePathProvider>
    );
  }

  function Read({ seen }: { seen: (number | null)[] }) {
    seen.push(useLightSequence());
    return null;
  }

  async function sequences(
    paths: readonly string[],
    scene = SCENE,
    viewportPath: string | null = null
  ): Promise<(number | null)[]> {
    const seen: (number | null)[] = [];
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(scene));
    await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <CanvasLightSequenceProvider viewportPath={viewportPath}>
          {paths.map((path) => (
            <Probe key={path} path={path} seen={seen} />
          ))}
        </CanvasLightSequenceProvider>
      </HierarchyProvider>
    );
    return seen;
  }

  it('numbers the canvas light list in preorder', async () => {
    // `Mid/B` is deeper than `C` but earlier in preorder.
    expect(await sequences(['Root/A', 'Root/Mid/B', 'Root/C'])).toEqual([0, 1, 2]);
  });

  it('is dense across an unlit tree, so the pairing spends no empty slots', async () => {
    // `Prop` is a Sprite2D between two lights and takes no slot.
    expect(await sequences(['Root/C'])).toEqual([2]);
  });

  it("leaves a light inside a SubViewport off the main canvas's list, as Godot keeps one per viewport", async () => {
    const scene = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="View" type="SubViewport" parent="."]
[node name="Inner" type="PointLight2D" parent="View"]
[node name="A" type="PointLight2D" parent="."]
`;
    expect(await sequences(['Root/View/Inner', 'Root/A'], scene)).toEqual([null, 0]);
  });

  it("numbers the lights of a SubViewport's own canvas from zero, and leaves the outer lights off it", async () => {
    const scene = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="A" type="PointLight2D" parent="."]
[node name="View" type="SubViewport" parent="."]
[node name="Inner" type="PointLight2D" parent="View"]
[node name="Second" type="PointLight2D" parent="View"]
`;
    expect(await sequences(['Root/A', 'Root/View/Inner', 'Root/View/Second'], scene, 'Root/View')).toEqual([
      null,
      0,
      1,
    ]);
  });

  it('is null for a path the walk never saw', async () => {
    expect(await sequences(['Root/Nowhere'])).toEqual([null]);
  });

  it('is null with no canvas provider at all', async () => {
    const seen: (number | null)[] = [];
    await ReactThreeTestRenderer.create(<Probe path="Root/A" seen={seen} />);
    expect(seen).toEqual([null]);
  });
});

describe('light draw order over the live tree', () => {
  it('numbers lights in preorder, so a deeper earlier light precedes a shallower later one', async () => {
    // Root has A (seq 0), Mid with B (seq 1: deeper, but earlier in preorder than C), and C (seq 2).
    const renderer = await render(
      `${lamp('A')}
[node name="Mid" type="Node2D" parent="."]
${lamp('B', 'Mid')}${lamp('C')}`
    );
    expect(quadOrders(renderer)).toEqual([
      litQuadRenderOrder(0),
      litQuadRenderOrder(1),
      litQuadRenderOrder(2),
    ]);
  });

  it('is dense across an unlit tree, so the pairing spends no empty slots', async () => {
    const renderer = await render(
      `
[node name="Sprite" type="Sprite2D" parent="."]
${lamp('A')}
[node name="Poly" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
${lamp('B')}`
    );
    expect(quadOrders(renderer)).toEqual([litQuadRenderOrder(0), litQuadRenderOrder(1)]);
  });

  it('gives a lone light slot zero rather than an arbitrary offset', async () => {
    expect(quadOrders(await render(lamp('Only')))).toEqual([litQuadRenderOrder(0)]);
  });
});

/** One node of a tree under `Root`, named by its path. */
interface Entry {
  path: string;
  type: string;
  properties: Record<string, unknown>;
}

function entry(path: string, type: string, properties: Record<string, unknown> = {}): Entry {
  return { path, type, properties };
}

/** The tree the entries name, under a `Root`. A path an entry does not name is a plain Node2D. */
function treeOf(entries: readonly Entry[]) {
  const nodeAt = (name: string, type: string, properties: Record<string, unknown>): TscnNode =>
    ({ name, type, properties, children: [] }) as never;
  const root = nodeAt('Root', 'Node2D', {});
  const byPath = new Map<string, TscnNode>([['Root', root]]);
  const place = (path: string, type: string, properties: Record<string, unknown>): void => {
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    if (!byPath.has(parentPath)) place(parentPath, 'Node2D', {});
    const node = nodeAt(path.split('/').pop()!, type, properties);
    byPath.set(path, node);
    byPath.get(parentPath)!.children.push(node);
  };
  for (const { path, type, properties } of entries) place(path, type, properties);
  return liveTreeOf([root], {
    externalResources: [],
    internalResources: [],
    sceneCache: { getCached: () => null },
  });
}

/**
 * Godot keeps one light list per canvas, and a SubViewport owns a canvas of its own
 * (`viewport.cpp:5345`). The walk is one pass over the tree, split by the nearest SubViewport.
 */
describe('lightPathsByCanvas', () => {
  const lights = (entries: Entry[], canvas: string | null = null) =>
    lightPathsByCanvas(treeOf(entries)).get(canvas) ?? { positional: [], directional: [] };

  it('lists a PointLight2D as positional and a DirectionalLight2D as directional, never both', () => {
    // Numbering a sun as positional would leave a hole the 2n / 2n+1 pairing spends for nothing.
    const lists = lights([
      entry('Root/Lamp', 'PointLight2D'),
      entry('Root/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Sprite', 'Sprite2D'),
    ]);
    expect(lists).toEqual({ positional: ['Root/Lamp'], directional: ['Root/Sun'] });
  });

  it('leaves a disabled or hidden DirectionalLight2D off the directional list', () => {
    const lists = lights([
      entry('Root/Off', 'DirectionalLight2D', { enabled: false }),
      entry('Root/Hidden', 'DirectionalLight2D', { enabled: true, visible: false }),
    ]);
    expect(lists.directional).toEqual([]);
  });

  it('lists the lights of the root canvas in preorder, positional and directional apart', () => {
    const lists = lights([
      entry('Root/Lamp', 'PointLight2D'),
      entry('Root/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Mid/Lamp', 'PointLight2D'),
    ]);
    expect(lists).toEqual({ positional: ['Root/Lamp', 'Root/Mid/Lamp'], directional: ['Root/Sun'] });
  });

  it('gives the lights below a SubViewport to its own canvas, not the root canvas', () => {
    const entries = [
      entry('Root/Outer', 'PointLight2D'),
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Inner', 'PointLight2D'),
      entry('Root/View/Sun', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Late', 'PointLight2D'),
    ];
    expect(lights(entries)).toEqual({ positional: ['Root/Outer', 'Root/Late'], directional: [] });
    expect(lights(entries, 'Root/View')).toEqual({
      positional: ['Root/View/Inner'],
      directional: ['Root/View/Sun'],
    });
  });

  it('keeps a nested SubViewport out of the canvas that holds it', () => {
    const entries = [
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Lamp', 'PointLight2D'),
      entry('Root/View/Inner', 'SubViewport'),
      entry('Root/View/Inner/Lamp', 'PointLight2D'),
      entry('Root/View/After', 'PointLight2D'),
    ];
    expect(lights(entries, 'Root/View').positional).toEqual(['Root/View/Lamp', 'Root/View/After']);
    expect(lights(entries, 'Root/View/Inner').positional).toEqual(['Root/View/Inner/Lamp']);
  });

  it('leaves a hidden light and a light under a hidden node off the directional list', () => {
    const lists = lights([
      entry('Root/Hidden', 'DirectionalLight2D', { enabled: true, visible: false }),
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/Inner', 'DirectionalLight2D', { enabled: true }),
      entry('Root/Off', 'DirectionalLight2D', { enabled: false }),
      entry('Root/Shown', 'DirectionalLight2D', { enabled: true }),
    ]);
    expect(lists.directional).toEqual(['Root/Shown']);
  });

  it('numbers a hidden positional light, since only a directional light is listed by visibility', () => {
    const lists = lights([
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/Lamp', 'PointLight2D'),
    ]);
    expect(lists.positional).toEqual(['Root/Group/Lamp']);
  });

  it("does not carry a hidden node above a SubViewport into the SubViewport's canvas", () => {
    // A SubViewport is no CanvasItem, so its children do not inherit the hiding (`canvas_item.cpp:309-349`).
    const entries = [
      entry('Root/Group', 'Node2D', { visible: false }),
      entry('Root/Group/View', 'SubViewport'),
      entry('Root/Group/View/Sun', 'DirectionalLight2D', { enabled: true }),
    ];
    expect(lights(entries, 'Root/Group/View').directional).toEqual(['Root/Group/View/Sun']);
  });

  it('stops each directional list at MAX_2D_DIRECTIONAL_LIGHTS, per canvas', () => {
    const names = Array.from({ length: 9 }, (_unused, index) => `S${index}`);
    const entries = [
      ...names.map((name) => entry(`Root/${name}`, 'DirectionalLight2D', { enabled: true })),
      entry('Root/View', 'SubViewport'),
      entry('Root/View/Sun', 'DirectionalLight2D', { enabled: true }),
    ];
    expect(lights(entries).directional).toHaveLength(8);
    expect(lights(entries, 'Root/View').directional).toEqual(['Root/View/Sun']);
  });
});

/**
 * Godot keeps directional lights on their own list (`renderer_viewport.cpp:491-514`): it holds only
 * lights `canvas_light_set_enabled` left on, which `Light2D::_update_light_visibility`
 * (`light_2d.cpp:59`) ties to `enabled` and visibility in the tree, and it stops at eight.
 */
describe('useDirectionalLightSlot', () => {
  function Read({ seen }: { seen: (number | null)[] }) {
    seen.push(useDirectionalLightSlot());
    return null;
  }

  async function slots(
    scene: string,
    paths: readonly string[],
    viewportPath: string | null = null
  ): Promise<(number | null)[]> {
    const seen: (number | null)[] = [];
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(scene));
    await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <CanvasLightSequenceProvider viewportPath={viewportPath}>
          {paths.map((path) => (
            <NodePathProvider key={path} path={path}>
              <Read seen={seen} />
            </NodePathProvider>
          ))}
        </CanvasLightSequenceProvider>
      </HierarchyProvider>
    );
    return seen;
  }

  function sun(name: string, parent = '.', extra = ''): string {
    return `[node name="${name}" type="DirectionalLight2D" parent="${parent}"]\n${extra}\n`;
  }

  const ROOT = '[gd_scene format=3]\n[node name="Root" type="Node2D"]\n';

  it('numbers directional lights in preorder, apart from the positional list', async () => {
    const scene = `${ROOT}[node name="Lamp" type="PointLight2D" parent="."]\n${sun('A')}${sun('B')}`;
    expect(await slots(scene, ['Root/A', 'Root/B'])).toEqual([0, 1]);
  });

  it('skips a disabled light, which never reaches the list', async () => {
    const scene = `${ROOT}${sun('Off', '.', 'enabled = false')}${sun('On')}`;
    expect(await slots(scene, ['Root/Off', 'Root/On'])).toEqual([null, 0]);
  });

  it('skips a hidden light and a light under a hidden parent', async () => {
    const scene = `${ROOT}${sun('Hidden', '.', 'visible = false')}[node name="Group" type="Node2D" parent="."]
visible = false
${sun('Inner', 'Group')}${sun('Shown')}`;
    expect(await slots(scene, ['Root/Hidden', 'Root/Group/Inner', 'Root/Shown'])).toEqual([null, null, 0]);
  });

  it('stops at MAX_2D_DIRECTIONAL_LIGHTS, so a ninth light takes no slot', async () => {
    const names = Array.from({ length: 9 }, (_unused, index) => `S${index}`);
    const scene = ROOT + names.map((name) => sun(name)).join('');
    const seen = await slots(
      scene,
      names.map((name) => `Root/${name}`)
    );
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, null]);
  });

  it("leaves a light inside a SubViewport off the main canvas's list, as Godot keeps one per viewport", async () => {
    const names = Array.from({ length: 8 }, (_unused, index) => `S${index}`);
    const scene = `${ROOT}[node name="View" type="SubViewport" parent="."]\n${sun('Inner', 'View')}${names
      .map((name) => sun(name))
      .join('')}`;
    const seen = await slots(scene, ['Root/View/Inner', ...names.map((name) => `Root/${name}`)]);
    expect(seen).toEqual([null, 0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("lists a SubViewport's own sun in its canvas, ahead of the outer suns", async () => {
    const scene = `${ROOT}${sun('Outer')}[node name="View" type="SubViewport" parent="."]\n${sun('Inner', 'View')}`;
    expect(await slots(scene, ['Root/Outer', 'Root/View/Inner'], 'Root/View')).toEqual([null, 0]);
  });

  it('gives slot 0 to a light outside any scene hierarchy', async () => {
    const seen: (number | null)[] = [];
    await ReactThreeTestRenderer.create(<Read seen={seen} />);
    expect(seen).toEqual([0]);
  });
});

describe('lightDrawSequence', () => {
  it('draws a listed light at its place in the list', () => {
    expect(lightDrawSequence(4, 9)).toBe(4);
  });

  it('draws a light the walk never saw after every listed light, by ordinal', () => {
    expect(lightDrawSequence(null, 0)).toBeGreaterThan(lightDrawSequence(100_000, 9));
    expect(lightDrawSequence(null, 9)).toBeGreaterThan(lightDrawSequence(null, 0));
  });

  it('ranks a light that is neither listed nor declared first among the unlisted', () => {
    expect(lightDrawSequence(null, null)).toBe(lightDrawSequence(null, 0));
  });
});
