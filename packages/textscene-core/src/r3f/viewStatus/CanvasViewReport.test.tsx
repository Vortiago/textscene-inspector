import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFrame, type RootState } from '@react-three/fiber';
import { act, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import { TscnSceneContents } from '../SceneContents';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { r3fStateProbe } from '../testing/R3FStateProbe';
import { CanvasViewReport } from './CanvasViewReport';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatusStore, type ViewStatusStore } from './viewStatus';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { createPendingProbe } from '../../resources/testing/pendingProbe';
import { useProceduralTexture } from '../../resources/useProceduralTexture';
import type { ProceduralTextureLookup } from '../../resources/textures/proceduralBuilds';
import { useSettledFonts } from '../controls/native/text/useSettledFont';
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
  const frames: { count: number; onFrame?: () => void } = { count: 0 };
  function Counter(): null {
    useFrame(() => {
      frames.count++;
      frames.onFrame?.();
    });
    return null;
  }
  return { frames, Counter };
}

function PendingLoad(): null {
  usePendingWhile(true);
  return null;
}

const NEVER = new Promise<never>(() => {});

/** A procedural texture whose build never lands. */
const UNBUILT_TEXTURE: ProceduralTextureLookup = {
  status: 'pending',
  key: 'unbuilt',
  start: () => ({ settled: NEVER, release: () => {} }),
};

function PendingTextureBuild(): null {
  useProceduralTexture(UNBUILT_TEXTURE);
  return null;
}

/** Keyed by the component, so each mount of it peeks its own load. */
function PendingFontLoad(): null {
  const [loadKey] = useState(() => ({}));
  useSettledFonts().peekOutlines(loadKey, () => NEVER);
  return null;
}

/** `extra` renders inside the view, beside its contents. All views read `files`, so they share one loader. */
async function mountEditor(source: string, extra?: ReactNode) {
  const status = createViewStatusStore();
  const scene = openScene({ source, provider: files });
  const gl: { current: THREE.WebGLRenderer | null } = { current: null };
  const { frames, Counter } = frameCounter();
  const { Probe, state } = r3fStateProbe();
  const view = createPendingProbe();
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <ViewStatusProvider store={status}>
        <CaptureRenderer captured={gl} />
        <Counter />
        <Probe />
        <view.Probe />
        <TscnSceneContents />
        <CanvasViewReport />
        {extra}
      </ViewStatusProvider>
    </TscnSceneProvider>
  );
  await settleLoads();
  const settle = () => drawFrames(state, FRAMES_TO_SETTLE);
  const drawFrame = () => drawFrames(state, 1);
  return { renderer, scene, status, gl: gl.current!, frames, settle, drawFrame, work: view.work };
}

/** Whole frames, the render and its after effects included, which `advanceFrames` does not run. */
async function drawFrames(state: () => RootState, count: number) {
  for (let i = 0; i < count; i++) await act(async () => state().advance(state().clock.elapsedTime + 1 / 60));
}

async function settledStatus(source: string): Promise<ViewStatusStore> {
  const mounted = await mountEditor(source);
  await mounted.settle();
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
    const { scene, status, settle } = await mountEditor(NO_CAMERA);
    await settle();
    await act(async () => scene.setSource(SCRIPTED_WITH_CAMERA));
    await settleLoads();
    expect(status.settled()).toBeNull();
    await settle();
    expect(status.settled()).toEqual({
      scriptedNodeCount: 1,
      hasCurrentCamera: true,
    });
  });

  it('is pending once a file starts to load, before any frame draws', async () => {
    const { status, settle, work } = await mountEditor(NO_CAMERA);
    await settle();

    const endFontWork = work().fonts.begin();
    onTestFinished(endFontWork);
    await act(async () => {});

    expect(status.isPending()).toBe(true);
  });

  it('settles only on a frame drawn after the load ends', async () => {
    const { status, settle, work } = await mountEditor(NO_CAMERA);
    await settle();
    const endFontWork = work().fonts.begin();
    onTestFinished(endFontWork);
    await act(async () => {});

    endFontWork();
    await act(async () => {});
    expect(status.isPending()).toBe(true);
    await settle();

    expect(status.isPending()).toBe(false);
  });

  it('stays settled while another view on the same provider loads', async () => {
    const quiet = await mountEditor(NO_CAMERA);
    const loading = await mountEditor(NO_CAMERA, <PendingLoad />);
    await loading.settle();
    await quiet.settle();

    expect(loading.status.status().pending.resources).toBe(1);
    expect(quiet.status.status().pending.resources).toBe(0);
    expect(quiet.status.settled()).not.toBeNull();
  });

  it('stays settled while another view on the same provider builds a texture', async () => {
    const quiet = await mountEditor(NO_CAMERA);
    const building = await mountEditor(NO_CAMERA, <PendingTextureBuild />);
    await building.settle();
    await quiet.settle();

    expect(building.status.status().pending.textures).toBe(1);
    expect(quiet.status.status().pending.textures).toBe(0);
    expect(quiet.status.settled()).not.toBeNull();
  });

  it('stays settled while another view on the same provider loads a font', async () => {
    const quiet = await mountEditor(NO_CAMERA);
    const loading = await mountEditor(NO_CAMERA, <PendingFontLoad />);
    await loading.settle();
    await quiet.settle();

    expect(loading.status.status().pending.fonts).toBe(1);
    expect(quiet.status.status().pending.fonts).toBe(0);
    expect(quiet.status.settled()).not.toBeNull();
  });

  it('stops reporting once the view unmounts, so the status waits for the next view', async () => {
    const { renderer, status, settle } = await mountEditor(NO_CAMERA);
    await settle();
    await renderer.unmount();
    expect(status.settled()).toBeNull();
  });

  it('reports a frame once its render has drawn it', async () => {
    const { status, gl, frames, drawFrame } = await mountEditor(NO_CAMERA);
    const calls: string[] = [];
    frames.onFrame = () => calls.push('frame');
    vi.spyOn(gl, 'render').mockImplementation(() => void calls.push('render'));
    vi.spyOn(status, 'frameDrawn').mockImplementation(() => void calls.push('report'));

    await drawFrame();

    const frameToReport = calls.slice(calls.indexOf('frame'), calls.indexOf('report'));
    expect(frameToReport).toContain('render');
  });
});

describe('the capture of an editor view', () => {
  it('draws one frame and reads the canvas at the size of its drawing buffer', async () => {
    const { status, gl, frames, settle } = await mountEditor(NO_CAMERA);
    await settle();
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl.getContext();
    const framesBefore = frames.count;

    const image = await status.captureImage();

    expect({ width: image.width, height: image.height }).toEqual({ width, height });
    expect(image.data).toHaveLength(width * height * 4);
    expect(frames.count).toBe(framesBefore + 1);
  });
});
