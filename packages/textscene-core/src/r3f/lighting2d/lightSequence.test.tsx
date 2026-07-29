/**
 * A light's DRAW order is its scene-tree position, not its registration order.
 *
 * Godot applies a canvas's lights in attach order — the preorder walk of the
 * effective tree — and `light_blend_compute`'s MIX is order-dependent:
 *
 *   MIX: color.rgb = mix(color.rgb, light_color.rgb, light_color.a)
 *
 * so two overlapping MIX lights give a different colour depending which is
 * applied second. Registration order is not tree order: `freeOrdinal` hands out
 * the LOWEST free slot, and a light registers when its cookie resolves — an
 * inline `GradientTexture2D` resolves in the same tick, a `res://` PNG does not.
 * So a tree-earlier light can register second.
 *
 * These drive the LIVE-tree path the renderer actually uses, rather than a pure
 * walk over the authored tree. The two are not the same walk: the live tree
 * composes instanced sub-scenes into one path space (ADR-0013), so a light
 * inside an instance is numbered where the instance sits. Testing the authored
 * walk would pin a derivation nothing executes.
 */

import { describe, it, expect } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider } from './CanvasLighting2D';
import { litQuadRenderOrder } from './ShadowVolumeMask';
import { isPositionalCanvasLight } from './lightSequence';
import { CanvasLightSequenceProvider, useLightSequence } from './useLightSequence';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import '../nodes'; // side-effect: registers every node's r3f component

const COOKIE = 'res://light.png';

async function render(body: string) {
  const tscn = `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[node name="Root" type="Node2D"]
${body}`;
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const cookie = new THREEStub();
  fake.textures.seed(COOKIE, cookie as never);

  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
              <NodeDispatcher nodes={parsed.nodes} />
            </CanvasLighting2DProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

/** A stand-in texture with the `image` dimensions the quad reads. */
class THREEStub {
  image = { width: 64, height: 64 };
  isTexture = true;
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

  it('claims none for a DirectionalLight2D, which has no cookie quad in this pass', () => {
    // Numbering it would leave a hole the 2n / 2n+1 pairing spends for nothing.
    expect(isPositionalCanvasLight({ type: 'DirectionalLight2D' } as never)).toBe(false);
  });

  it('claims none for an ordinary canvas item', () => {
    expect(isPositionalCanvasLight({ type: 'Sprite2D' } as never)).toBe(false);
  });
});

/**
 * The provider is what makes the numbering a property of the CANVAS: it walks
 * once and every light reads the result. These drive it directly rather than
 * through the dispatcher, because the dispatcher cases above cannot tell a
 * sequence from an ordinal — with every cookie resolving in the same tick the
 * two numbers coincide, which is the whole reason the walk exists.
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

  function Probe({ path, ordinal, seen }: { path: string; ordinal: number; seen: number[] }) {
    return (
      <NodePathProvider path={path}>
        <Read ordinal={ordinal} seen={seen} />
      </NodePathProvider>
    );
  }

  function Read({ ordinal, seen }: { ordinal: number; seen: number[] }) {
    seen.push(useLightSequence(ordinal));
    return null;
  }

  async function sequences(paths: readonly string[], ordinal = 99): Promise<number[]> {
    const seen: number[] = [];
    const sceneGraph = createSceneGraphFromTscnScene(new TscnParser().parse(SCENE));
    await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph, panelId: 'p' }}>
        <CanvasLightSequenceProvider>
          {paths.map((path) => (
            <Probe key={path} path={path} ordinal={ordinal} seen={seen} />
          ))}
        </CanvasLightSequenceProvider>
      </HierarchyProvider>
    );
    return seen;
  }

  it('numbers the canvas light list in preorder, whatever ordinal a light was given', async () => {
    // Every probe passes ordinal 99, so a returned 0/1/2 can only have come from
    // the walk. `Mid/B` is deeper than `C` but earlier in preorder.
    expect(await sequences(['Root/A', 'Root/Mid/B', 'Root/C'])).toEqual([0, 1, 2]);
  });

  it('is dense across an unlit tree, so the pairing spends no empty slots', async () => {
    // `Prop` is a Sprite2D between two lights and takes no slot.
    expect(await sequences(['Root/C'])).toEqual([2]);
  });

  it('falls back to the ordinal for a path the walk never saw', async () => {
    expect(await sequences(['Root/Nowhere'], 7)).toEqual([7]);
  });

  it('falls back to the ordinal with no canvas provider at all', async () => {
    const seen: number[] = [];
    await ReactThreeTestRenderer.create(<Probe path="Root/A" ordinal={4} seen={seen} />);
    expect(seen).toEqual([4]);
  });
});

describe('light draw order over the live tree', () => {
  it('numbers lights in preorder, so a deeper earlier light precedes a shallower later one', async () => {
    //   Root
    //    ├ A          seq 0
    //    ├ Mid
    //    │  └ B       seq 1 — deeper, but earlier in preorder than C
    //    └ C          seq 2
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
