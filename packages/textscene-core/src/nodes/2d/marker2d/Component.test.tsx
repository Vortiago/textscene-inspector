/**
 * <Marker2D> draws Godot's "+" editor cross for every node, in full colour whether or not it is
 * selected (`marker_2d.cpp:85`), and hides it with the Gizmos toggle. The node still positions its
 * children regardless of selection.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
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

  // `marker_2d.cpp:47-59`: the x axis and then the y axis, each as a positive and a negative arm.
  // `axisCross.test.ts` holds the colours.
  it('draws the x and y axes, with the +y arm pointing down the screen', async () => {
    const renderer = await renderMarker('MyMarker', { gizmo_extents: '20' });
    const cross = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    const positions = Array.from(cross.geometry.getAttribute('position').array);
    // Godot's +y is three's -y inside the Node2D group.
    const expected = [20, 0, 0, 0, 0, 0, 0, 0, 0, -20, 0, 0, 0, -20, 0, 0, 0, 0, 0, 0, 0, 0, 20, 0];
    expect(positions).toEqual(expected.map((value) => expect.closeTo(value, 6)));
  });

  // `marker_2d.cpp:32-43` guards no `gizmo_extents`: 0 draws a cross of zero length.
  it('draws a cross of zero length for gizmo_extents 0', async () => {
    const renderer = await renderMarker('MyMarker', { gizmo_extents: '0' });
    const cross = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    expect(Array.from(cross.geometry.getAttribute('position').array).every((value) => value === 0)).toBe(
      true
    );
  });

  it('always renders a positioning group for children, selected or not', async () => {
    const renderer = await renderMarker(null, {}, false);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });
});
