import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame } from '@react-three/fiber';
import { act } from 'react';
import type * as THREE from 'three';
import { TscnSceneContents } from '../TscnCanvas';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { EditorViewReport } from './EditorViewReport';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatus, type ViewStatus } from './viewStatus';
import '../nodes';

/** Enough frames for work that a frame advances, such as a texture upload, to finish. */
const FRAMES_TO_SETTLE = 10;

const SCRIPT = 'extends Node\n';

const SCRIPTED_WITH_CAMERA = `[gd_scene format=3]

[ext_resource type="Script" path="res://mover.gd" id="1"]

[node name="Main" type="Node3D"]
script = ExtResource("1")

[node name="Camera3D" type="Camera3D" parent="."]
current = true
`;

const NO_CAMERA = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="CSGBox3D" parent="."]
`;

const files: ResourceProvider = {
  loadResource: async (path) => (path === 'res://mover.gd' ? SCRIPT : null),
};

/** Counts the frames the canvas runs. */
function frameCounter() {
  const frames = { count: 0 };
  function Counter(): null {
    useFrame(() => {
      frames.count++;
    });
    return null;
  }
  return { frames, Counter };
}

async function mountEditor(source: string) {
  const status = createViewStatus();
  const scene = openScene({ source, provider: files });
  const gl: { current: THREE.WebGLRenderer | null } = { current: null };
  const { frames, Counter } = frameCounter();
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <ViewStatusProvider status={status}>
        <CaptureRenderer captured={gl} />
        <Counter />
        <TscnSceneContents />
        <EditorViewReport />
      </ViewStatusProvider>
    </TscnSceneProvider>
  );
  await settleLoads();
  return { renderer, scene, status, gl: gl.current!, frames };
}

async function settle(renderer: Awaited<ReturnType<typeof mountEditor>>['renderer']) {
  await renderer.advanceFrames(FRAMES_TO_SETTLE, 1 / 60);
}

async function settledStatus(source: string): Promise<ViewStatus> {
  const mounted = await mountEditor(source);
  await settle(mounted.renderer);
  return mounted.status;
}

afterEach(() => vi.restoreAllMocks());

describe('the settled signal of an editor view', () => {
  it('settles once a frame draws the scene, with the facts of the In-game view', async () => {
    expect((await settledStatus(SCRIPTED_WITH_CAMERA)).settled()).toEqual({
      scriptedNodeCount: 1,
      hasCurrentCamera: true,
    });
  });

  it('reports no current camera for a scene with no Camera3D', async () => {
    expect((await settledStatus(NO_CAMERA)).settled()).toEqual({
      scriptedNodeCount: 0,
      hasCurrentCamera: false,
    });
  });

  it('is pending after the text of the scene changes, until a frame draws the new text', async () => {
    const { renderer, scene, status } = await mountEditor(NO_CAMERA);
    await settle(renderer);
    await act(async () => scene.setSource(SCRIPTED_WITH_CAMERA));
    await settleLoads();
    expect(status.settled()).toBeNull();
    await settle(renderer);
    expect(status.settled()).toEqual({ scriptedNodeCount: 1, hasCurrentCamera: true });
  });

  it('stops reporting once the view unmounts, so the status waits for the next view', async () => {
    const { renderer, status } = await mountEditor(NO_CAMERA);
    await settle(renderer);
    await renderer.unmount();
    expect(status.settled()).toBeNull();
  });
});

describe('the capture of an editor view', () => {
  it('draws one frame and reads the canvas at the size of its drawing buffer', async () => {
    const { renderer, status, gl, frames } = await mountEditor(NO_CAMERA);
    await settle(renderer);
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl.getContext();
    const framesBefore = frames.count;

    const image = await status.captureImage();

    expect({ width: image.width, height: image.height }).toEqual({ width, height });
    expect(image.data).toHaveLength(width * height * 4);
    expect(frames.count).toBe(framesBefore + 1);
  });
});
