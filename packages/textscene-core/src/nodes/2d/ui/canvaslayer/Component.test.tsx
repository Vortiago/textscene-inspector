/**
 * `<CanvasLayer>` render contract: it draws no chrome and republishes fresh
 * `CanvasLayerIndexProvider` and `CanvasModulateContext` scopes around its children,
 * as `NodeDispatcher.tsx`'s `PlainNode` does. Structure only, never pixels.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CanvasLayer } from './Component';
import { parseCanvasLayer } from './parser';
import { EffectiveZProvider, useCanvasLayerIndex, useEffectiveZ } from '../../../../r3f/lighting2d/canvasItemPlacement';
import { CanvasModulateContext, useCanvasModulate } from '../../../../r3f/canvasModulate';
import { Modulate2DContext, useParentModulate } from '../../../../r3f/canvasItemModulate';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const ZERO_RECT = { x: 0, y: 0, w: 0, h: 0 };

function canvasModulateChild(color: { r: number; g: number; b: number; a: number }): TscnNode {
  return { name: 'CanvasModulate', type: 'CanvasModulate', children: [], properties: { name: 'CanvasModulate', color } };
}

function layerSolveNode(raw: Record<string, string> = {}, rawChildren: TscnNode[] = []): SolveNode {
  const heading = { type: 'node', attributes: { type: 'CanvasLayer', name: 'HUD' } };
  const properties = parseCanvasLayer(heading, raw);
  const node: TscnNode = { name: 'HUD', type: 'CanvasLayer', children: rawChildren, properties };
  return { ...solveNode(), path: 'HUD', node };
}

function LayerProbe({ testId }: { testId: string }) {
  const layer = useCanvasLayerIndex();
  const modulate = useCanvasModulate();
  return (
    <group name={`probe:${testId}:layer=${layer}:r=${modulate.r}`} />
  );
}

function ZProbe({ testId }: { testId: string }) {
  const z = useEffectiveZ();
  return <group name={`zprobe:${testId}:z=${z}`} />;
}

function ModulateProbe({ testId }: { testId: string }) {
  const m = useParentModulate();
  return <group name={`mprobe:${testId}:r=${m.r}:a=${m.a}`} />;
}

async function renderLayer(raw: Record<string, string> = {}, rawChildren: TscnNode[] = [], testId = 'a') {
  return ReactThreeTestRenderer.create(
    <CanvasLayer {...painterEnv()} solveNode={layerSolveNode(raw, rawChildren)} rect={ZERO_RECT} renderOrder={0}>
      <LayerProbe testId={testId} />
    </CanvasLayer>
  );
}

describe('<CanvasLayer>', () => {
  it("publishes this layer's own `layer` property to CanvasLayerIndexProvider, reaching children", async () => {
    const renderer = await renderLayer({ layer: '5' }, [], 'layer5');
    const probe = renderer.scene.findAllByType('Group').map((g) => g.instance as { name: string })[0]!;
    expect(probe.name).toBe('probe:layer5:layer=5:r=1');
  });

  it("defaults to Godot's own CanvasLayer.layer default (1) when unset", async () => {
    const renderer = await renderLayer({}, [], 'default');
    const probe = renderer.scene.findAllByType('Group').map((g) => g.instance as { name: string })[0]!;
    expect(probe.name).toBe('probe:default:layer=1:r=1');
  });

  it("publishes a fresh CanvasModulateContext scope from this layer's OWN raw children, ignoring an inherited world tint", async () => {
    const ownChild = canvasModulateChild({ r: 0.2, g: 0.4, b: 0.6, a: 1 });
    const renderer = await ReactThreeTestRenderer.create(
      <CanvasModulateContext.Provider value={{ r: 0.9, g: 0.9, b: 0.9, a: 1 }}>
        <CanvasLayer {...painterEnv()} solveNode={layerSolveNode({}, [ownChild])} rect={ZERO_RECT} renderOrder={0}>
          <LayerProbe testId="tint" />
        </CanvasLayer>
      </CanvasModulateContext.Provider>
    );
    const probe = renderer.scene.findAllByType('Group').map((g) => g.instance as { name: string })[0]!;
    expect(probe.name).toBe('probe:tint:layer=1:r=0.2');
  });

  it('draws no chrome of its own — no mesh or line geometry, just the wrapped children', async () => {
    const renderer = await renderLayer({}, [], 'chrome');
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('does not render (nor publish context to) children when visible === false', async () => {
    const renderer = await renderLayer({ visible: 'false' }, [], 'hidden');
    expect(renderer.scene.findAllByType('Group')).toHaveLength(0);
  });

  it(
    "resets EffectiveZProvider to 0 for its children regardless of any ambient z outside the layer " +
      '— a CanvasLayer starts its OWN canvas (renderer_canvas_cull.cpp culls each canvas independently), ' +
      "mirroring NodeDispatcher.tsx's own CanvasLayer branch (`<EffectiveZProvider value={0}>`)",
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <EffectiveZProvider value={999}>
          <CanvasLayer {...painterEnv()} solveNode={layerSolveNode({}, [])} rect={ZERO_RECT} renderOrder={0}>
            <ZProbe testId="reset" />
          </CanvasLayer>
        </EffectiveZProvider>
      );
      const probe = renderer.scene.findAllByType('Group').map((g) => g.instance as { name: string })[0]!;
      expect(probe.name).toBe('zprobe:reset:z=0');
    }
  );

  it(
    "resets Modulate2DContext to opaque white — an ancestor's `modulate` does NOT reach into a CanvasLayer subtree " +
      '(CanvasLayer derives from Node, so `CanvasItem::get_parent_item()` returns null under it, ' +
      "`scene/main/canvas_item.cpp:565`; the child parents to the layer's own canvas RID, `canvas_item.cpp:264,269`, " +
      'whose root items are seeded pure white, `servers/rendering/renderer_canvas_cull.cpp:82`)',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }}>
          <CanvasLayer {...painterEnv()} solveNode={layerSolveNode({}, [])} rect={ZERO_RECT} renderOrder={0}>
            <ModulateProbe testId="reset" />
          </CanvasLayer>
        </Modulate2DContext.Provider>
      );
      const probe = renderer.scene.findAllByType('Group').map((g) => g.instance as { name: string })[0]!;
      expect(probe.name).toBe('mprobe:reset:r=1:a=1');
    }
  );
});
