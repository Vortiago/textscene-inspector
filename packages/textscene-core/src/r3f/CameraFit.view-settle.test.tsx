import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { ViewStatusProvider } from './viewStatus/ViewStatusContext';
import { createViewStatus, type DrawnFrame, type ViewStatus } from './viewStatus/viewStatus';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import type { Scene } from '../scene/openScene';

vi.mock('./frameSceneBounds.js', () => ({
  frameSceneBounds: vi.fn(),
}));

import { frameSceneBounds } from './frameSceneBounds.js';
import { CameraFit } from './CameraFit';

const frameSceneBoundsMock = frameSceneBounds as ReturnType<typeof vi.fn>;

/** Longer than CameraFit's last load-time timer (1100 ms), so only a settle can fit after it. */
const PAST_LAST_TIMER_MS = 2000;

/** Hands the test the render camera, as the user's orbit would reach it. */
function CameraProbe({ onCamera }: { onCamera: (camera: THREE.Camera) => void }) {
  onCamera(useThree((s) => s.camera));
  return null;
}

const FACTS = { scriptedNodeCount: 0, hasCurrentCamera: false };

/** A frame of `revision`, with one resource still loading or none. */
function frameDrawn(status: ViewStatus, resources: number, revision = 1): void {
  const frame: DrawnFrame = {
    revision,
    isFullSize: true,
    work: { resources, textures: 0, fonts: 0 },
    facts: FACTS,
  };
  status.frameDrawn(frame);
}

/** A settle fits after the frame that reported it, in a microtask. */
const settledFit = () => Promise.resolve();

/** A view that settled once, then drew a frame with a `.glb` load pending, with every fit timer run out. */
async function mountWithLateLoad() {
  const status = createViewStatus();
  let revision = 1;
  const scene = { revision: () => revision, subscribe: () => () => {} };
  status.attach(scene);
  let camera: THREE.Camera | null = null;
  await ReactThreeTestRenderer.create(
    <ViewStatusProvider status={status}>
      <HierarchyProvider
        value={{
          sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }),
          scene: scene as unknown as Scene,
          panelId: 'p',
        }}
      >
        <ViewportModeProvider initialFrameOnOpen={true}>
          <CameraFit />
          <CameraProbe onCamera={(c) => (camera = c)} />
        </ViewportModeProvider>
      </HierarchyProvider>
    </ViewStatusProvider>
  );
  frameDrawn(status, 0);
  await settledFit();
  frameDrawn(status, 1);
  vi.advanceTimersByTime(PAST_LAST_TIMER_MS);
  frameSceneBoundsMock.mockClear();
  if (!camera) throw new Error('expected the probe to report the render camera, got none');
  // A frame from before the write is pending, and the frame that draws it settles.
  const settleWrite = async () => {
    revision++;
    frameDrawn(status, 0, revision - 1);
    frameDrawn(status, 0, revision);
    await settledFit();
  };
  const settle = async () => {
    frameDrawn(status, 0);
    await settledFit();
  };
  return { settle, settleWrite, camera: camera as THREE.Camera };
}

describe('CameraFit after the view settles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    frameSceneBoundsMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('frames a load that finishes after an earlier settle and after every timer', async () => {
    const { settle } = await mountWithLateLoad();

    await settle();

    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('leaves a camera the user has moved since the last fit', async () => {
    const { settle, camera } = await mountWithLateLoad();
    camera.position.x += 1;

    await settle();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('leaves a camera the user has turned in place since the last fit', async () => {
    const { settle, camera } = await mountWithLateLoad();
    camera.rotateY(0.1);

    await settle();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('leaves a camera the user has zoomed since the last fit', async () => {
    const { settle, camera } = await mountWithLateLoad();
    (camera as THREE.PerspectiveCamera).zoom = 2;

    await settle();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('does not frame again when a property write settles the view', async () => {
    const { settle, settleWrite } = await mountWithLateLoad();
    await settle();
    frameSceneBoundsMock.mockClear();

    await settleWrite();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });
});
