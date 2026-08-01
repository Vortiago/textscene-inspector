/**
 * The BG ambient reaches the rendered scene, not just the settings object.
 *
 * `renderer.bg-ambient.test.ts` pins the Godot AmbientSource × BGMode table;
 * this pins the wire from that table to an actual `<ambientLight>`, driving the
 * real parser end to end from `.tscn` text.
 *
 * There is deliberately NO golden for this. The previewer always mounts editor
 * preview lights (`TscnSceneContents`: ambient 0.4 + a directional), and at
 * corpus-realistic values — the 0.6 grey background of
 * scenes/demos/3d/graphics_settings/control.tscn at energy 1 — the BG ambient's
 * contribution does not survive 8-bit quantisation next to them: a golden only
 * moves once `background_energy_multiplier` is pushed to ~50. A baseline that
 * cannot fail is worse than no baseline, so the guard lives here at the seam.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { WorldEnvironment } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { TscnParser } from '../../../parser/TscnParser';

async function ambientLights(environmentBody: string) {
  const scene = new TscnParser().parse(
    `[gd_scene format=3]\n\n` +
      `[sub_resource type="Environment" id="Environment_1"]\n${environmentBody}\n\n` +
      `[node name="Root" type="Node3D"]\n\n` +
      `[node name="WorldEnvironment" type="WorldEnvironment" parent="."]\n` +
      `environment = SubResource("Environment_1")\n`
  );
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider
      internalResources={scene.internalResources}
      externalResources={scene.externalResources}
    >
      <WorldEnvironment node={scene.nodes[0]!.children[0]!} />
    </SceneResourcesProvider>
  );
  return renderer.scene
    .findAllByType('AmbientLight')
    .map((l) => l.instance as unknown as THREE.AmbientLight);
}

describe('<WorldEnvironment> ambient from the background', () => {
  it('mounts an ambientLight carrying the background colour and energy', async () => {
    const lights = await ambientLights(
      'background_mode = 1\nbackground_color = Color(0.6, 0.6, 0.6, 1)\nbackground_energy_multiplier = 2.0'
    );
    expect(lights).toHaveLength(1);
    // The component converts Godot's sRGB literal into three's linear working
    // space; reading it back as sRGB must give the authored 0.6 (0.6 x 255 = 153
    // = 0x99) rather than the background's black or a linearised 0x57.
    expect(lights[0]!.color.getHexString()).toBe('999999');
    // three's ambient irradiance carries no 1/PI where Godot's does, so
    // `background_energy_multiplier` reaches the light multiplied by PI
    // (reasoning in Component.world.test.tsx).
    expect(lights[0]!.intensity).toBeCloseTo(2 * Math.PI, 6);
  });

  it('mounts one for a bare Environment, from the default clear colour', async () => {
    const lights = await ambientLights('background_mode = 1');
    expect(lights).toHaveLength(1);
  });

  it('mounts none when the ambient source is DISABLED', async () => {
    const lights = await ambientLights(
      'ambient_light_source = 1\nbackground_mode = 1\nbackground_color = Color(1, 1, 1, 1)'
    );
    expect(lights).toHaveLength(0);
  });
});
