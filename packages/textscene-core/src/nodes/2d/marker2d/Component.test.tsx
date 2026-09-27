/**
 * <Marker2D> draws a selection-gated cross gizmo (ADR-0018): the "+" appears
 * only while this node is the SelectionContext's selected node, and the node
 * still positions its children regardless of selection.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { Marker2D } from './Component';
import { parseMarker2D } from './parser';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { SelectSeeder } from '../../../r3f/testing/SelectSeeder';

function markerNode(name = 'MyMarker', props: Record<string, string> = {}): TscnNode {
  return {
    name,
    type: 'Marker2D',
    children: [],
    properties: parseMarker2D({ type: 'node', attributes: { type: 'Marker2D', name } }, props),
  };
}

async function renderMarker(selectedPath: string | null, props: Record<string, string> = {}) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>
      {selectedPath !== null && <SelectSeeder path={selectedPath} />}
      <NodePathProvider path="MyMarker">
        <Marker2D node={markerNode('MyMarker', props)} />
      </NodePathProvider>
    </SelectionProvider>
  );
}

describe('<Marker2D>', () => {
  it('hides the cross gizmo when the node is not selected', async () => {
    const renderer = await renderMarker(null);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('draws the cross gizmo when the node is selected', async () => {
    const renderer = await renderMarker('MyMarker');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(1);
  });

  it('hides the gizmo when selection points at a different node', async () => {
    const renderer = await renderMarker('SomethingElse');
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('always renders a positioning group for children, selected or not', async () => {
    const renderer = await renderMarker(null);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });
});
