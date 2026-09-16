/**
 * `<ControlCanvasWalker>` solves `tree` (from `buildSolveTree`, but this
 * suite feeds it `SolveNode` literals directly — the same isolation
 * `controlRectSolver.test.ts` uses — so it stays a seam test of the WALKER,
 * not a re-test of the solve or the live-tree walk) and emits one named
 * `<group>` per Control, positioned at its solved rect. Assertions read only
 * scene-graph structure (names/positions/visibility/rotation), never pixels —
 * this is a happy-dom-free but still non-visual test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn } from './solverRegistry';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { canvasRenderOrder, layerRankOf, layerRanks } from '../../canvasPaintOrder';
import { LayerRanksProvider } from '../../contexts/PaintOrderContext';
import { withPaintRanges } from './testing/solveNode';
import { controlComponentRegistry, type NativeControlComponent } from '../ControlComponentRegistry';
import { CanvasLayerIndexProvider, CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN, useEffectiveZ } from '../../lighting2d/canvasItemPlacement';
import { Modulate2DContext, useParentModulate } from '../../canvasItemModulate';
import { solveNode as emptySolveNode } from './testing/solveNode';

/** The world canvas's rank — derived, never hardcoded: only a rank's ORDER
  * is meaningful, and spacing them for undeclared layers moved the value. */
const WORLD_RANK = layerRankOf(layerRanks([]), 0);

// A stand-in for the real `canvaslayer/Component.tsx` (a different
// slice's file, not this suite's concern): just enough to prove the WALKER
// threads `children` through the painter and republishes
// `CanvasLayerIndexProvider` for a `CanvasLayer` type, without depending on
// that slice's own implementation.
const StubCanvasLayerNative: NativeControlComponent = ({ solveNode, children }) => {
  const layer = (solveNode.node.properties as { layer?: number }).layer ?? 1;
  return <CanvasLayerIndexProvider value={layer}>{children}</CanvasLayerIndexProvider>;
};

// The walker reads `gui/common/snap_controls_to_pixels` off the project
// settings; nothing else here needs the real provider's async load.
const projectSettingsMock = vi.hoisted(() => ({
  settings: null as Record<string, string> | null,
  viewportSize: { width: 1152, height: 648 },
  themeScale: 1,
}));

