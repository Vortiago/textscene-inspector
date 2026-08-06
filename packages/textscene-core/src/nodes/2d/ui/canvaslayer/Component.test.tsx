/**
 * `<CanvasLayer>` render contract: the native (WebGL canvas) painter for
 * `CanvasLayer`. Draws no chrome of its own — it only republishes fresh
 * `CanvasLayerIndexProvider`/`CanvasModulateContext` scopes around its
 * children, mirroring the `CanvasLayer` branch of `NodeDispatcher.tsx`'s
 * `PlainNode` (see that module — this is the same convention, not a second
 * one). Assertions read scene-graph structure only, never pixels, matching
 * `nodes/2d/marker2d/Component.test.tsx`'s style for a
 * react-three-test-renderer suite.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { CanvasLayer } from './Component';
import { parseCanvasLayer } from './parser';
import { EffectiveZProvider, useCanvasLayerIndex, useEffectiveZ } from '../../../../r3f/lighting2d/canvasItemPlacement';
import { CanvasModulateContext, useCanvasModulate } from '../../../../r3f/canvasModulate';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

const ZERO_RECT = { x: 0, y: 0, w: 0, h: 0 };

function canvasModulateChild(color: { r: number; g: number; b: number; a: number }): TscnNode {
  return { name: 'CanvasModulate', type: 'CanvasModulate', children: [], properties: { name: 'CanvasModulate', color } };
}

function layerSolveNode(raw: Record<string, string> = {}, rawChildren: TscnNode[] = []): SolveNode {
  const heading = { type: 'node', attributes: { type: 'CanvasLayer', name: 'HUD' } };
  const properties = parseCanvasLayer(heading, raw);
  const node: TscnNode = { name: 'HUD', type: 'CanvasLayer', children: rawChildren, properties };
  return { path: 'HUD', node, children: [], styleBoxes: {}, textureSize: null, fontOverrides: {}, themeChain: [], projectTheme: null };
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
});
