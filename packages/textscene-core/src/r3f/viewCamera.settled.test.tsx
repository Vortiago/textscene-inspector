import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import type { RootState } from '@react-three/fiber';
import { TscnSceneContents } from './SceneContents';
import { TscnSceneProvider } from './TscnSceneProvider';
import { ActiveCameraSwitcher } from './editorView/ActiveCameraSwitcher';
import { SceneCamerasProvider } from './sceneCameras';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { GodotEditorControls } from './editorView/GodotEditorControls';
import { EditorControlsBridge } from './editorView/EditorControlsBridge';
import { LookThroughProvider, ViewCamera } from './viewCamera';
import { EditorViewReport } from './viewStatus/EditorViewReport';
import { ViewStatusProvider } from './viewStatus/ViewStatusContext';
import { createViewStatusStore } from './viewStatus/viewStatus';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { settleLoads } from './testing/settleLoads';
import { openScene } from '../scene/openScene';
import './nodes';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Rig" type="Node3D" parent="."]

[node name="Top" type="Camera3D" parent="Rig"]
`;

/** Enough frames for the preview to reach the camera, as `EditorViewReport.test` counts them. */
const FRAMES_TO_SETTLE = 10;

/** The editor's 3D canvas through `camera`, with or without the switcher that moves the view onto it. */
async function mountedThrough(camera: string | null, { isSwitching = true } = {}) {
  const status = createViewStatusStore();
  const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
  const { Probe, state } = r3fStateProbe();
  await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <ViewStatusProvider store={status}>
        <ViewportActionsProvider>
          <LookThroughProvider>
            <SceneCamerasProvider>
              <TscnSceneContents />
              {isSwitching && <ActiveCameraSwitcher />}
              <ViewCamera camera={camera} />
            </SceneCamerasProvider>
            <GodotEditorControls />
            <EditorControlsBridge />
            <EditorViewReport />
            <Probe />
          </LookThroughProvider>
        </ViewportActionsProvider>
      </ViewStatusProvider>
    </TscnSceneProvider>
  );
  await settleLoads();
  await drawFrames(state, FRAMES_TO_SETTLE);
  return { status, state };
}

async function drawFrames(state: () => RootState, count: number) {
  for (let i = 0; i < count; i++) await act(async () => state().advance(state().clock.elapsedTime + 1 / 60));
}

describe('the settled signal of a view through a Camera3D', () => {
  it('stays pending while the frames draw through the editor camera, naming the camera', async () => {
    const { status } = await mountedThrough('Rig/Top', { isSwitching: false });
    expect(status.settled()).toBeNull();
    await expect(status.captureImage()).rejects.toThrow('the view does not draw through "Rig/Top" yet');
  });

  it('settles once a frame draws through the camera', async () => {
    const { status, state } = await mountedThrough('Rig/Top');
    expect(status.settled()).not.toBeNull();
    expect(state().camera.name).toBe('Top');
  });

  it('settles through the editor camera for null', async () => {
    const { status } = await mountedThrough(null);
    expect(status.settled()).not.toBeNull();
  });
});
