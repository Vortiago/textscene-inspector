/**
 * <PathFollow2D> places its group at the sampled curve point (conjugated to
 * three space), falls back to the authored transform when no curve is in scope,
 * and draws a selection-gated follow dot.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { PathFollow2D } from './Component';
import { parsePathFollow2D } from './parser';
import { Path2DCurveProvider } from '../../../r3f/contexts/Path2DCurveContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';
import {
  parseCurve2DPoints,
  tessellateCurve2D,
  type Curve2DSampler,
} from '../../../resources/curves/curve2d';

// Straight horizontal curve (0,0) → (100,0), length 100.
const STRAIGHT: Curve2DSampler = tessellateCurve2D(
  parseCurve2DPoints('{"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,100,0)}')
);

function followNode(name = 'MyFollow', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'PathFollow2D',
    children: [],
    properties: parsePathFollow2D(
      { type: 'node', attributes: { type: 'PathFollow2D', name } },
      props
    ),
  };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

async function render(
  sampler: Curve2DSampler | null,
  props: Record<string, string>,
  selectedPath: string | null = null
) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <Path2DCurveProvider value={sampler}>
        <NodePathProvider path="MyFollow">
          <PathFollow2D node={followNode('MyFollow', props)} />
        </NodePathProvider>
      </Path2DCurveProvider>
    </SelectionProvider>
  );
}

function namedGroup(renderer: Awaited<ReturnType<typeof render>>): THREE.Object3D | undefined {
  return renderer.scene
    .findAllByType('Group')
    .map((g) => g.instance as unknown as THREE.Object3D)
    .find((o) => o.name === 'MyFollow');
}

describe('<PathFollow2D>', () => {
  it('places the group at the curve midpoint for progress = half the length', async () => {
    const renderer = await render(STRAIGHT, { progress: '50' });
    const group = namedGroup(renderer);
    expect(group).toBeDefined();
    expect(group!.position.x).toBeCloseTo(50, 3);
    expect(group!.position.y).toBeCloseTo(0, 3);
  });

  it('ignores progress_ratio, which a scene file cannot deliver to the node', async () => {
    // `set_progress_ratio` needs the Path2D parent bound, which happens on
    // enter-tree, after the loader has applied properties (path_2d.cpp:472).
    // A ratio of 1.0 on a 100 px curve would be the far end; Godot loads 0.
    const renderer = await render(STRAIGHT, { progress_ratio: '1.0' });
    expect(namedGroup(renderer)!.position.x).toBeCloseTo(0, 3);
  });

  it('clamps rather than wrapping a progress past the end, whatever loop says', async () => {
    // The sampler clamps (curve.cpp:1079) and nothing wraps a scene-loaded
    // progress, so 150 on a 100 px curve is the END, not 50 in from the start.
    const renderer = await render(STRAIGHT, { progress: '150', loop: 'true' });
    expect(namedGroup(renderer)!.position.x).toBeCloseTo(100, 3);
  });

  it('uses absolute progress', async () => {
    const renderer = await render(STRAIGHT, { progress: '25' });
    expect(namedGroup(renderer)!.position.x).toBeCloseTo(25, 3);
  });

  it('applies v_offset perpendicular to the curve (Y-negated to three space)', async () => {
    // Straight +X tangent → normal is +Y in Godot; v_offset=10 → Godot (x,10) → three y=-10.
    const renderer = await render(STRAIGHT, { progress: '50', v_offset: '10' });
    const group = namedGroup(renderer)!;
    expect(group.position.x).toBeCloseTo(50, 3);
    expect(group.position.y).toBeCloseTo(-10, 3);
  });

  it('falls back to the authored Node2D transform when no curve is in scope', async () => {
    const renderer = await render(null, { position: 'Vector2(30, 40)' });
    const group = namedGroup(renderer)!;
    // Authored (30,40) Godot → three (30,-40).
    expect(group.position.x).toBeCloseTo(30, 3);
    expect(group.position.y).toBeCloseTo(-40, 3);
  });

  it('hides the follow dot unless selected', async () => {
    const hidden = await render(STRAIGHT, { progress: '50' }, null);
    expect(hidden.scene.findAllByType('LineSegments')).toHaveLength(0);
    const shown = await render(STRAIGHT, { progress: '50' }, 'MyFollow');
    expect(shown.scene.findAllByType('LineSegments')).toHaveLength(1);
  });
});
