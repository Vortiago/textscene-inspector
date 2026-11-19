import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer, { act } from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { TscnSceneProvider } from './TscnSceneProvider';
import { ActiveCameraSwitcher } from './ActiveCameraSwitcher';
import { SceneCamerasProvider } from './sceneCameras';
import { ViewportActionsProvider } from './contexts/ViewportActionsContext';
import { GodotEditorControls } from './GodotEditorControls';
import { EditorControlsBridge } from './EditorControlsBridge';
import { ViewCamera } from './viewCamera';
import { r3fStateProbe } from './testing/R3FStateProbe';
import { settleLoads } from './testing/settleLoads';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import './nodes';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Rig" type="Node3D" parent="."]

[node name="Top" type="Camera3D" parent="Rig"]

[node name="Side" type="Camera3D" parent="."]
`;

const RIG_SCENE = `[gd_scene format=3]

[node name="Rig" type="Node3D"]

[node name="Lens" type="Camera3D" parent="."]
`;

const INSTANCING_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Main" type="Node3D"]

[node name="Crane" parent="." instance=ExtResource("1")]
`;

const RIG_FILE: ResourceProvider = {
  loadResource: async (path) => (path === 'res://rig.tscn' ? RIG_SCENE : null),
};

/** The editor's 3D canvas as `<TscnCanvas>` fills it, with the `camera` option set to `camera`. */
async function mountedWith(camera: string | null, source = SCENE) {
  const scene = openScene({ source, provider: RIG_FILE });
  const { Probe, state } = r3fStateProbe();
  const tree = (option: string | null) => (
    <TscnSceneProvider scene={scene}>
      <ViewportActionsProvider>
        <SceneCamerasProvider>
          <TscnSceneContents />
          <ActiveCameraSwitcher />
          <ViewCamera camera={option} />
        </SceneCamerasProvider>
        <GodotEditorControls />
        <EditorControlsBridge />
        <Probe />
      </ViewportActionsProvider>
    </TscnSceneProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree(camera));
  await settleLoads();
  const update = async (option: string | null) => {
    await renderer.update(tree(option));
    await act(async () => renderer.advanceFrames(1, 16));
  };
  return { state, update };
}

describe('the camera option of the 3D view', () => {
  it('draws through the Camera3D its path names', async () => {
    const { state } = await mountedWith('Rig/Top');

    expect(state().camera.userData).toMatchObject({ tscnPath: 'Main/Rig/Top' });
  });

  it('moves to the Camera3D a new path names', async () => {
    const { state, update } = await mountedWith('Rig/Top');

    await update('Side');

    expect(state().camera.userData).toMatchObject({ tscnPath: 'Main/Side' });
  });

  it('ends the preview for a new path that names no node yet', async () => {
    const { state, update } = await mountedWith(null);
    const editor = state().camera;
    await update('Side');

    await update('Crane/Lens');

    expect(state().camera).toBe(editor);
  });

  it('draws through a Camera3D once the load of its sub-scene brings it in', async () => {
    const { state } = await mountedWith('Crane/Lens', INSTANCING_SCENE);

    expect(state().camera.userData).toMatchObject({ tscnPath: 'Main/Crane/Lens' });
  });

  it('draws through the editor camera at the pose it had before the preview, for null', async () => {
    const { state, update } = await mountedWith(null);
    const editor = state().camera;
    editor.position.set(9, 9, 9);
    await update('Side');

    await update(null);

    expect(state().camera).toBe(editor);
    expect(editor.position.toArray()).toEqual([9, 9, 9]);
  });
});
