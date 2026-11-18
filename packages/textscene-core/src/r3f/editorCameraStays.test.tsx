/**
 * The editor's 3D view draws through its own camera or a previewed one, never the current camera
 * of the root viewport, so a host's `make_current` leaves it where it is.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { TscnSceneProvider } from './TscnSceneProvider';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher';
import { SceneCamerasProvider } from './sceneCameras';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { settleLoads } from './testing/settleLoads';
import { openScene } from '../scene/openScene';
import './nodes';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="A" type="Camera3D" parent="."]

[node name="B" type="Camera3D" parent="."]
`;

describe("the editor's 3D view", () => {
  it('keeps the editor camera when a host makes a camera current', async () => {
    const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
    const { Probe, state } = r3fStateProbe();
    await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={scene}>
        <SceneCamerasProvider>
          <TscnSceneContents />
          <ActiveCameraSwitcher />
        </SceneCamerasProvider>
        <Probe />
      </TscnSceneProvider>
    );
    await settleLoads();
    const editorCamera = state().camera;
    await act(async () => {
      await scene.getNode('B').call('make_current');
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(state().camera).toBe(editorCamera);
  });
});
