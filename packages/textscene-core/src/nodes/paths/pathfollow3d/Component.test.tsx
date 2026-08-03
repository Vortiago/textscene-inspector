/**
 * <PathFollow3D> places its group at the sampled curve point, falls back to the
 * authored transform when no curve is in scope, and draws a selection-gated handle.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { PathFollow3D } from './Component';
import { parsePathFollow3D } from './parser';
import { Path3DCurveProvider } from '../../../r3f/contexts/Path3DCurveContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';
import {
  parseCurve3DPoints,
  tessellateCurve3D,
  type Curve3DSampler,
} from '../../../resources/curves/curve3d';

// Straight curve along +X, (0,0,0) → (10,0,0), length 10.
const STRAIGHT: Curve3DSampler = tessellateCurve3D(
  parseCurve3DPoints('{"points": PackedVector3Array(0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,10,0,0)}')
);

function followNode(name = 'MyFollow', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'PathFollow3D',
    children: [],
    properties: parsePathFollow3D(
      { type: 'node', attributes: { type: 'PathFollow3D', name } },
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
  sampler: Curve3DSampler | null,
  props: Record<string, string>,
  selectedPath: string | null = null
) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <Path3DCurveProvider value={sampler}>
        <NodePathProvider path="MyFollow">
          <PathFollow3D node={followNode('MyFollow', props)} />
        </NodePathProvider>
      </Path3DCurveProvider>
    </SelectionProvider>
  );
}

function namedGroup(renderer: Awaited<ReturnType<typeof render>>): THREE.Object3D | undefined {
  return renderer.scene
    .findAllByType('Group')
    .map((g) => g.instance as THREE.Object3D)
    .find((o) => o.name === 'MyFollow');
}

describe('<PathFollow3D>', () => {
  it('places the group at the curve midpoint for progress_ratio = 0.5', async () => {
    const renderer = await render(STRAIGHT, { progress_ratio: '0.5' });
    const group = namedGroup(renderer)!;
    expect(group.position.x).toBeCloseTo(5, 3);
    expect(group.position.y).toBeCloseTo(0, 3);
    expect(group.position.z).toBeCloseTo(0, 3);
  });

  it('uses absolute progress when progress_ratio is unset', async () => {
    const renderer = await render(STRAIGHT, { progress: '2.5' });
    expect(namedGroup(renderer)!.position.x).toBeCloseTo(2.5, 3);
  });

  it('applies v_offset along the up axis in NONE rotation mode', async () => {
    const renderer = await render(STRAIGHT, {
      progress_ratio: '0.5',
      rotation_mode: '0',
      v_offset: '3',
    });
    const group = namedGroup(renderer)!;
    expect(group.position.x).toBeCloseTo(5, 3);
    expect(group.position.y).toBeCloseTo(3, 3);
  });

  it('falls back to the authored Node3D transform when no curve is in scope', async () => {
    const renderer = await render(null, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7, 8, 9)',
    });
    const group = namedGroup(renderer)!;
    expect(group.position.x).toBeCloseTo(7, 3);
    expect(group.position.y).toBeCloseTo(8, 3);
    expect(group.position.z).toBeCloseTo(9, 3);
  });

  it('hides the follow handle unless selected', async () => {
    const hidden = await render(STRAIGHT, { progress_ratio: '0.5' }, null);
    expect(hidden.scene.findAllByType('LineSegments')).toHaveLength(0);
    const shown = await render(STRAIGHT, { progress_ratio: '0.5' }, 'MyFollow');
    expect(shown.scene.findAllByType('LineSegments')).toHaveLength(1);
  });
});
