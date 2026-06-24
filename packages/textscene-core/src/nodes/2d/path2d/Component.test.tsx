/**
 * <Path2D> draws a selection-gated white polyline gizmo from its Curve2D, and
 * degrades to nothing when the curve is absent. The curve sampler is always
 * provided to descendants (covered by the PathFollow2D tests).
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';
import { Path2D } from './Component';
import { parsePath2D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';

// A simple 3-point open path: (0,0) → (100,0) → (100,100), zero tangents.
const CURVE: TscnInternalResource = {
  id: 'Curve2D_1',
  type: 'Curve2D',
  data: {
    id: 'Curve2D_1',
    _data: '{\n"points": PackedVector2Array(0,0,0,0,0,0, 0,0,0,0,100,0, 0,0,0,0,100,100)\n}',
    point_count: '3',
  },
};

function pathNode(name = 'MyPath', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'Path2D',
    children: [],
    properties: parsePath2D({ type: 'node', attributes: { type: 'Path2D', name } }, props),
  };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

async function renderPath(
  selectedPath: string | null,
  props: Record<string, string>,
  internalResources: TscnInternalResource[] = [CURVE]
) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <SceneResourcesProvider internalResources={internalResources} externalResources={[]}>
        <NodePathProvider path="MyPath">
          <Path2D node={pathNode('MyPath', props)} />
        </NodePathProvider>
      </SceneResourcesProvider>
    </SelectionProvider>
  );
}

describe('<Path2D>', () => {
  it('draws the curve polyline gizmo when selected and a curve is present', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve2D_1")' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('hides the gizmo when not selected', async () => {
    const renderer = await renderPath(null, { curve: 'SubResource("Curve2D_1")' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws nothing when the curve is missing, even if selected (edge)', async () => {
    const renderer = await renderPath('MyPath', {});
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws nothing when the curve SubResource is not found (edge)', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Missing")' }, []);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});
