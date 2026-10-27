/**
 * A node inside a SubViewport reads the size of its target: the camera gizmo draws over the aspect
 * of the viewport that holds the camera (`Node3DEditor::get_camera_viewport_size`).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { cameraGizmoLines } from '../../3d/camera3d/gizmoLines';

import '../../../r3f/nodes/index';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(200, 400)

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

const DEFAULT_LENS = {
  projection: Camera3DProjectionType.PERSPECTIVE,
  fov: 75,
  size: 1,
  keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
  frustumOffset: { x: 0, y: 0 },
};

describe('<SubViewport> viewport size', () => {
  it('sets the aspect of the camera gizmo inside it to the aspect of its size', async () => {
    const parsed = new TscnParser().parse(SCENE);
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} showGizmos>
        <NodeDispatcher nodes={parsed.nodes} />
      </SceneStack>
    );

    // Traverses the three scene: the test renderer lists a node under a SubViewport twice.
    const drawn: number[][] = [];
    (renderer.scene.instance as THREE.Object3D).traverse((object) => {
      if ((object as THREE.LineSegments).isLineSegments) {
        drawn.push(Array.from((object as THREE.LineSegments).geometry.getAttribute('position').array));
      }
    });
    expect(drawn).toEqual([Array.from(cameraGizmoLines({ lens: DEFAULT_LENS, near: 0.05, aspect: 0.5 }))]);
  });
});
