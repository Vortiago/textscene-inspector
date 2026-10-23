/**
 * <Marker3D> draws Godot's 3-axis cross for every node, in full colour whether or not it is
 * selected (`marker_3d_gizmo_plugin.cpp:80-92,115`), and hides it with the Gizmos toggle.
 * Children are positioned either way.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { Marker3D } from './Component';
import { parseMarker3D } from './parser';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';
import { describeGizmoToggle, type GizmoNodeCase } from '../../../r3f/testing/gizmoContract';
import { godotColorToLinear } from '../../../r3f/godotColor';

function markerNode(name = 'MyMarker', props: Record<string, string> = {}): TscnNode {
  return {
    rawProperties: {},
    name,
    type: 'Marker3D',
    children: [],
    properties: parseMarker3D({ type: 'node', attributes: { type: 'Marker3D', name } }, props),
  };
}

async function renderMarker(selectedPath: string | null, showGizmos = true) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="MyMarker" selectedPath={selectedPath} showGizmos={showGizmos}>
      <Marker3D node={markerNode('MyMarker')}>
        <group name="Child" />
      </Marker3D>
    </GizmoScene>
  );
}

// Not an instantiated case: Godot's Marker3D material has no variants (`marker_3d_gizmo_plugin.cpp:80-92`).
const GIZMO_CASE: GizmoNodeCase = {
  nodePath: 'MyMarker',
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos }) => renderMarker(selectedPath, showGizmos),
};
describeGizmoToggle('<Marker3D>', GIZMO_CASE);

describe('<Marker3D>', () => {
  it.each([
    ['the node is selected', 'MyMarker'],
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the cross in full colour when %s', async (_label, selectedPath) => {
    expect(lineOpacities(await renderMarker(selectedPath))).toEqual([1]);
  });

  // `marker_3d_gizmo_plugin.cpp:60-79`: the theme's axis colours, each negative arm darkened by 0.5.
  // `axisCross.test.ts` holds every colour, so this one checks the first and last vertex.
  it('draws the x arm in red and the negative z arm in dark blue', async () => {
    const renderer = await renderMarker('MyMarker');
    const cross = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    const colors = Array.from(cross.geometry.getAttribute('color').array);
    const red = godotColorToLinear({ r: 0.96, g: 0.2, b: 0.32 });
    const darkBlue = godotColorToLinear({ r: 0.08, g: 0.275, b: 0.48 });
    expect(colors).toHaveLength(36);
    expect(colors.slice(0, 3)).toEqual([red.r, red.g, red.b].map((value) => expect.closeTo(value, 6)));
    expect(colors.slice(-3)).toEqual(
      [darkBlue.r, darkBlue.g, darkBlue.b].map((value) => expect.closeTo(value, 6))
    );
  });

  it('positions its children with the Gizmos toggle off', async () => {
    const renderer = await renderMarker(null, false);
    expect(renderer.scene.findByProps({ name: 'Child' })).toBeTruthy();
  });
});
