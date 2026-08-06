/**
 * `<ControlCanvasWalker>` solves `tree` (from `buildSolveTree`, but this
 * suite feeds it `SolveNode` literals directly — the same isolation
 * `controlRectSolver.test.ts` uses — so it stays a seam test of the WALKER,
 * not a re-test of the solve or the live-tree walk) and emits one named
 * `<group>` per Control, positioned at its solved rect. Assertions read only
 * scene-graph structure (names/positions/visibility/rotation), never pixels —
 * this is a happy-dom-free but still non-visual test.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn } from './solverRegistry';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { bandBase } from './controlDrawOrder';
import { controlComponentRegistry, type NativeControlComponent } from '../ControlComponentRegistry';
import { CanvasLayerIndexProvider, CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN, useEffectiveZ } from '../../lighting2d/canvasItemPlacement';
import { solveNode as emptySolveNode } from './testing/solveNode';

// A stand-in for the real `canvaslayer/Component.tsx` (a different
// slice's file, not this suite's concern): just enough to prove the WALKER
// threads `children` through the painter and republishes
// `CanvasLayerIndexProvider` for a `CanvasLayer` type, without depending on
// that slice's own implementation.
const StubCanvasLayerNative: NativeControlComponent = ({ solveNode, children }) => {
  const layer = (solveNode.node.properties as { layer?: number }).layer ?? 1;
  return <CanvasLayerIndexProvider value={layer}>{children}</CanvasLayerIndexProvider>;
};

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(
  path: string,
  type: string,
  properties: Record<string, unknown>,
  children: SolveNode[] = []
): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  return { ...emptySolveNode(), path, node: tscnNode, children };
}

function HiddenPathSeeder({ paths }: { paths: readonly string[] }) {
  const { toggleHidden } = useSelection();
  useEffect(() => {
    for (const p of paths) toggleHidden(p);
  }, [paths, toggleHidden]);
  return null;
}

interface WrapperInstance {
  name: string;
  visible: boolean;
  position: { x: number; y: number; z: number };
  rotation: { z: number };
}

function namedGroup(scene: { findAllByType: (t: string) => { instance: WrapperInstance }[] }, name: string) {
  return scene.findAllByType('Group').map((g) => g.instance).find((g) => g.name === name) ?? null;
}

describe('<ControlCanvasWalker>', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
    controlComponentRegistry.clear();
  });

  it('emits one named group per Control, at its solved rect (Godot pixels, +Y down → three -y)', async () => {
    // anchors all 0 → rect = offsets directly: x=100,y=50,w=80,h=40.
    const root = solveNode('Root', 'TestType', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 100,
      offsetTop: 50,
      offsetRight: 180,
      offsetBottom: 90,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const group = namedGroup(renderer.scene, 'TestType:Root');
    expect(group).not.toBeNull();
    expect(group!.position.x).toBeCloseTo(100);
    expect(group!.position.y).toBeCloseTo(-50);
  });

  it('a nested child solves relative to its parent rect and positions accordingly', async () => {
    const child = solveNode('Root/Child', 'TestType', { anchorsPreset: 15 }); // FULL_RECT of the parent
    const root = solveNode(
      'Root',
      'TestType',
      { anchorLeft: 0, anchorTop: 0, anchorRight: 0, anchorBottom: 0, offsetLeft: 100, offsetTop: 50, offsetRight: 180, offsetBottom: 90 },
      [child]
    );

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const childGroup = namedGroup(renderer.scene, 'TestType:Child');
    expect(childGroup).not.toBeNull();
    expect(childGroup!.position.x).toBeCloseTo(0);
    expect(childGroup!.position.y).toBeCloseTo(0);
  });

  it('honours visible === false on the node itself', async () => {
    const hidden = solveNode('Hidden', 'TestType', { anchorsPreset: 15, visible: false });
    const shown = solveNode('Shown', 'TestType', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[hidden, shown]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    expect(namedGroup(renderer.scene, 'TestType:Hidden')!.visible).toBe(false);
    expect(namedGroup(renderer.scene, 'TestType:Shown')!.visible).toBe(true);
  });

  it('skips a node whose path is in SelectionContext.hiddenNodePaths', async () => {
    const child = solveNode('Root/Box', 'TestType', { anchorsPreset: 15 });
    const root = solveNode('Root', 'TestType', { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <HiddenPathSeeder paths={['Root/Box']} />
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      </SelectionProvider>
    );

    expect(namedGroup(renderer.scene, 'TestType:Root')!.visible).toBe(true);
    expect(namedGroup(renderer.scene, 'TestType:Box')!.visible).toBe(false);
  });

  it('draws a fallback outline sized to the solved rect for a type with no Native painter', async () => {
    const root = solveNode('Root', 'UnregisteredType', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 64,
      offsetBottom: 32,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const lines = renderer.scene.findAllByType('LineSegments');
    expect(lines).toHaveLength(1);
    const geometry = (lines[0]!.instance as THREE.LineSegments).geometry as { boundingBox: { max: { x: number; y: number }; min: { x: number; y: number } } | null; computeBoundingBox: () => void };
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(64);
    expect(box.max.y - box.min.y).toBeCloseTo(32);
  });

  it("applies a free Control's own rotation on an inner group about its pivot", async () => {
    const root = solveNode('Root', 'TestType', { anchorsPreset: 15, rotation: Math.PI / 2 });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance);
    // Godot's rotation is conjugated (negated) the same way Node2D's is
    // (node2dTransform.ts) — clockwise-positive in Y-down space.
    expect(groups.some((g) => Math.abs(g.rotation.z - -(Math.PI / 2)) < 1e-9)).toBe(true);
  });

  it("a container's child ignores its own rotation/scale (Container::fit_child_in_rect resets it)", async () => {
    const TYPE = 'TestWalkerContainer';
    const stack: ContainerLayoutFn = (_n, children, contentRect) => {
      const out = new Map<string, Rect2>();
      children.forEach((c) => out.set(c.node.path, contentRect));
      return out;
    };
    controlSolverRegistry.registerContainerLayout(TYPE, stack);

    const child = solveNode('Stack/Child', 'TestType', { anchorsPreset: 15, rotation: Math.PI / 4, scale: { x: 2, y: 2 } });
    const root = solveNode('Stack', TYPE, { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance);
    expect(groups.every((g) => g.rotation.z === 0)).toBe(true);
  });

  it("assigns a fallback painter's renderOrder from bandBase(0) plus its solved paintIndex, with no enclosing CanvasLayer", async () => {
    const child = solveNode('Root/Child', 'TestType', { anchorsPreset: 15 });
    const root = solveNode('Root', 'TestType', { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    // Pre-order, so Root gets paintIndex 0 and Child gets paintIndex 1.
    expect(lines.some((l) => l.renderOrder === bandBase(0) + 0)).toBe(true);
    expect(lines.some((l) => l.renderOrder === bandBase(0) + 1)).toBe(true);
  });

  it('bands every Control under a CanvasLayer by its layer property, reaching arbitrarily nested descendants', async () => {
    controlComponentRegistry.register({
      typeName: 'CanvasLayer',
      Component: StubCanvasLayerNative,
      // The walker places children as siblings unless the registration opts in.
      wrapsChildren: true,
    });
    const grandchild = solveNode('Layer/Child/Grandchild', 'TestType', { anchorsPreset: 15 });
    const child = solveNode('Layer/Child', 'TestType', { anchorsPreset: 15 }, [grandchild]);
    const layer = solveNode('Layer', 'CanvasLayer', { layer: 5 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[layer]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    expect(lines.some((l) => l.renderOrder === bandBase(5) + 1)).toBe(true);
    expect(lines.some((l) => l.renderOrder === bandBase(5) + 2)).toBe(true);
  });

  it('gives a negative-layer CanvasLayer a band below the world default, still reaching its Control', async () => {
    controlComponentRegistry.register({
      typeName: 'CanvasLayer',
      Component: StubCanvasLayerNative,
      // The walker places children as siblings unless the registration opts in.
      wrapsChildren: true,
    });
    const child = solveNode('Layer/Child', 'TestType', { anchorsPreset: 15 });
    const layer = solveNode('Layer', 'CanvasLayer', { layer: -1 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[layer]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    expect(lines.some((l) => l.renderOrder === bandBase(-1) + 1)).toBe(true);
    expect(lines.some((l) => l.renderOrder < 0)).toBe(true);
  });

  it("hands the painter subtreeChromeRenderOrder derived from the solved subtreeLastPaintIndex — the deepest descendant's own renderOrder, one less than the next sibling's", async () => {
    controlComponentRegistry.register({
      typeName: 'TestOrderType',
      Component: ({ subtreeChromeRenderOrder }) => (
        <group name="order-probe" renderOrder={subtreeChromeRenderOrder ?? -1} />
      ),
    });
    const grandchild = solveNode('Root/Child/Grandchild', 'TestType', { anchorsPreset: 15 });
    const child = solveNode('Root/Child', 'TestType', { anchorsPreset: 15 }, [grandchild]);
    const root = solveNode('Root', 'TestOrderType', { anchorsPreset: 15 }, [child]);
    const sibling = solveNode('Sibling', 'TestType', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root, sibling]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const probe = renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance as { name: string; renderOrder: number })
      .find((g) => g.name === 'order-probe')!;
    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    // Fallback lines for the unregistered descendants/sibling: Child=1,
    // Grandchild=2 (both under Root's TestOrderType painter), Sibling=3.
    const grandchildOrder = bandBase(0) + 2;
    const siblingOrder = bandBase(0) + 3;
    expect(lines.some((l) => l.renderOrder === grandchildOrder)).toBe(true);
    expect(lines.some((l) => l.renderOrder === siblingOrder)).toBe(true);
    // Root's own subtree's last paint index is Grandchild's — same value —
    // and exactly one less than the next sibling's own paintIndex.
    expect(probe.renderOrder).toBe(grandchildOrder);
    expect(probe.renderOrder).toBe(siblingOrder - 1);
  });

  it('leaves every Control group at z=0 regardless of CanvasLayer nesting — paint order comes from renderOrder alone', async () => {
    const child = solveNode('Layer/Child', 'TestType', { anchorsPreset: 15 });
    const layer = solveNode('Layer', 'CanvasLayer', { layer: 3 }, [child]);
    const bare = solveNode('Bare', 'TestType', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[layer, bare]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { position: { z: number } });
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.position.z === 0)).toBe(true);
  });

  describe('EffectiveZProvider (Light2D culling z_final)', () => {
    // Reports the ambient `useEffectiveZ()` it reads — i.e. the accumulated
    // `z_final` its OWN parent published — encoded in its group's name rather
    // than a closure, matching `canvaslayer/Component.test.tsx`'s `LayerProbe`
    // convention (a hook can only be called from a real component).
    const ZProbe: NativeControlComponent = () => <group name={`ZProbe:z=${useEffectiveZ()}`} />;

    function zProbeReading(renderer: { scene: { findAllByType: (t: string) => { instance: { name: string } }[] } }): number {
      const probe = renderer.scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .find((g) => g.name.startsWith('ZProbe:z='))!;
      return Number(probe.name.slice('ZProbe:z='.length));
    }

    it("gives a bare Control's child an ambient z of 0 — no ancestor z_index, no CanvasLayer", async () => {
      controlComponentRegistry.register({ typeName: 'ZProbe', Component: ZProbe });
      const probe = solveNode('Root/Probe', 'ZProbe', {});
      const root = solveNode('Root', 'TestType', { anchorsPreset: 15 }, [probe]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      expect(zProbeReading(renderer)).toBe(0);
    });

    it("accumulates a Control's own authored z_index onto the ambient for its child", async () => {
      controlComponentRegistry.register({ typeName: 'ZProbe', Component: ZProbe });
      const probe = solveNode('Root/Probe', 'ZProbe', {});
      const root = solveNode('Root', 'TestType', { anchorsPreset: 15, zIndex: 7 }, [probe]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      expect(zProbeReading(renderer)).toBe(7);
    });

    it('accumulates z_index down a nested Control chain, exactly like Node2D (accumulateCanvasItemZ)', async () => {
      controlComponentRegistry.register({ typeName: 'ZProbe', Component: ZProbe });
      const probe = solveNode('A/B/Probe', 'ZProbe', {});
      const b = solveNode('A/B', 'TestType', { anchorsPreset: 15, zIndex: 3 }, [probe]);
      const a = solveNode('A', 'TestType', { anchorsPreset: 15, zIndex: 5 }, [b]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[a]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      expect(zProbeReading(renderer)).toBe(8);
    });

    it('reaches a Control nested inside a wrapsChildren painter (e.g. CanvasLayer) without losing accumulation', async () => {
      controlComponentRegistry.register({ typeName: 'ZProbe', Component: ZProbe });
      controlComponentRegistry.register({
        typeName: 'CanvasLayer',
        Component: StubCanvasLayerNative,
        wrapsChildren: true,
      });
      const probe = solveNode('Layer/Child/Probe', 'ZProbe', {});
      const child = solveNode('Layer/Child', 'TestType', { anchorsPreset: 15, zIndex: 4 }, [probe]);
      const layer = solveNode('Layer', 'CanvasLayer', { layer: 5 }, [child]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[layer]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      expect(zProbeReading(renderer)).toBe(4);
    });

    it("clamps the accumulated z_final to Godot's canvas-item range while the authored z_index property itself stays unclamped", async () => {
      controlComponentRegistry.register({ typeName: 'ZProbe', Component: ZProbe });
      const highProbe = solveNode('High/Probe', 'ZProbe', {});
      const high = solveNode('High', 'TestType', { anchorsPreset: 15, zIndex: 9000 }, [highProbe]);

      const highRenderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[high]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );
      expect(zProbeReading(highRenderer)).toBe(CANVAS_ITEM_Z_MAX);
      // The hint range (`PROPERTY_HINT_RANGE`) is a slider clamp, not a setter
      // guard — `CanvasItem::set_z_index` never rejects/clamps a value, so the
      // authored property itself is untouched by the accumulation's own clamp.
      expect((high.node.properties as { zIndex?: number }).zIndex).toBe(9000);

      const lowProbe = solveNode('Low/Probe', 'ZProbe', {});
      const low = solveNode('Low', 'TestType', { anchorsPreset: 15, zIndex: -9000 }, [lowProbe]);

      const lowRenderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[low]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );
      expect(zProbeReading(lowRenderer)).toBe(CANVAS_ITEM_Z_MIN);
    });

    it("hands a painter its OWN z_final by prop, where the ambient context is its parent's", async () => {
      // These two deliberately disagree, and the gap is the whole point.
      // Godot attaches an item for draw at its own accumulated z:
      // `_cull_canvas_item` folds `ci->z_index` into `p_z` and only then calls
      // `_attach_canvas_item_for_draw(ci, …, p_z, …)`
      // (`servers/rendering/renderer_canvas_cull.cpp`). The context exists to
      // seed this node's DESCENDANTS, so it still reads the parent's value
      // here — and `useCanvasItemLighting`'s own `effectiveZ` fallback reads
      // exactly that context. A painter that leaned on the fallback would
      // silently drop its own `z_index` and light at the wrong z window.
      const PropProbe: NativeControlComponent = ({ effectiveZ }) => (
        <group name={`zprop:prop=${effectiveZ},ambient=${useEffectiveZ()}`} />
      );
      controlComponentRegistry.register({ typeName: 'PropProbe', Component: PropProbe });

      const probe = solveNode('Root/Probe', 'PropProbe', { zIndex: 4 });
      const root = solveNode('Root', 'TestType', { anchorsPreset: 15, zIndex: 5 }, [probe]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      const name = renderer.scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .find((g) => g.name.startsWith('zprop:'))!.name;

      expect(name).toBe('zprop:prop=9,ambient=5');
    });
  });
});
