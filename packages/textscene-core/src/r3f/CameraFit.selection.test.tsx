/**
 * CameraFit selection-triggered re-fit.
 *
 * When `selectedNodePath` changes, `CameraFit` must schedule one additional
 * delayed `frameSceneBounds` call so selection-mounted gizmo bounds (e.g. a
 * PointLightHelper) are always eventually included in the camera frame, even
 * when the gizmo mounts after the load-time timers (150ms, 500ms, 1100ms)
 * have already fired.
 *
 * Seam: the `frameSceneBounds` module boundary, mocked so we can count
 * calls independently of Three.js scene geometry.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { CameraControlProvider, useCameraControl } from './contexts/CameraControlContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';

vi.mock('./frameSceneBounds.js', () => ({
  frameSceneBounds: vi.fn(),
}));

import { frameSceneBounds } from './frameSceneBounds.js';

// Exported from TscnCanvas for direct unit mounting: CameraFit needs
// `useThree`, so it can only be exercised inside a test-renderer tree.
import { CameraFit } from './TscnCanvas';

const frameSceneBoundsMock = frameSceneBounds as ReturnType<typeof vi.fn>;

function makeGraph() {
  return createSceneGraphFromTscnScene({ nodes: [] });
}

/** Drives the SelectionContext's selectedNodePath from inside the renderer. */
function Selector({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

function tree(graph: ReturnType<typeof makeGraph>, path: string | null) {
  return (
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
      <SelectionProvider>
        <Selector path={path} />
        <CameraFit />
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/**
 * Mounts CameraFit with `initialPath` selected, drains the load-time timers
 * (150/500/1100ms plus the mount-time 300ms fit), resets the mock, then
 * re-renders with `nextPath`. Callers assert on what the pending
 * selection-triggered timer (if any) does.
 */
async function mountThenSelect(initialPath: string | null, nextPath: string | null) {
  const graph = makeGraph();
  const renderer = await ReactThreeTestRenderer.create(tree(graph, initialPath));
  vi.advanceTimersByTime(1200);
  frameSceneBoundsMock.mockClear();
  await ReactThreeTestRenderer.act(async () => {
    await renderer.update(tree(graph, nextPath));
  });
}

describe('CameraFit selection-triggered re-fit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    frameSceneBoundsMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules a frame call when selectedNodePath becomes non-null', async () => {
    await mountThenSelect(null, 'Root/OmniLight3D');

    // Before the delayed timer fires: no new call yet.
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();

    // After the selection-triggered delay fires, at least one call is expected.
    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('schedules a frame call when selectedNodePath changes from one path to another', async () => {
    await mountThenSelect('Root/Node1', 'Root/Node2');

    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('schedules a frame call when selectedNodePath is cleared back to null', async () => {
    await mountThenSelect('Root/OmniLight3D', null);

    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('does not schedule an extra frame call when selection is unchanged', async () => {
    await mountThenSelect('Root/OmniLight3D', 'Root/OmniLight3D');

    vi.advanceTimersByTime(600);
    // The Selector component re-sets the same path; SelectionContext bails
    // on the no-op update, so CameraFit's selection effect never re-runs.
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(0);
  });

  it('does not fire the selection re-fit when an authored camera is active', async () => {
    const graph = makeGraph();

    function ActivateAuthoredCamera() {
      const { switchToCamera } = useCameraControl();
      useEffect(() => {
        switchToCamera('Root/Camera3D');
      }, [switchToCamera]);
      return null;
    }

    function cameraTree(path: string | null) {
      return (
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <CameraControlProvider>
              <ActivateAuthoredCamera />
              <Selector path={path} />
              <CameraFit />
            </CameraControlProvider>
          </SelectionProvider>
        </HierarchyProvider>
      );
    }

    const renderer = await ReactThreeTestRenderer.create(cameraTree(null));
    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    await ReactThreeTestRenderer.act(async () => {
      await renderer.update(cameraTree('Root/OmniLight3D'));
    });

    vi.advanceTimersByTime(600);
    // With an authored camera active, CameraFit must stay completely idle.
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(0);
  });
});
