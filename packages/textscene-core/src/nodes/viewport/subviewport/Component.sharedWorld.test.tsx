/**
 * Every shared-world SubViewport of a 2D canvas draws one World3D: the canvas's own, which
 * `find_world_3d()` reaches from each of them (`viewport.cpp:4670-4681`). So a node inside one
 * such viewport shows through the camera of another, and a world no viewport draws holds nothing.
 */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorldScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { useCanvasWorld } from '../../../r3f/environment/canvasWorldScene';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { drawnMeshes, ownerName } from '../../../r3f/lighting2d/testing/lightPassProbe';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

/** Two viewports of a 2D scene: the Left one holds the sphere, the Right one only a camera. */
function siblings(rightOwnsItsWorld: boolean): string {
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

/**
 * The Left viewport of `siblings` beside a 2D viewport of its own world, whose shared Right
 * viewport reaches that own world, not the canvas's.
 */
const NESTED = `[gd_scene format=3]

[sub_resource type="SphereMesh" id="SphereMesh_1"]

[node name="Root" type="Node2D"]

[node name="Left" type="SubViewport" parent="."]

[node name="Subject" type="MeshInstance3D" parent="Left"]
mesh = SubResource("SphereMesh_1")

[node name="Camera3D" type="Camera3D" parent="Left"]

[node name="Outer" type="SubViewport" parent="."]
own_world_3d = true

[node name="Canvas" type="Node2D" parent="Outer"]

[node name="Right" type="SubViewport" parent="Outer"]

[node name="Camera3D" type="Camera3D" parent="Outer/Right"]
`;

/** Mounts `source` as a 2D canvas under its world, with `beside` mounted ahead of its nodes. */
async function mountCanvas(source: string, beside?: ReactNode) {
  const parsed = new TscnParser().parse(source);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="2d">
      <ViewportPassStack captured={captured}>
        <CanvasWorldScope>
          {beside}
          <NodeDispatcher nodes={parsed.nodes} />
        </CanvasWorldScope>
      </ViewportPassStack>
    </SceneStack>
  );
  return { renderer, captured };
}

/** Whether the Right viewport's pass draws the Left one's sphere. */
async function rightPassDrawsSubject(source: string): Promise<boolean> {
  const { renderer, captured } = await mountCanvas(source);
  let draws: boolean | null = null;
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, renderedScene, camera) => {
          if (bound?.texture.name !== 'Right::world') return;
          draws = drawnMeshes(renderedScene, camera).some((mesh) => ownerName(mesh) === 'Subject');
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(draws).not.toBeNull();
  });
  return draws!;
}

/**
 * The Left viewport of `siblings` beside a 3D viewport of its own world, whose 2D viewport holds
 * the shared Right viewport. Right reaches that own world through the 2D one, not the canvas's.
 */
const NESTED_IN_3D = `[gd_scene format=3]

[sub_resource type="SphereMesh" id="SphereMesh_1"]

[node name="Root" type="Node2D"]

[node name="Left" type="SubViewport" parent="."]

[node name="Subject" type="MeshInstance3D" parent="Left"]
mesh = SubResource("SphereMesh_1")

[node name="Camera3D" type="Camera3D" parent="Left"]

[node name="Outer" type="SubViewport" parent="."]
own_world_3d = true

[node name="Floor" type="MeshInstance3D" parent="Outer"]
mesh = SubResource("SphereMesh_1")

[node name="Middle" type="SubViewport" parent="Outer"]

[node name="Canvas" type="Node2D" parent="Outer/Middle"]

[node name="Right" type="SubViewport" parent="Outer/Middle"]

[node name="Camera3D" type="Camera3D" parent="Outer/Middle/Right"]
`;

/** A 2D scene with no viewport, whose WorldEnvironment nothing draws. */
const NO_VIEWPORT = `[gd_scene format=3]

[sub_resource type="Environment" id="Environment_1"]
background_mode = 1

[node name="Root" type="Node2D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_1")
`;

/** The objects in the canvas's world scene once `source` has mounted and settled. */
async function canvasWorldObjects(source: string): Promise<number> {
  const world: { scene: THREE.Scene | null } = { scene: null };
  function CaptureWorld() {
    world.scene = useCanvasWorld()?.scene ?? null;
    return null;
  }
  const { renderer } = await mountCanvas(source, <CaptureWorld />);
  await renderer.advanceFrames(2, 16);
  return world.scene!.children.length;
}

describe('<SubViewport> shared world of a 2D canvas', () => {
  it('leaves the canvas world empty while no shared viewport draws it', async () => {
    expect(await canvasWorldObjects(NO_VIEWPORT)).toBe(0);
  });

  it('draws a node of another shared-world viewport through its own camera', async () => {
    expect(await rightPassDrawsSubject(siblings(false))).toBe(true);
  });

  it("keeps an own world apart from the canvas's world", async () => {
    expect(await rightPassDrawsSubject(siblings(true))).toBe(false);
  });

  it("gives a shared viewport inside a 2D viewport of its own world that world, not the canvas's", async () => {
    expect(await rightPassDrawsSubject(NESTED)).toBe(false);
  });

  it("gives a shared viewport below a 3D viewport of its own world that world, not the canvas's", async () => {
    expect(await rightPassDrawsSubject(NESTED_IN_3D)).toBe(false);
  });
});
