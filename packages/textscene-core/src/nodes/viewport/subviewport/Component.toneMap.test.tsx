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
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { ViewportPassStack } from './viewportPasses.testkit';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

import '../../../r3f/nodes/index';

const GLOW = '[sub_resource type="Environment" id="Env_glow"]\nglow_enabled = true\n';

/** A WorldEnvironment node under `parent` that applies the glowing Environment. */
function glowingEnvironment(name: string, parent: string): string {
  return `\n[node name="${name}" type="WorldEnvironment" parent="${parent}"]\nenvironment = SubResource("Env_glow")\n`;
}

/**
 * A scene whose root world, and optionally the viewport's own world, holds a glowing Environment.
 * A `witness` adds a shared-world viewport, whose glow proves the root Environment has resolved.
 */
function scene({
  ownWorld,
  rootGlows,
  viewportGlows,
  witness = false,
}: {
  ownWorld: boolean;
  rootGlows: boolean;
  viewportGlows: boolean;
  witness?: boolean;
}) {
  return `[gd_scene format=3]

${GLOW}
[node name="Root" type="Node3D"]
${rootGlows ? glowingEnvironment('RootEnvironment', '.') : ''}
[node name="Viewport" type="SubViewport" parent="."]
own_world_3d = ${ownWorld}

[node name="Camera3D" type="Camera3D" parent="Viewport"]
${viewportGlows ? glowingEnvironment('ViewportEnvironment', 'Viewport') : ''}
${witness ? '[node name="Witness" type="SubViewport" parent="."]\n\n[node name="Camera3D" type="Camera3D" parent="Witness"]\n' : ''}`;
}

/** A 2D scene with a shared-world viewport whose own subtree holds a glowing Environment. */
const SHARED_WORLD_IN_2D = `[gd_scene format=3]

${GLOW}
[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Viewport"]
${glowingEnvironment('ViewportEnvironment', 'Viewport')}`;

/**
 * Mounts `source`, and answers the targets each next frame renders into. The preview Environment
 * is off: it glows, so it would stand in for an Environment the scene has not resolved yet.
 */
async function mount(
  source: string,
  workspace: '2d' | '3d' = '3d'
): Promise<() => Promise<THREE.WebGLRenderTarget[]>> {
  const parsed = new TscnParser().parse(source);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace={workspace}>
      <ViewportModeProvider initialShowPreviewEnvironment={false}>
        <ViewportPassStack captured={captured}>
          <WorldEnvironmentScope world="root">
            <NodeDispatcher nodes={parsed.nodes} />
          </WorldEnvironmentScope>
        </ViewportPassStack>
      </ViewportModeProvider>
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

/** The names of the targets one viewport's pass draws, which end with its own target. */
function passOf(viewport: string, names: string[]): string[] {
  const end = names.indexOf(`${viewport}::target`);
  const start = names.findLastIndex((name, at) => at < end && name.endsWith('::target')) + 1;
  return names.slice(start, end + 1);
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
    const nextFrameTargets = await mount(
      scene({ ownWorld: true, rootGlows: true, viewportGlows: false, witness: true })
    );

    const names = await waitFor(async () => {
      const frame = await namesOf(nextFrameTargets());
      expect(passOf('Witness', frame)).toContain(GLOW_LEVEL_0);
      return frame;
    });
    expect(passOf('Viewport', names)).toContain('Viewport::target');
    expect(passOf('Viewport', names)).not.toContain(GLOW_LEVEL_0);
  });

  it('runs the glow chain of its own world in its pass', async () => {
    const nextFrameTargets = await mount(scene({ ownWorld: true, rootGlows: false, viewportGlows: true }));

    await waitFor(async () => expect(await namesOf(nextFrameTargets())).toContain(GLOW_LEVEL_0));
  });

  /**
   * A shared world is the parent's world, so a WorldEnvironment inside the viewport applies to it
   * (`world_environment.cpp:76-85`), even where the viewport's content draws apart from the canvas.
   */
  it('runs the glow chain of an Environment inside a shared world drawn apart from a 2D canvas', async () => {
    const nextFrameTargets = await mount(SHARED_WORLD_IN_2D, '2d');

    await waitFor(async () =>
      expect(passOf('Viewport', await namesOf(nextFrameTargets()))).toContain(GLOW_LEVEL_0)
    );
  });
});
