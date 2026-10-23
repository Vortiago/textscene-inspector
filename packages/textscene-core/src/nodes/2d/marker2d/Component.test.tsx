/**
 * <Marker2D> draws Godot's "+" editor cross for every node, in full colour whether or not it is
 * selected (`marker_2d.cpp:85`), and hides it with the Gizmos toggle. The node still positions its
 * children regardless of selection.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { Marker2D } from './Component';
import { parseMarker2D } from './parser';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';
import { describeGizmoToggle, type GizmoNodeCase } from '../../../r3f/testing/gizmoContract';

function markerNode(name = 'MyMarker', props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'Marker2D',
    children: [],
    properties: parseMarker2D({ type: 'node', attributes: { type: 'Marker2D', name } }, props),
  };
}

async function renderMarker(
  selectedPath: string | null,
  props: Record<string, string> = {},
  showGizmos = true
) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="MyMarker" selectedPath={selectedPath} showGizmos={showGizmos}>
      <Marker2D node={markerNode('MyMarker', props)} />
    </GizmoScene>
  );
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'MyMarker',
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos }) => renderMarker(selectedPath, {}, showGizmos),
};
describeGizmoToggle('<Marker2D>', GIZMO_CASE);

describe('<Marker2D>', () => {
  it.each([
    ['the node is selected', 'MyMarker'],
    ['nothing is selected', null],
    ['selection points at a different node', 'SomethingElse'],
  ])('draws the cross in full colour when %s', async (_label, selectedPath) => {
    expect(lineOpacities(await renderMarker(selectedPath))).toEqual([1]);
  });

  it('always renders a positioning group for children, selected or not', async () => {
    const renderer = await renderMarker(null, {}, false);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });
});
