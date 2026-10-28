/**
 * Every shared-world SubViewport of a 2D canvas draws one World3D: the canvas's own, which
 * `find_world_3d()` reaches from each of them (`viewport.cpp:4670-4681`). So a node inside one
 * such viewport shows through the camera of another.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorldScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

/** Two viewports of a 2D scene: the Left one holds the sphere, the Right one only a camera. */
function scene(rightOwnsItsWorld: boolean): string {
  return `[gd_scene format=3]

[sub_resource type="SphereMesh" id="SphereMesh_1"]

[node name="Root" type="Node2D"]

[node name="Left" type="SubViewport" parent="."]

[node name="Subject" type="MeshInstance3D" parent="Left"]
mesh = SubResource("SphereMesh_1")

[node name="Camera3D" type="Camera3D" parent="Left"]

[node name="Right" type="SubViewport" parent="."]
own_world_3d = ${rightOwnsItsWorld}

[node name="Camera3D" type="Camera3D" parent="Right"]
`;
}

/** Whether the Right viewport's pass draws the Left one's sphere. */
async function rightPassDrawsSubject(rightOwnsItsWorld: boolean): Promise<boolean> {
  const parsed = new TscnParser().parse(scene(rightOwnsItsWorld));
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="2d">
      <ViewportPassStack captured={captured}>
        <CanvasWorldScope>
          <NodeDispatcher nodes={parsed.nodes} />
        </CanvasWorldScope>
      </ViewportPassStack>
    </SceneStack>
  );
  let draws: boolean | null = null;
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, renderedScene) => {
          if (bound?.texture.name !== 'Right::world') return;
          let found = false;
          renderedScene.traverseVisible((object) => {
            if (object.name === 'Subject') found = true;
          });
          draws = found;
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(draws).not.toBeNull();
  });
  return draws!;
}

describe('<SubViewport> shared world of a 2D canvas', () => {
  it('draws a node of another shared-world viewport through its own camera', async () => {
    expect(await rightPassDrawsSubject(false)).toBe(true);
  });

  it("keeps an own world apart from the canvas's world", async () => {
    expect(await rightPassDrawsSubject(true)).toBe(false);
  });
});
