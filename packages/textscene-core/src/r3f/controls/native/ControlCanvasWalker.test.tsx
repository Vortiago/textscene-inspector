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
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import { nativeTheme } from './nativeTheme';
import { controlSolverRegistry, type ContainerLayoutFn } from './solverRegistry';
import { ControlCanvasWalker } from './ControlCanvasWalker';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';

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
    const geometry = lines[0]!.instance.geometry as { boundingBox: { max: { x: number; y: number }; min: { x: number; y: number } } | null; computeBoundingBox: () => void };
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
});
