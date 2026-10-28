/**
 * A 3D SubViewport's pass runs Godot's tonemap pass inside its own target, with the Environment of
 * the world `find_world_3d()` resolves (`viewport.cpp:4670-4681`): the parent's for a shared world,
 * its own for `own_world_3d`. The glow chain runs whenever that Environment enables glow
 * (`renderer_scene_render_rd.cpp:575`, `:686`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { WorldEnvironmentScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { ViewportPassStack } from './viewportPasses.testkit';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

import '../../../r3f/nodes/index';

const GLOW = '[sub_resource type="Environment" id="Env_glow"]\nglow_enabled = true\n';

/** A scene whose root world, and optionally the viewport's own world, holds a glowing Environment. */
function scene({
  ownWorld,
  rootGlows,
  viewportGlows,
}: {
  ownWorld: boolean;
  rootGlows: boolean;
  viewportGlows: boolean;
}) {
  return `[gd_scene format=3]

${GLOW}
[node name="Root" type="Node3D"]
${rootGlows ? '\n[node name="RootEnvironment" type="WorldEnvironment" parent="."]\nenvironment = SubResource("Env_glow")\n' : ''}
[node name="Viewport" type="SubViewport" parent="."]
own_world_3d = ${ownWorld}

[node name="Camera3D" type="Camera3D" parent="Viewport"]
${viewportGlows ? '\n[node name="ViewportEnvironment" type="WorldEnvironment" parent="Viewport"]\nenvironment = SubResource("Env_glow")\n' : ''}`;
}

/** Mounts `source`, and answers the targets each next frame renders into. */
async function mount(source: string): Promise<() => Promise<THREE.WebGLRenderTarget[]>> {
  const parsed = new TscnParser().parse(source);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="3d">
      <ViewportPassStack captured={captured}>
        <WorldEnvironmentScope world="root">
          <NodeDispatcher nodes={parsed.nodes} />
        </WorldEnvironmentScope>
      </ViewportPassStack>
    </SceneStack>
  );
  return async () => {
    const targets: THREE.WebGLRenderTarget[] = [];
    await withStubbedGl(captured.current!, { onRender: (bound) => bound && targets.push(bound) }, () =>
      renderer.advanceFrames(1, 16)
    );
    return targets;
  };
}

const GLOW_LEVEL_0 = 'GodotGlow.Level0';

async function namesOf(targets: Promise<THREE.WebGLRenderTarget[]>): Promise<string[]> {
  return (await targets).map((target) => target.texture.name);
}

describe('<SubViewport> tonemap pass', () => {
  /**
   * Godot resolves the 3D buffer in linear HDR (`render_forward_clustered.cpp:2402`) before the
   * tonemap pass reads it (`:2514`), so the world draws into a half-float buffer, not the target.
   */
  it('draws the world into a linear HDR buffer, which the tonemap pass writes into the target', async () => {
    const nextFrameTargets = await mount(scene({ ownWorld: true, rootGlows: false, viewportGlows: false }));

    const [world, ...rest] = await nextFrameTargets();
    expect(world?.texture.type).toBe(THREE.HalfFloatType);
    expect(rest.at(-1)?.texture.name).toBe('Viewport::target');
  });

  it('runs the glow chain of the shared world in its pass', async () => {
    const nextFrameTargets = await mount(scene({ ownWorld: false, rootGlows: true, viewportGlows: false }));

    await waitFor(async () => expect(await namesOf(nextFrameTargets())).toContain(GLOW_LEVEL_0));
  });

  it('runs no glow chain for an own world with no Environment', async () => {
    const nextFrameTargets = await mount(scene({ ownWorld: true, rootGlows: true, viewportGlows: false }));

    expect(await namesOf(nextFrameTargets())).not.toContain(GLOW_LEVEL_0);
  });

  it('runs the glow chain of its own world in its pass', async () => {
    const nextFrameTargets = await mount(scene({ ownWorld: true, rootGlows: false, viewportGlows: true }));

    await waitFor(async () => expect(await namesOf(nextFrameTargets())).toContain(GLOW_LEVEL_0));
  });
});
