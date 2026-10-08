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
import {
  holdsListedDirectionalLights,
  isListedDirectionalLight,
  isPositionalCanvasLight,
  isShownCanvasNode,
  lightDrawSequence,
} from './lightSequence';
import { CanvasLightSequenceProvider, useDirectionalLightSlot, useLightSequence } from './useLightSequence';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { SceneStack } from '../testing/SceneStack';
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
      <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
        <NodeDispatcher nodes={parsed.nodes} />
      </CanvasLighting2DProvider>
    </SceneStack>
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
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

describe('isPositionalCanvasLight', () => {
  it('claims a slot for a PointLight2D', () => {
    expect(isPositionalCanvasLight({ type: 'PointLight2D' } as never)).toBe(true);
  });

  it('claims none for a DirectionalLight2D, which sits on a list of its own', () => {
    // Numbering it would leave a hole the 2n / 2n+1 pairing spends for nothing.
    expect(isPositionalCanvasLight({ type: 'DirectionalLight2D' } as never)).toBe(false);
  });

  it('claims none for an ordinary canvas item', () => {
    expect(isPositionalCanvasLight({ type: 'Sprite2D' } as never)).toBe(false);
  });
});

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

  async function sequences(paths: readonly string[], scene = SCENE): Promise<(number | null)[]> {
    const seen: (number | null)[] = [];
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(scene));
    await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <CanvasLightSequenceProvider>
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

describe('isShownCanvasNode', () => {
  it('reads a node with no parsed `visible` as shown', () => {
    expect(isShownCanvasNode({ type: 'Node2D', properties: {} } as never)).toBe(true);
  });

  it('reads `visible = false` as hidden', () => {
    expect(isShownCanvasNode({ type: 'Node2D', properties: { visible: false } } as never)).toBe(false);
  });
});

describe('holdsListedDirectionalLights', () => {
  it('enters a shown canvas node', () => {
    expect(holdsListedDirectionalLights({ type: 'Node2D', properties: {} } as never)).toBe(true);
  });

  it('stops at a hidden node', () => {
    expect(holdsListedDirectionalLights({ type: 'Node2D', properties: { visible: false } } as never)).toBe(
      false
    );
  });

  it('stops at a shown SubViewport', () => {
    expect(holdsListedDirectionalLights({ type: 'SubViewport', properties: {} } as never)).toBe(false);
  });
});

describe('isListedDirectionalLight', () => {
  const sun = (properties: Record<string, unknown>) => ({ type: 'DirectionalLight2D', properties }) as never;

  it('lists an enabled, shown DirectionalLight2D', () => {
    expect(isListedDirectionalLight(sun({ enabled: true }))).toBe(true);
  });

  it('leaves a disabled or hidden light off the list', () => {
    expect(isListedDirectionalLight(sun({ enabled: false }))).toBe(false);
    expect(isListedDirectionalLight(sun({ enabled: true, visible: false }))).toBe(false);
  });

  it('leaves a PointLight2D off the directional list', () => {
    expect(isListedDirectionalLight({ type: 'PointLight2D', properties: { enabled: true } } as never)).toBe(
      false
    );
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

  async function slots(scene: string, paths: readonly string[]): Promise<(number | null)[]> {
    const seen: (number | null)[] = [];
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(scene));
    await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <CanvasLightSequenceProvider>
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

  it('draws a light the walk never saw at its ordinal', () => {
    expect(lightDrawSequence(null, 9)).toBe(9);
  });

  it('ties a light that is neither listed nor declared at 0', () => {
    expect(lightDrawSequence(null, null)).toBe(0);
  });
});
