/**
 * <Control> — the native (WebGL canvas) painter for a plain `Control`.
 * `Control` overrides no `_draw`, so it contributes no chrome of its own; the
 * seam under test is therefore twofold:
 *
 *  - in ISOLATION (the `NativeControlComponentProps` contract this component
 *    actually receives — `solveNode`/`rect`, no `children`, no parent-layout
 *    info): it must draw nothing, whatever its own transform properties say.
 *  - through `ControlCanvasWalker` (real `controlComponentRegistry`
 *    registration, the actual production wiring this file adds): children
 *    still render as the walker's siblings, and the free-Control rotate/
 *    scale-about-pivot transform (`Container::fit_child_in_rect`'s rule,
 *    applied by the walker around EVERY registered painter) reaches a real
 *    `Control` node once one is registered — proving the walker's plumbing
 *    end to end for the simplest possible painter.
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Control } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

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
  return { path, node: tscnNode, children, styleBoxes: {}, textureSize: null };
}

interface WrapperInstance {
  name: string;
  visible: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

function allGroups(scene: { findAllByType: (t: string) => { instance: WrapperInstance }[] }): WrapperInstance[] {
  return scene.findAllByType('Group').map((g) => g.instance);
}

function namedGroup(scene: { findAllByType: (t: string) => { instance: WrapperInstance }[] }, name: string) {
  return allGroups(scene).find((g) => g.name === name) ?? null;
}

describe('<Control> (isolated painter contract)', () => {
  it('draws no mesh or line geometry of its own', async () => {
    const node = solveNode('Root', 'Control', {});
    const renderer = await ReactThreeTestRenderer.create(
      <Control {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 80, h: 40 }} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws nothing even when the node carries rotation/scale/pivot properties (edge case)', async () => {
    const node = solveNode('Root', 'Control', {
      rotation: Math.PI / 2,
      scale: { x: 2, y: 2 },
      pivotOffset: { x: 10, y: 5 },
    });
    const renderer = await ReactThreeTestRenderer.create(
      <Control {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 80, h: 40 }} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});

describe('<Control> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  afterEach(() => {
    controlComponentRegistry.clear();
    controlSolverRegistry.clear();
  });

  it('replaces the debug fallback outline with no visible chrome once registered', async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const root = solveNode('Root', 'Control', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it("still renders a Control's children as the walker's siblings", async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const child = solveNode('Root/Child', 'Control', { anchorsPreset: 15 });
    const root = solveNode('Root', 'Control', { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    expect(namedGroup(renderer.scene, 'Control:Root')).not.toBeNull();
    expect(namedGroup(renderer.scene, 'Control:Child')).not.toBeNull();
  });

  it('applies the free-Control rotation/scale about pivot_offset alone (no ratio)', async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const root = solveNode('Root', 'Control', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 80,
      offsetBottom: 40,
      rotation: Math.PI / 2,
      pivotOffset: { x: 10, y: 5 },
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    // pivot = pivotOffset + pivotOffsetRatio * size = (10, 5) + (0,0) * (80,40) = (10, 5).
    const groups = allGroups(renderer.scene);
    const pivotGroup = groups.find((g) => Math.abs(g.rotation.z - -(Math.PI / 2)) < 1e-9);
    expect(pivotGroup).toBeDefined();
    expect(pivotGroup!.position.x).toBeCloseTo(10);
    expect(pivotGroup!.position.y).toBeCloseTo(-5);
  });

  it('applies the free-Control rotation/scale about pivot_offset_ratio alone (no offset)', async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const root = solveNode('Root', 'Control', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 80,
      offsetBottom: 40,
      rotation: Math.PI / 4,
      pivotOffsetRatio: { x: 0.5, y: 0.25 },
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    // pivot = (0,0) + (0.5, 0.25) * (80, 40) = (40, 10).
    const groups = allGroups(renderer.scene);
    const pivotGroup = groups.find((g) => Math.abs(g.rotation.z - -(Math.PI / 4)) < 1e-9);
    expect(pivotGroup).toBeDefined();
    expect(pivotGroup!.position.x).toBeCloseTo(40);
    expect(pivotGroup!.position.y).toBeCloseTo(-10);
  });

  it('combines pivot_offset and pivot_offset_ratio into one effective pivot', async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const root = solveNode('Root', 'Control', {
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 80,
      offsetBottom: 40,
      rotation: Math.PI,
      pivotOffset: { x: 10, y: 5 },
      pivotOffsetRatio: { x: 0.25, y: 0.5 },
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    // pivot = (10, 5) + (0.25, 0.5) * (80, 40) = (30, 25).
    const groups = allGroups(renderer.scene);
    const pivotGroup = groups.find((g) => Math.abs(g.rotation.z - -Math.PI) < 1e-9);
    expect(pivotGroup).toBeDefined();
    expect(pivotGroup!.position.x).toBeCloseTo(30);
    expect(pivotGroup!.position.y).toBeCloseTo(-25);
  });

  it("does NOT apply a Control's own rotation/scale when its parent imposes a container layout", async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: Control });
    const CONTAINER_TYPE = 'TestP6aContainer';
    const stack: ContainerLayoutFn = (_n, children, contentRect) => {
      const out = new Map<string, Rect2>();
      children.forEach((c) => out.set(c.node.path, contentRect));
      return out;
    };
    controlSolverRegistry.registerContainerLayout(CONTAINER_TYPE, stack);

    const child = solveNode('Stack/Child', 'Control', {
      anchorsPreset: 15,
      rotation: Math.PI / 4,
      scale: { x: 2, y: 2 },
    });
    const root = solveNode('Stack', CONTAINER_TYPE, { anchorsPreset: 15 }, [child]);

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = allGroups(renderer.scene);
    expect(groups.every((g) => g.rotation.z === 0)).toBe(true);
    expect(groups.every((g) => g.scale.x === 1 && g.scale.y === 1)).toBe(true);
  });
});
