/**
 * A viewport's pass draws at the exposure of the attributes Godot forces for its render: its own
 * camera's, else the world's own (`renderer_scene_cull.cpp:2707`, `:3560-3565`). Two viewports of one
 * World3D so draw one frame at two exposures.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { ViewportActionsProvider } from '../../../r3f/contexts/ViewportActionsContext';
import { CanvasWorldScope, WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

const ATTRIBUTES = (id: string, exposure: number) =>
  `[sub_resource type="CameraAttributesPractical" id="${id}"]\nexposure_multiplier = ${exposure}\n`;

/**
 * A 3D scene with a lit root world: its world holds attributes of 0.5, and the camera the viewer
 * looks through holds 4. The Bright viewport's camera holds 2 and the Plain one's holds none.
 */
const INLINE = `[gd_scene format=3]

${ATTRIBUTES('World', 0.5)}
${ATTRIBUTES('Viewed', 4)}
${ATTRIBUTES('Bright', 2)}
[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
camera_attributes = SubResource("World")

[node name="Main" type="Camera3D" parent="."]
current = true
attributes = SubResource("Viewed")

[node name="Lamp" type="OmniLight3D" parent="."]

[node name="Bright" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Bright"]
attributes = SubResource("Bright")

[node name="Plain" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Plain"]
`;

/** A 2D canvas whose two shared-world viewports look at one lamp through cameras of two exposures. */
const CANVAS = `[gd_scene format=3]

${ATTRIBUTES('Bright', 2)}
${ATTRIBUTES('Dim', 0.5)}
[node name="Root" type="Node2D"]

[node name="Bright" type="SubViewport" parent="."]

[node name="Lamp" type="OmniLight3D" parent="Bright"]

[node name="Camera3D" type="Camera3D" parent="Bright"]
attributes = SubResource("Bright")

[node name="Dim" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Dim"]
attributes = SubResource("Dim")
`;

function lampOf(scene: THREE.Object3D): THREE.PointLight {
  let lamp: THREE.PointLight | null = null;
  scene.traverse((object) => {
    if ((object as THREE.PointLight).isPointLight) lamp = object as THREE.PointLight;
  });
  if (!lamp) throw new Error(`expected a point light in ${scene.name}, found none`);
  return lamp;
}

/**
 * The lamp's energy at the render of each viewport's world buffer, as a multiple of the energy it
 * holds once the frame is over, which is the exposure the canvas around it draws at.
 */
async function passEnergies(
  source: string,
  workspace: '2d' | '3d'
): Promise<{ held: number; passes: Map<string, number> }> {
  const parsed = new TscnParser().parse(source);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const World = workspace === '2d' ? CanvasWorldScope : RootWorldScope;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace={workspace}>
      <ViewportPassStack captured={captured}>
        <World>
          <NodeDispatcher nodes={parsed.nodes} />
        </World>
      </ViewportPassStack>
    </SceneStack>
  );
  const passes = new Map<string, number>();
  let lamp: THREE.PointLight | null = null;
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, scene) => {
          const name = bound?.texture.name;
          if (!name?.endsWith('::world')) return;
          lamp = lampOf(scene);
          passes.set(name.replace('::world', ''), lamp.intensity);
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(passes.size).toBeGreaterThan(1);
  });
  const held = lamp!.intensity;
  return { held, passes: new Map([...passes].map(([name, energy]) => [name, energy / held])) };
}

function RootWorldScope({ children }: { children: React.ReactNode }) {
  return (
    <ViewportActionsProvider initialActiveCameraPath="Root/Main">
      <WorldEnvironmentScope world="root">{children}</WorldEnvironmentScope>
    </ViewportActionsProvider>
  );
}

describe('<SubViewport> exposure', () => {
  it('draws an inline pass at the attributes of its own camera', async () => {
    const { passes } = await passEnergies(INLINE, '3d');
    // The viewer's camera holds 4, so the frame around the pass draws at 4.
    expect(passes.get('Bright')).toBeCloseTo(2 / 4);
  });

  it("draws an inline pass whose camera holds none at the world's own attributes", async () => {
    const { passes } = await passEnergies(INLINE, '3d');
    expect(passes.get('Plain')).toBeCloseTo(0.5 / 4);
  });

  it('draws each shared-world viewport of a 2D canvas at its own exposure', async () => {
    const { passes } = await passEnergies(CANVAS, '2d');
    expect(passes.get('Bright')! / passes.get('Dim')!).toBeCloseTo(2 / 0.5);
  });
});
