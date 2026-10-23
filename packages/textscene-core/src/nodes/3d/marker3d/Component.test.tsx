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
  it('colours the positive arm of each axis and darkens the negative arm', async () => {
    const renderer = await renderMarker('MyMarker');
    const cross = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    const colors = Array.from(cross.geometry.getAttribute('color').array);
    const expected = [
      godotColorToLinear({ r: 0.96, g: 0.2, b: 0.32 }),
      godotColorToLinear({ r: 0.48, g: 0.1, b: 0.16 }),
      godotColorToLinear({ r: 0.53, g: 0.84, b: 0.01 }),
      godotColorToLinear({ r: 0.265, g: 0.42, b: 0.005 }),
      godotColorToLinear({ r: 0.16, g: 0.55, b: 0.96 }),
      godotColorToLinear({ r: 0.08, g: 0.275, b: 0.48 }),
    ].flatMap(({ r, g, b }) => [r, g, b, r, g, b]);
    expect(colors).toEqual(expected.map((value) => expect.closeTo(value, 6)));
  });

  it('positions its children with the Gizmos toggle off', async () => {
    const renderer = await renderMarker(null, false);
    expect(renderer.scene.findByProps({ name: 'Child' })).toBeTruthy();
  });
});
