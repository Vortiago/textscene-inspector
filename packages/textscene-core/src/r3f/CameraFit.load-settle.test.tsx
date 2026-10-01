/**
 * CameraFit's loader-driven fit: each time the loader's pending count returns to zero, it frames
 * again, unless the user has moved the camera. A count can touch zero before a later consumer, such
 * as an instanced `.glb`, starts its load, so a fit that fires once would frame an empty scene.
 * `frameSceneBounds` is mocked, so the calls count whatever the scene holds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';

vi.mock('./frameSceneBounds.js', () => ({
  frameSceneBounds: vi.fn(),
}));

import { frameSceneBounds } from './frameSceneBounds.js';
import { CameraFit } from './TscnCanvas';

const frameSceneBoundsMock = frameSceneBounds as ReturnType<typeof vi.fn>;

/** Longer than CameraFit's last load-time timer (1100 ms), so only the loader can fit after it. */
const PAST_LAST_TIMER_MS = 2000;

/** Hands the test the render camera, as the user's orbit would reach it. */
function CameraProbe({ onCamera }: { onCamera: (camera: THREE.Camera) => void }) {
  onCamera(useThree((s) => s.camera));
  return null;
}

/**
 * Mounts CameraFit over a fake loader whose count has already touched zero once (the scene's own
 * resources) and then gone pending again (a `.glb` whose load starts later), and runs every
 * load-time timer out. Returns the release of that second load and the render camera.
 */
async function mountWithLateLoad() {
  const fake = createFakeResourceLoader();
  let camera: THREE.Camera | null = null;
  await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }), panelId: 'p' }}>
        <ViewportModeProvider initialFrameOnOpen={true}>
          <CameraFit />
          <CameraProbe onCamera={(c) => (camera = c)} />
        </ViewportModeProvider>
      </HierarchyProvider>
    </ResourceLoaderProvider>
  );
  fake.loader.beginPending()();
  const releaseLateLoad = fake.loader.beginPending();
  vi.advanceTimersByTime(PAST_LAST_TIMER_MS);
  frameSceneBoundsMock.mockClear();
  if (!camera) throw new Error('expected the probe to report the render camera, got none');
  return { releaseLateLoad, camera: camera as THREE.Camera };
}

describe('CameraFit after the loader settles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    frameSceneBoundsMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('frames a load that finishes after an earlier settle and after every timer', async () => {
    const { releaseLateLoad } = await mountWithLateLoad();

    releaseLateLoad();

    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('leaves a camera the user has moved since the last fit', async () => {
    const { releaseLateLoad, camera } = await mountWithLateLoad();
    camera.position.x += 1;

    releaseLateLoad();

    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });
});
