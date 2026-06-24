/**
 * <Marker3D> draws a selection-gated 3-axis cross gizmo (ADR-0018): visible only
 * while this node is the selected node; children are positioned either way.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { Marker3D } from './Component';
import { parseMarker3D } from './parser';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider, useSelection } from '../../../r3f/contexts/SelectionContext';

function markerNode(name = 'MyMarker', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'Marker3D',
    children: [],
    properties: parseMarker3D({ type: 'node', attributes: { type: 'Marker3D', name } }, props),
  };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

async function renderMarker(selectedPath: string | null) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="MyMarker">
        <Marker3D node={markerNode('MyMarker')} />
      </NodePathProvider>
    </SelectionProvider>
  );
}

describe('<Marker3D>', () => {
  it('hides the cross gizmo when not selected', async () => {
    const renderer = await renderMarker(null);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws the cross gizmo when selected', async () => {
    const renderer = await renderMarker('MyMarker');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('hides the gizmo when a different node is selected', async () => {
    const renderer = await renderMarker('Other');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });
});
