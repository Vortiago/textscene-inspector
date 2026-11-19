import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import { GameViewContents } from './GameViewContents';
import { useGameViewSettled } from './GameViewStatusContext';
import type { GameViewSettled } from './gameViewStatus';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import * as logger from '../../logger';
import '../nodes';

const SCRIPT = 'extends Node\n';

/** Enough frames for work that a frame advances, such as a texture upload, to finish. */
const FRAMES_TO_SETTLE = 10;

const TWO_SCRIPTS_AND_A_CAMERA = `[gd_scene format=3]

[ext_resource type="Script" path="res://mover.gd" id="1"]

[node name="Main" type="Node3D"]
script = ExtResource("1")

[node name="Camera3D" type="Camera3D" parent="."]
current = true

[node name="Box" type="CSGBox3D" parent="."]
script = ExtResource("1")
`;

const NO_CAMERA = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="CSGBox3D" parent="."]
`;

const SPRITE = `[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.svg" id="1"]

[node name="Main" type="Sprite2D"]
texture = ExtResource("1")
`;

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>';

const files: ResourceProvider = {
  loadResource: async (path) => (path === 'res://mover.gd' ? SCRIPT : null),
};

/** Written by the view's host each render: what `useGameViewSettled` answers now. */
let seen: GameViewSettled | null = null;

function Host() {
  seen = useGameViewSettled();
  return null;
}

async function mountGame(source: string, provider = files, views = 1) {
  seen = null;
  const scene = openScene({ source, provider });
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      {Array.from({ length: views }, (_, view) => (
        <GameViewContents key={view} />
      ))}
      <Host />
    </TscnSceneProvider>
  );
  await settleLoads();
  return Object.assign(renderer, { opened: scene });
}

async function drawFrames(renderer: Awaited<ReturnType<typeof mountGame>>, count: number) {
  await renderer.advanceFrames(count, 1 / 60);
}

describe('the settled value of the In-game view', () => {
  it('counts the nodes that hold a script, and sees the current camera', async () => {
    const renderer = await mountGame(TWO_SCRIPTS_AND_A_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true });
  });

  it('reports no current camera for a 3D scene with no Camera3D', async () => {
    const renderer = await mountGame(NO_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 0, hasCurrentCamera: false });
  });

  it('is pending again after the text of the scene changes, until frames show the new text', async () => {
    const renderer = await mountGame(NO_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    await act(async () => renderer.opened.setSource(TWO_SCRIPTS_AND_A_CAMERA));
    await settleLoads();
    expect(seen).toBeNull();
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true });
  });

  it('is pending while a texture file is on its way, and settles after it lands', async () => {
    let land: (text: string) => void = () => {};
    const slowIcon: ResourceProvider = {
      loadResource: (path) =>
        path === 'res://icon.svg' ? new Promise((resolve) => (land = resolve)) : Promise.resolve(null),
    };
    const renderer = await mountGame(SPRITE, slowIcon);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toBeNull();
    await act(async () => land(ICON));
    await settleLoads();
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 0, hasCurrentCamera: false });
  });

  it('refuses a second In-game view under one provider, and keeps the first one settled', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const renderer = await mountGame(TWO_SCRIPTS_AND_A_CAMERA, files, 2);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(error).toHaveBeenCalledWith(
      '[GameView] expected one In-game view under a TscnSceneProvider, got a second'
    );
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true });
    error.mockRestore();
  });
});
