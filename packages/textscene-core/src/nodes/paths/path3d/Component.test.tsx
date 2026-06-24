/**
 * <Path3D> draws a selection-gated white polyline gizmo from its Curve3D, and
 * degrades to nothing when the curve is absent.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnInternalResource } from '../../../parser/types';
import { Path3D } from './Component';
import { parsePath3D } from './parser';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';

// Straight 3-point path: (0,0,0) → (10,0,0) → (10,10,0), zero tangents.
const CURVE: TscnInternalResource = {
  id: 'Curve3D_1',
  type: 'Curve3D',
  data: {
    id: 'Curve3D_1',
    _data:
      '{\n"points": PackedVector3Array(0,0,0,0,0,0,0,0,0, 0,0,0,0,0,0,10,0,0, 0,0,0,0,0,0,10,10,0),\n"tilts": PackedFloat32Array(0, 0, 0)\n}',
  },
};

function pathNode(name = 'MyPath', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'Path3D',
    children: [],
    properties: parsePath3D({ type: 'node', attributes: { type: 'Path3D', name } }, props),
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
          <Path3D node={pathNode('MyPath', props)} />
        </NodePathProvider>
      </SceneResourcesProvider>
    </SelectionProvider>
  );
}

describe('<Path3D>', () => {
  it('draws the curve polyline gizmo when selected and a curve is present', async () => {
    const renderer = await renderPath('MyPath', { curve: 'SubResource("Curve3D_1")' });
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('hides the gizmo when not selected', async () => {
    const renderer = await renderPath(null, { curve: 'SubResource("Curve3D_1")' });
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
