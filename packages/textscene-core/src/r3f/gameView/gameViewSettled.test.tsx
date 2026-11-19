import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import { GameViewContents } from './GameViewContents';
import { useGameViewSettled } from '../viewStatus/ViewStatusContext';
import type { ViewSettled } from '../viewStatus/viewStatus';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import { variant } from '../../scene/variant';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import * as logger from '../../logger';
import { createTextureFromBuffer } from '../../resources/formats/image/textureProcessing';
import '../nodes';

vi.mock('../../resources/formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../resources/formats/image/textureProcessing')>();
  return { ...actual, createTextureFromBuffer: vi.fn() };
});

// happy-dom decodes no image.
vi.mocked(createTextureFromBuffer).mockImplementation(async () => new THREE.Texture());

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

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[node name="Main" type="Sprite2D"]
texture = ExtResource("1")
`;

const ICON = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

const files: ResourceProvider = {
  loadResource: async (path) => (path === 'res://mover.gd' ? SCRIPT : null),
};

const NONE: ReadonlySet<string> = new Set();

/** Written by the view's host each render: what `useGameViewSettled` answers now. */
let seen: ViewSettled | null = null;
/** Written by the view's host each render: every answer it rendered, in order. */
let answers: (ViewSettled | null)[] = [];

function Host() {
  seen = useGameViewSettled();
  answers.push(seen);
  return null;
}

async function mountGame(source: string, provider = files, views = 1) {
  seen = null;
  answers = [];
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

/** Draws `count` frames with a task between each, so a report a timer delays lands between frames. */
async function drawFramesApart(renderer: Awaited<ReturnType<typeof mountGame>>, count: number) {
  for (let frame = 0; frame < count; frame++) {
    await drawFrames(renderer, 1);
    await new Promise((nextTask) => setTimeout(nextTask, 10));
  }
}

async function drawFrames(renderer: Awaited<ReturnType<typeof mountGame>>, count: number) {
  await renderer.advanceFrames(count, 1 / 60);
}

describe('the settled value of the In-game view', () => {
  it('counts the nodes that hold a script, and sees the current camera', async () => {
    const renderer = await mountGame(TWO_SCRIPTS_AND_A_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true, missingFiles: NONE });
  });

  it('reports no current camera for a 3D scene with no Camera3D', async () => {
    const renderer = await mountGame(NO_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 0, hasCurrentCamera: false, missingFiles: NONE });
  });

  it('is pending again after the text of the scene changes, until frames show the new text', async () => {
    const renderer = await mountGame(NO_CAMERA);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    await act(async () => renderer.opened.setSource(TWO_SCRIPTS_AND_A_CAMERA));
    await settleLoads();
    expect(seen).toBeNull();
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true, missingFiles: NONE });
  });

  it('is pending while a texture file is on its way, and settles after it lands', async () => {
    let land: (bytes: ArrayBuffer) => void = () => {};
    const slowIcon: ResourceProvider = {
      loadResource: (path) =>
        path === 'res://icon.png' ? new Promise((resolve) => (land = resolve)) : Promise.resolve(null),
    };
    const renderer = await mountGame(SPRITE, slowIcon);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toBeNull();
    await act(async () => land(ICON));
    await settleLoads();
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen).toEqual({ scriptedNodeCount: 0, hasCurrentCamera: false, missingFiles: NONE });
  });

  it('names the file the scene asked for and did not get', async () => {
    const renderer = await mountGame(SPRITE);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(seen?.missingFiles).toEqual(new Set(['res://icon.png']));
  });

  it('answers no missing file on every settle after a write that stops reading it', async () => {
    const renderer = await mountGame(SPRITE);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    answers = [];
    await act(async () => void (await renderer.opened.getNode('.').set('texture', variant('null'))));
    await drawFramesApart(renderer, FRAMES_TO_SETTLE);
    expect(answers.filter((answer) => answer !== null).map((answer) => [...answer.missingFiles])).toEqual([
      [],
    ]);
  });

  it('refuses a second In-game view under one provider, and keeps the first one settled', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const renderer = await mountGame(TWO_SCRIPTS_AND_A_CAMERA, files, 2);
    await drawFrames(renderer, FRAMES_TO_SETTLE);
    expect(error).toHaveBeenCalledWith('[View] expected one view under a TscnSceneProvider, got a second');
    expect(seen).toEqual({ scriptedNodeCount: 2, hasCurrentCamera: true, missingFiles: NONE });
    error.mockRestore();
  });
});
