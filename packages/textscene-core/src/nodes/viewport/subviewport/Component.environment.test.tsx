/**
 * A viewport's pass draws with the Environment Godot forces for its render: its own camera's, else
 * the world's own (`renderer_scene_cull.cpp:3594-3597`). Two viewports of one World3D so draw one
 * frame with two backgrounds, two ambients and two tonemaps.
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
import { shownAmbientLights } from '../../../r3f/testing/ambientLights';
import { textureTexel } from '../../../r3f/testing/backgroundTexel';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

/** The world's Environment: a blue background, which the ambient takes, the tonemap at exposure 1. */
const WORLD_ENVIRONMENT = `[sub_resource type="Environment" id="World"]
background_mode = 1
background_color = Color(0.05, 0.06, 0.2, 1)
`;

/** A camera's Environment: a warm background, a green ambient, the tonemap at exposure 2. */
const WARM_ENVIRONMENT = `[sub_resource type="Environment" id="Warm"]
background_mode = 1
background_color = Color(0.6, 0.3, 0.1, 1)
ambient_light_source = 2
ambient_light_color = Color(0.1, 0.5, 0.2, 1)
tonemap_exposure = 2.0
`;

/** A second camera's Environment: a teal background, a purple ambient, the tonemap at exposure 3. */
const TEAL_ENVIRONMENT = `[sub_resource type="Environment" id="Teal"]
background_mode = 1
background_color = Color(0.1, 0.5, 0.5, 1)
ambient_light_source = 2
ambient_light_color = Color(0.5, 0.1, 0.4, 1)
tonemap_exposure = 3.0
`;

/** Two cameras that share the Warm Environment, one at exposure 2 and one with no attributes. */
const SHARED_CAMERA_ENVIRONMENT = `[gd_scene format=3]

${WORLD_ENVIRONMENT}
${WARM_ENVIRONMENT}
[sub_resource type="CameraAttributesPractical" id="Bright"]
exposure_multiplier = 2.0

[node name="Root" type="Node2D"]

[node name="Bright" type="SubViewport" parent="."]

[node name="WorldEnvironment" type="WorldEnvironment" parent="Bright"]
environment = SubResource("World")

[node name="Camera3D" type="Camera3D" parent="Bright"]
environment = SubResource("Warm")
attributes = SubResource("Bright")

[node name="Plain" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Plain"]
environment = SubResource("Warm")
`;

/** The linear red of each background colour above, from the sRGB transfer function. */
const WORLD_RED = 0.003935;
const WARM_RED = 0.318547;
const TEAL_RED = 0.010023;
/** The linear red of the Warm background at exposure 2, which scales the colour before linearising. */
const WARM_RED_AT_2 = 1.516837;

/** A 3D scene viewed through Main. The Warm viewport's camera holds the Warm Environment, Plain's none. */
const inlineScene = (viewedEnvironment: string) => `[gd_scene format=3]

${WORLD_ENVIRONMENT}
${WARM_ENVIRONMENT}
${TEAL_ENVIRONMENT}
[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("World")

[node name="Main" type="Camera3D" parent="."]
current = true
${viewedEnvironment}

[node name="Warm" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Warm"]
environment = SubResource("Warm")

[node name="Plain" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Plain"]
`;

/** A 2D canvas whose three shared-world viewports look at one world through three cameras. */
const CANVAS = `[gd_scene format=3]

${WORLD_ENVIRONMENT}
${WARM_ENVIRONMENT}
${TEAL_ENVIRONMENT}
[node name="Root" type="Node2D"]

[node name="Warm" type="SubViewport" parent="."]

[node name="WorldEnvironment" type="WorldEnvironment" parent="Warm"]
environment = SubResource("World")

[node name="Camera3D" type="Camera3D" parent="Warm"]
environment = SubResource("Warm")

[node name="Teal" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Teal"]
environment = SubResource("Teal")

[node name="Plain" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Plain"]
`;

/** What a render draws of its Environment. */
interface DrawnEnvironment {
  /** The linear red of the colour background, null for none. */
  backgroundRed: number | null;
  /** The colour of the ambient light the render shows, null for none. */
  ambient: THREE.Color | null;
}

/** What each viewport's pass draws, and what the scene of the last pass holds once the frame is over. */
interface Frame {
  passes: Map<string, DrawnEnvironment & { toneMapExposure: number }>;
  held: DrawnEnvironment;
}

function drawnEnvironmentOf(scene: THREE.Scene): DrawnEnvironment {
  const background = scene.background as THREE.DataTexture | null;
  return {
    backgroundRed: background ? textureTexel(background)[0]! : null,
    ambient: shownAmbientLights(scene)[0]?.color.clone() ?? null,
  };
}

