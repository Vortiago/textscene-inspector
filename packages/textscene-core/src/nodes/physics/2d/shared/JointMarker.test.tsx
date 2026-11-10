/**
 * <JointMarker> draws a 2D joint's strokes as filled quads, in Godot's two stroke styles, for every
 * node and only while the Gizmos toggle is on (ADR-0056).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { GizmoScene } from '../../../../r3f/testing/GizmoScene';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { JointMarker } from './JointMarker';
import { grooveMarker } from './jointStrokes';

async function render(showGizmos = true, selectedPath: string | null = null) {
  return ReactThreeTestRenderer.create(
    <GizmoScene nodePath="Joint" selectedPath={selectedPath} showGizmos={showGizmos}>
      <JointMarker strokes={grooveMarker(60, 20)} />
    </GizmoScene>
  );
}

const meshes = (renderer: Awaited<ReturnType<typeof render>>) =>
  renderer.scene.findAllByType('Mesh').map((mesh) => mesh.instance as THREE.Mesh);

describe('<JointMarker>', () => {
  it('draws one quad mesh per stroke style, the frame first and the offset bar on top', async () => {
    const [frame, offset] = meshes(await render());
    expect(frame!.geometry.getAttribute('position').count).toBe(3 * 4);
    expect(offset!.geometry.getAttribute('position').count).toBe(4);
  });

  // pin_joint_2d.cpp:46, groove_joint_2d.cpp:49: alpha 0.5 in both colours.
  it('draws the frame in Color(0.7, 0.6, 0, 0.5) and the offset bar in Color(0.8, 0.8, 0.9, 0.5)', async () => {
    const [frame, offset] = meshes(await render()).map((mesh) => mesh.material as THREE.MeshBasicMaterial);
    expect([frame!.color, frame!.opacity]).toEqual([godotColorToLinear({ r: 0.7, g: 0.6, b: 0 }), 0.5]);
    expect([offset!.color, offset!.opacity]).toEqual([godotColorToLinear({ r: 0.8, g: 0.8, b: 0.9 }), 0.5]);
  });

  it.each([
    ['nothing is selected', null],
    ['the node is selected', 'Joint'],
  ])('draws at full strength when %s', async (_label, selectedPath) => {
    const [frame] = meshes(await render(true, selectedPath));
    expect((frame!.material as THREE.MeshBasicMaterial).opacity).toBe(0.5);
  });

  it('draws nothing while the Gizmos toggle is off', async () => {
    expect(meshes(await render(false))).toEqual([]);
  });
});