vi.mock('../../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => projectSettingsMock,
}));

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
    projectSettingsMock.settings = null;
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

  it("honours a HIDDEN skipped Node2D ancestor — the Control's own `visible` is only half of `is_visible_in_tree`", async () => {
    // `visible && parent_visible_in_tree` (canvas_item.cpp:62-64). A skipped
    // Node2D contributes no group of its own, so without the solve's
    // `skippedAncestors.visible` a Control under a hidden Node2D would draw.
    const identity = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    const white = { r: 1, g: 1, b: 1, a: 1 };
    const promoted: SolveNode = {
      ...solveNode('Promoted', 'TestType', { anchorsPreset: 15 }),
      skippedAncestors: { transform: identity, visible: false, modulate: white },
    };
    const shown: SolveNode = {
      ...solveNode('Shown', 'TestType', { anchorsPreset: 15 }),
      skippedAncestors: { transform: identity, visible: true, modulate: white },
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[promoted, shown]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    expect(namedGroup(renderer.scene, 'TestType:Promoted')!.visible).toBe(false);
    expect(namedGroup(renderer.scene, 'TestType:Shown')!.visible).toBe(true);
  });

  it('skips a node the tree marks hidden', async () => {
    // The eye toggle reaches this walk as `SolveNode.hidden`, stamped by
    // `buildSolveTree` so the SOLVE sees the same value — a second read of
    // `SelectionContext` here could disagree with the rect the container laid
    // out. `buildSolveTree.test.tsx` covers the stamping itself.
    const child = { ...solveNode('Root/Box', 'TestType', { anchorsPreset: 15 }), hidden: true };
    const root = solveNode('Root', 'TestType', { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
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

  it('composes a promoted Control’s OWN rotation with its `skippedAncestors` transform — never double-applying, never disagreeing on direction/origin', async () => {
    // Node2D ancestor: rotation=PI/2 at (100,0) — core/math/transform_2d.h:
    // 249-254 (rot=PI/2, scale=(1,1), skew=0): a=0,b=1,c=-1,d=0.
    const ancestorTransform = {
      a: Math.cos(Math.PI / 2),
      b: Math.sin(Math.PI / 2),
      c: -Math.sin(Math.PI / 2),
      d: Math.cos(Math.PI / 2),
      tx: 100,
      ty: 0,
    };
    // rect (10,0,20,20): anchors 0, offsets (10,0,30,20). The Control's own
    // rotation=PI/2 turns about its pivot (default (0,0), i.e. its own
    // top-left) BEFORE the ancestor's transform is applied outside it.
    const root: SolveNode = {
      ...solveNode('Root', 'TestType', {
        anchorLeft: 0,
        anchorTop: 0,
        anchorRight: 0,
        anchorBottom: 0,
        offsetLeft: 10,
        offsetTop: 0,
        offsetRight: 30,
        offsetBottom: 20,
        rotation: Math.PI / 2,
      }),
      skippedAncestors: { transform: ancestorTransform, visible: true, modulate: { r: 1, g: 1, b: 1, a: 1 } },
    };

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    // `ControlFallback` draws its outline at the rect's own CENTER, local
    // (rect.w/2, -rect.h/2, 0) = (10, -10, 0) — a fixed, known point this
    // test can hand-trace through both transforms:
    //   1. own rotation (three rotation.z = -PI/2) about (0,0):
    //      (10,-10) -> (-10,-10)
    //   2. own group's rect-origin translation (10, 0):
    //      (-10,-10) -> (0,-10)
    //   3. ancestor's conjugated matrix (a=0,b=1,c=-1,d=0,tx=100,ty=0),
    //      `ancestorGroupMatrix`: x' = a*x - c*y + tx = 0*0 - (-1)*(-10) + 100 = 90
    //                             y' = -b*x + d*y - ty = -1*0 + 0*(-10) - 0 = 0
    //      (0,-10) -> (90, 0)
    // A rotation applied the wrong DIRECTION or about the wrong ORIGIN lands
    // somewhere else entirely, not merely off by a rounding error.
    // `updateMatrixWorld` (not `updateWorldMatrix`, which does not climb to
    // parents here) recomputes top-down from the scene, cascading into every
    // descendant — including the ancestor wrapper this test exists to check.
    (renderer.scene as unknown as { instance: THREE.Object3D }).instance.updateMatrixWorld(true);
    const outline = renderer.scene.findAllByType('LineSegments')[0]!.instance as THREE.Object3D;
    const p = new THREE.Vector3().setFromMatrixPosition(outline.matrixWorld);
    expect(p.x).toBeCloseTo(90, 9);
    expect(p.y).toBeCloseTo(0, 9);
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

  it("takes each Control's renderOrder from the shared canvas key at its own draw sequence", async () => {
    const child = solveNode('Root/Child', 'TestType', { anchorsPreset: 15 });
    const root = solveNode('Root', 'TestType', { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker
        tree={withPaintRanges([root])}
        generation={0}
        viewport={VIEWPORT}
        theme={THEME}
        measurer={null}
      />
    );

    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    // The SAME key a Node2D canvas item takes — no band of its own, which is
    // what lets a Control interleave with the world rather than sit above it.
    // Pre-order: Root draws at the first sequence in its run, Child at the next.
    const at = (sequence: number) => canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 0, sequence });
    expect(lines.some((l) => l.renderOrder === at(1))).toBe(true);
    expect(lines.some((l) => l.renderOrder === at(2))).toBe(true);
  });

  it('puts every Control under a CanvasLayer on that layer, reaching arbitrarily nested descendants', async () => {
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
      <LayerRanksProvider value={layerRanks([5])}>
        <ControlCanvasWalker
          tree={withPaintRanges([layer])}
          generation={0}
          viewport={VIEWPORT}
          theme={THEME}
          measurer={null}
        />
      </LayerRanksProvider>
    );

    const lines = renderer.scene
      .findAllByType('LineSegments')
      .map((l) => (l.instance as { renderOrder: number }).renderOrder);
    const onLayer = (sequence: number) =>
      canvasRenderOrder({ layerRank: layerRankOf(layerRanks([5]), 5), zFinal: 0, sequence });
    // BOTH descendants reach the layer — the nested Grandchild as much as the
    // Child — and at CONSECUTIVE sequences, which is what "arbitrarily nested"
    // means here. Asserting only "above the world" would hold for ANY sequence,
    // including one that dropped the Grandchild entirely: every rank-5 key
    // already exceeds every world key by construction.
    expect(lines).toContain(onLayer(2));
    expect(lines).toContain(onLayer(3));
    // …and the layer as a whole still sits above the world canvas.
    const worldCeiling = canvasRenderOrder({
      layerRank: layerRankOf(layerRanks([5]), 0),
      zFinal: CANVAS_ITEM_Z_MAX,
      sequence: 0,
    });
    expect(lines.every((order) => order > worldCeiling)).toBe(true);
  });

  it('draws a negative-layer CanvasLayer under the world canvas, still reaching its Control', async () => {
    controlComponentRegistry.register({
      typeName: 'CanvasLayer',
      Component: StubCanvasLayerNative,
      // The walker places children as siblings unless the registration opts in.
      wrapsChildren: true,
    });
    const child = solveNode('Layer/Child', 'TestType', { anchorsPreset: 15 });
    const layer = solveNode('Layer', 'CanvasLayer', { layer: -1 }, [child]);
    const worldSide = solveNode('WorldSide', 'TestType', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(
      <LayerRanksProvider value={layerRanks([-1])}>
        <ControlCanvasWalker
          tree={withPaintRanges([layer, worldSide])}
          generation={0}
          viewport={VIEWPORT}
          theme={THEME}
          measurer={null}
        />
      </LayerRanksProvider>
    );

    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    // Godot's `layer < 0` draws BEFORE the world canvas — and it is the LAYER
    // that decides, not the draw sequence: the Control on layer -1 comes first
    // in the tree here, but so would a layer -1 Control authored last.
    const worldFloor = canvasRenderOrder({
      layerRank: layerRankOf(layerRanks([-1]), 0),
      zFinal: CANVAS_ITEM_Z_MIN,
      sequence: 0,
    });
    expect(lines.some((l) => l.renderOrder < worldFloor)).toBe(true);
    expect(lines.some((l) => l.renderOrder >= worldFloor)).toBe(true);
  });

  it("hands the painter subtreeChromeRenderOrder from the END of its own draw-sequence run — the deepest descendant's own renderOrder, one less than the next sibling's", async () => {
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
      <ControlCanvasWalker
        tree={withPaintRanges([root, sibling])}
        generation={0}
        viewport={VIEWPORT}
        theme={THEME}
        measurer={null}
      />
    );

    const probe = renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance as { name: string; renderOrder: number })
      .find((g) => g.name === 'order-probe')!;
    const lines = renderer.scene.findAllByType('LineSegments').map((l) => l.instance as { renderOrder: number });
    // Root's run covers Root, Child and Grandchild; the next sibling starts one
    // past its end. So the chrome slot is the run's LAST value, which is both
    // the deepest descendant's own and exactly one below the sibling's.
    const at = (sequence: number) => canvasRenderOrder({ layerRank: WORLD_RANK, zFinal: 0, sequence });
    const grandchildOrder = at(3);
    const siblingOrder = at(4);
    expect(lines.some((l) => l.renderOrder === grandchildOrder)).toBe(true);
    expect(lines.some((l) => l.renderOrder === siblingOrder)).toBe(true);
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

  describe('own-pixel tint handed to the painter', () => {
    // Reports the tint it was GIVEN alongside the ambient it could have read,
    // in its group's name — the `zprop:` convention above. A painter resolving
    // its own tint is the arrangement this prop replaces.
    const TintProbe: NativeControlComponent = ({ tint }) => (
      <group name={`tint:own=${tint.own.r},alpha=${tint.own.a},ambient=${useParentModulate().r}`} />
    );

    function tintReading(renderer: { scene: { findAllByType: (t: string) => { instance: { name: string } }[] } }): string {
      return renderer.scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .find((g) => g.name.startsWith('tint:'))!.name;
    }

    async function renderProbe(properties: Record<string, unknown>, ambient?: { r: number; g: number; b: number; a: number }) {
      controlComponentRegistry.register({ typeName: 'TintProbe', Component: TintProbe });
      const root = solveNode('Root', 'TintProbe', { anchorsPreset: 15, ...properties });
      const walker = (
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );
      return ReactThreeTestRenderer.create(
        ambient ? <Modulate2DContext.Provider value={ambient}>{walker}</Modulate2DContext.Provider> : walker
      );
    }

    it('defaults to opaque white when neither tint property is authored', async () => {
      expect(tintReading(await renderProbe({}))).toBe('tint:own=1,alpha=1,ambient=1');
    });

    it("multiplies the ambient by self_modulate — 0.25, never the ambient folded twice at 0.125", async () => {
      // The 0.5 is AMBIENT, not this node's `modulate`: authoring it as
      // `modulate` would read 0.25 under a walker that folds the ambient twice
      // as well, and pin nothing.
      const name = await renderProbe({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } }, {
        r: 0.5,
        g: 0.5,
        b: 0.5,
        a: 0.5,
      }).then(tintReading);
      expect(name).toBe('tint:own=0.25,alpha=0.25,ambient=0.5');
    });

    it("carries this node's OWN modulate into its own pixels, once — Godot's `_cull_canvas_item` chain", async () => {
      // `renderer_canvas_cull.cpp` folds `ci->modulate` into the inherited
      // value and draws the item at that × `ci->self_modulate`, so a node's own
      // `modulate` tints its own chrome as well as its descendants'.
      const name = await renderProbe(
        {
          modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
          selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
        },
        { r: 0.5, g: 0.5, b: 0.5, a: 0.5 }
      ).then(tintReading);
      expect(name).toBe('tint:own=0.125,alpha=0.125,ambient=0.25');
    });

    it('converts the composed sRGB product to linear exactly once', async () => {
      controlComponentRegistry.register({
        typeName: 'LinearProbe',
        Component: ({ tint }) => <group name={`linear:${tint.color.r},${tint.opacity}`} />,
      });
      const root = solveNode('Root', 'LinearProbe', {
        anchorsPreset: 15,
        selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      });
      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );
      const name = renderer.scene
        .findAllByType('Group')
        .map((g) => g.instance)
        .find((g) => g.name.startsWith('linear:'))!.name;
      const expected = new THREE.Color().setRGB(0.5, 0.5, 0.5, THREE.SRGBColorSpace);
      expect(name).toBe(`linear:${expected.r},0.5`);
    });
  });

  // `Control::_update_canvas_item_transform` floors the canvas item's
  // translation to whole pixels; the solved rect keeps full precision.
  describe('whole-pixel snap of the drawn origin', () => {
    function freeAt(x: number, y: number, extra: Record<string, unknown> = {}): SolveNode {
      return solveNode('Root', 'TestType', {
        anchorLeft: 0,
        anchorTop: 0,
        anchorRight: 0,
        anchorBottom: 0,
        offsetLeft: x,
        offsetTop: y,
        offsetRight: x + 80,
        offsetBottom: y + 40,
        ...extra,
      });
    }

    async function rootPosition(node: SolveNode, snapToPixels?: boolean) {
      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker
          tree={[node]}
          generation={0}
          viewport={VIEWPORT}
          theme={THEME}
          measurer={null}
          snapToPixels={snapToPixels}
        />
      );
      return namedGroup(renderer.scene, 'TestType:Root')!.position;
    }

    it('floors a fractional origin the way Godot does — `(xform[2] + Vector2(0.5, 0.5)).floor()`', async () => {
      const position = await rootPosition(freeAt(516.5, 306.5));

      expect(position.x).toBeCloseTo(517);
      expect(position.y).toBeCloseTo(-307);
    });

    it('floors in Godot +Y-down space, negating only afterwards (a negated floor would give -306)', async () => {
      // floor(-0.6 + 0.5) = -1 on BOTH axes in Godot space; the emitted
      // three-space y is the negation of that, +1.
      const position = await rootPosition(freeAt(-0.6, -0.6));

      expect(position.x).toBeCloseTo(-1);
      expect(position.y).toBeCloseTo(1);
    });

    it('leaves an already-whole origin untouched', async () => {
      const position = await rootPosition(freeAt(100, 50));

      expect(position.x).toBeCloseTo(100);
      expect(position.y).toBeCloseTo(-50);
    });

    it('still snaps at a rotation that is a multiple of 45° (sin(rotation * 4) vanishes)', async () => {
      const position = await rootPosition(freeAt(10.5, 20.5, { rotation: Math.PI / 4 }));

      expect(position.x).toBeCloseTo(11);
      expect(position.y).toBeCloseTo(-21);
    });

    it('does NOT snap at a rotation that is not a multiple of 45°', async () => {
      const position = await rootPosition(freeAt(10.5, 20.5, { rotation: 0.3 }));

      expect(position.x).toBeCloseTo(10.5);
      expect(position.y).toBeCloseTo(-20.5);
    });

    it('snaps the composite origin — position plus the pivot/scale transform’s own translation', async () => {
      // Measured through Godot 4.6.3: a ColorRect at (100, 100) with
      // pivot_offset (10.25, 10.25) and scale (2, 2) draws its top-left at
      // exactly 90 with no half-pixel blend, i.e. floor(100 - 10.25 + 0.5).
      // The inner pivot groups contribute that -10.25, so the OUTER group
      // carries the snapped total minus it.
      const position = await rootPosition(
        freeAt(100, 100, { pivotOffset: { x: 10.25, y: 10.25 }, scale: { x: 2, y: 2 } })
      );

      expect(position.x).toBeCloseTo(100.25);
      expect(position.y).toBeCloseTo(-100.25);
    });

    it("snaps a container child even when it carries its own rotation (fit_child_in_rect resets it)", async () => {
      const TYPE = 'TestSnapContainer';
      controlSolverRegistry.registerContainerLayout(TYPE, (_n, children, contentRect) => {
        const out = new Map<string, Rect2>();
        children.forEach((c) => out.set(c.node.path, { ...contentRect, x: 40.5, y: 60.5 }));
        return out;
      });

      const child = solveNode('Stack/Child', 'TestType', { rotation: 0.3, scale: { x: 2, y: 2 } });
      const root = solveNode('Stack', TYPE, { anchorsPreset: 15 }, [child]);

      const renderer = await ReactThreeTestRenderer.create(
        <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
      );

      const position = namedGroup(renderer.scene, 'TestType:Child')!.position;
      expect(position.x).toBeCloseTo(41);
      expect(position.y).toBeCloseTo(-61);
    });

    it('honours `gui/common/snap_controls_to_pixels = false`', async () => {
      projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'false' };

      const position = await rootPosition(freeAt(516.5, 306.5));

      expect(position.x).toBeCloseTo(516.5);
      expect(position.y).toBeCloseTo(-306.5);
    });

    it('snaps when the project sets the key to true, and when it sets nothing at all', async () => {
      projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'true' };
      expect((await rootPosition(freeAt(516.5, 306.5))).x).toBeCloseTo(517);

      projectSettingsMock.settings = {};
      expect((await rootPosition(freeAt(516.5, 306.5))).x).toBeCloseTo(517);
    });

    // `Viewport::snap_controls_to_pixels` is a per-VIEWPORT flag defaulting to
    // true (`scene/main/viewport.h`), and `main/main.cpp` hands the project
    // setting to the ROOT window only. A caller that owns its own viewport
    // therefore states the flag rather than inheriting the project's.
    it('lets a caller override the project setting for its own viewport', async () => {
      projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'false' };

      expect((await rootPosition(freeAt(516.5, 306.5), true)).x).toBeCloseTo(517);
    });

    it('lets a caller turn the snap off while the project leaves it on', async () => {
      projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'true' };

      expect((await rootPosition(freeAt(516.5, 306.5), false)).x).toBeCloseTo(516.5);
    });

    it('falls back to the project setting when the caller states nothing', async () => {
      projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'false' };

      expect((await rootPosition(freeAt(516.5, 306.5), undefined)).x).toBeCloseTo(516.5);
    });
  });
});
