/**
 * <Marker3D> draws Godot's 3-axis cross for every node, in full colour whether or not it is
 * selected (`marker_3d_gizmo_plugin.cpp:80-92,115`), and hides it with the Gizmos toggle.
 * Children are positioned either way.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { Marker3D } from './Component';
import { parseMarker3D } from './parser';
import { GizmoScene, lineOpacities } from '../../../r3f/testing/GizmoScene';

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

describe('<Marker3D>', () => {
  it.each([
    ['the node is selected', 'MyMarker'],
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the cross in full colour when %s', async (_label, selectedPath) => {
    expect(lineOpacities(await renderMarker(selectedPath))).toEqual([1]);
  });

  it.each([
    ['selected', 'MyMarker'],
    ['unselected', null],
  ])('draws no cross with the Gizmos toggle off, %s', async (_label, selectedPath) => {
    const renderer = await renderMarker(selectedPath, false);
    expect(renderer.scene.findAllByType('LineSegments')).toHaveLength(0);
  });

  it('positions its children with the Gizmos toggle off', async () => {
    const renderer = await renderMarker(null, false);
    expect(renderer.scene.findByProps({ name: 'Child' })).toBeTruthy();
  });
});
