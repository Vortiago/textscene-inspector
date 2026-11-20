import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { ViewStatusProvider } from './viewStatus/ViewStatusContext';
import { createViewStatus, type DrawnFrame, type ViewStatus } from './viewStatus/viewStatus';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';

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

const NO_FILES: ReadonlySet<string> = new Set();
const FACTS = { scriptedNodeCount: 0, hasCurrentCamera: false, missingFiles: NO_FILES };

/** A frame of `revision`, with one resource still loading or none. */
function frameDrawn(status: ViewStatus, resources: number, revision: number): void {
  const frame: DrawnFrame = {
    revision,
    isFullSize: true,
    awaitedCamera: null,
    work: { resources, textures: 0, fonts: 0 },
    facts: FACTS,
  };
  status.frameDrawn(frame);
}

/** A view that settled once, then drew a frame with a `.glb` load pending, with every fit timer run out. */
async function mountWithLateLoad() {
  const status = createViewStatus();
  const fake = createFakeResourceLoader();
  let revision = 1;
  status.attach({ revision: () => revision, missingFiles: () => NO_FILES, subscribe: () => () => {} });
  let camera: THREE.Camera | null = null;
  await ReactThreeTestRenderer.create(
    <ViewStatusProvider status={status}>
      <ResourceLoaderProvider loader={fake.loader}>
        <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }), panelId: 'p' }}>
          <ViewportModeProvider initialFrameOnOpen={true}>
            <CameraFit />
            <CameraProbe onCamera={(c) => (camera = c)} />
          </ViewportModeProvider>
        </HierarchyProvider>
      </ResourceLoaderProvider>
    </ViewStatusProvider>
  );
  frameDrawn(status, 0, revision);
  const releaseLateLoad = fake.loader.beginPending();
  frameDrawn(status, 1, revision);
  vi.advanceTimersByTime(PAST_LAST_TIMER_MS);
  frameSceneBoundsMock.mockClear();
  if (!camera) throw new Error('expected the probe to report the render camera, got none');
  const settleLoad = () => {
    releaseLateLoad();
    frameDrawn(status, 0, revision);
  };
  // A frame from before the write is pending, and the frame that draws it settles.
  const settleWrite = () => {
    revision++;
    frameDrawn(status, 0, revision - 1);
    frameDrawn(status, 0, revision);
  };
  return { settleLoad, settleWrite, camera: camera as THREE.Camera };
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
    const { settleLoad } = await mountWithLateLoad();

    settleLoad();

    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('leaves a camera the user has moved since the last fit', async () => {
    const { settleLoad, camera } = await mountWithLateLoad();
    camera.position.x += 1;

    settleLoad();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('leaves a camera the user has turned in place since the last fit', async () => {
    const { settleLoad, camera } = await mountWithLateLoad();
    camera.rotateY(0.1);

    settleLoad();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('leaves a camera the user has zoomed since the last fit', async () => {
    const { settleLoad, camera } = await mountWithLateLoad();
    (camera as THREE.PerspectiveCamera).zoom = 2;

    settleLoad();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('does not frame again when a property write that loads nothing settles the view', async () => {
    const { settleLoad, settleWrite } = await mountWithLateLoad();
    settleLoad();
    frameSceneBoundsMock.mockClear();

    settleWrite();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });
});