/** The tonemap exposure the full-screen tonemap draw of a pass reads. */
function toneMapExposureOf(scene: THREE.Object3D): number {
  let exposure: number | null = null;
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    // postprocessing prefixes each effect's uniforms with its index in the pass.
    const uniform = material?.uniforms?.e0GodotExposure;
    if (uniform) exposure = uniform.value as number;
  });
  if (exposure === null) throw new Error(`expected a tonemap draw in ${scene.name}, found none`);
  return exposure;
}

async function drawFrame(source: string, workspace: '2d' | '3d'): Promise<Frame> {
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
  const worlds = new Map<string, DrawnEnvironment>();
  const toneMaps = new Map<string, number>();
  let passScene: THREE.Scene | null = null;
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, scene) => {
          const name = bound?.texture.name;
          if (name?.endsWith('::world')) {
            passScene = scene as THREE.Scene;
            worlds.set(name.replace('::world', ''), drawnEnvironmentOf(scene as THREE.Scene));
          } else if (name?.endsWith('::target')) {
            toneMaps.set(name.replace('::target', ''), toneMapExposureOf(scene));
          }
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(toneMaps.size).toBeGreaterThan(1);
  });
  const passes = new Map(
    [...worlds].map(([name, drawn]) => [name, { ...drawn, toneMapExposure: toneMaps.get(name)! }])
  );
  return { passes, held: drawnEnvironmentOf(passScene!) };
}

function RootWorldScope({ children }: { children: React.ReactNode }) {
  return (
    <ViewportActionsProvider initialPreviewedCameraPath="Root/Main">
      <WorldEnvironmentScope world="root">{children}</WorldEnvironmentScope>
    </ViewportActionsProvider>
  );
}

describe('<SubViewport> camera Environment', () => {
  it('draws an inline pass with the Environment of its own camera', async () => {
    const { passes } = await drawFrame(inlineScene(''), '3d');
    const warm = passes.get('Warm')!;
    expect(warm.backgroundRed).toBeCloseTo(WARM_RED, 4);
    expect(warm.ambient?.g).toBeGreaterThan(warm.ambient!.r);
    expect(warm.toneMapExposure).toBe(2);
  });

  it("draws an inline pass whose camera holds none with the world's Environment", async () => {
    const { passes } = await drawFrame(inlineScene(''), '3d');
    const plain = passes.get('Plain')!;
    expect(plain.backgroundRed).toBeCloseTo(WORLD_RED, 4);
    expect(plain.ambient?.b).toBeGreaterThan(plain.ambient!.g);
    expect(plain.toneMapExposure).toBe(1);
  });

  it("draws an inline pass with the world's Environment while the viewed camera holds its own", async () => {
    const { passes } = await drawFrame(inlineScene('environment = SubResource("Teal")'), '3d');
    const plain = passes.get('Plain')!;
    expect(plain.backgroundRed).toBeCloseTo(WORLD_RED, 4);
    expect(plain.ambient?.b).toBeGreaterThan(plain.ambient!.g);
    expect(plain.toneMapExposure).toBe(1);
  });

  it('puts the Environment of the view back after a pass draws its own', async () => {
    const { held } = await drawFrame(inlineScene(''), '3d');
    expect(held.backgroundRed).toBeCloseTo(WORLD_RED, 4);
    expect(held.ambient?.b).toBeGreaterThan(held.ambient!.g);
  });

  it('draws each shared-world viewport of a 2D canvas with the Environment of its own camera', async () => {
    const { passes } = await drawFrame(CANVAS, '2d');
    expect(passes.get('Warm')!.backgroundRed).toBeCloseTo(WARM_RED, 4);
    expect(passes.get('Warm')!.toneMapExposure).toBe(2);
    expect(passes.get('Teal')!.backgroundRed).toBeCloseTo(TEAL_RED, 4);
    expect(passes.get('Teal')!.ambient?.r).toBeGreaterThan(passes.get('Teal')!.ambient!.g);
    expect(passes.get('Teal')!.toneMapExposure).toBe(3);
  });

  it("draws a shared-world viewport of a 2D canvas whose camera holds none with the world's Environment", async () => {
    const { passes } = await drawFrame(CANVAS, '2d');
    expect(passes.get('Plain')!.backgroundRed).toBeCloseTo(WORLD_RED, 4);
    expect(passes.get('Plain')!.ambient?.b).toBeGreaterThan(passes.get('Plain')!.ambient!.g);
  });

  it('draws an Environment two cameras share at the exposure of each pass', async () => {
    const { passes } = await drawFrame(SHARED_CAMERA_ENVIRONMENT, '2d');
    expect(passes.get('Bright')!.backgroundRed).toBeCloseTo(WARM_RED_AT_2, 4);
    expect(passes.get('Plain')!.backgroundRed).toBeCloseTo(WARM_RED, 4);
  });
});
