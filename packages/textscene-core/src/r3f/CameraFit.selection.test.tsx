/**
 * CameraFit is selection-inert.
 *
 * Design decision: selection changes must NEVER move the camera. Once the
 * load-time fit timers (150ms, 500ms, 1100ms) have fired, nothing but a
 * scene/camera change re-frames — an unrequested camera move on click is
 * worse than a selection-gated gizmo extending past the current frame (the
 * user re-frames explicitly via FrameSelectedShortcut). Deterministic
 * `-selected` visual captures are the harness's job (scripts/visual/run.mjs
 * clicks only after the last fit timer has provably fired).
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
 * (150/500/1100ms), resets the mock, then re-renders with `nextPath` and
 * returns the pending-timer count captured immediately before and after that
 * selection change. Callers assert nothing new was scheduled and no frame
 * call ever fires.
 */
async function mountThenSelect(initialPath: string | null, nextPath: string | null) {
  const graph = makeGraph();
  const renderer = await ReactThreeTestRenderer.create(tree(graph, initialPath));
  vi.advanceTimersByTime(1200);
  frameSceneBoundsMock.mockClear();
  const timersBefore = vi.getTimerCount();
  await ReactThreeTestRenderer.act(async () => {
    await renderer.update(tree(graph, nextPath));
  });
  return { timersBefore, timersAfter: vi.getTimerCount() };
}

describe('CameraFit ignores selection changes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    frameSceneBoundsMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules nothing when selectedNodePath becomes non-null', async () => {
    const { timersBefore, timersAfter } = await mountThenSelect(null, 'Root/OmniLight3D');

    expect(timersAfter).toBe(timersBefore);
    vi.advanceTimersByTime(5000);
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('schedules nothing when selectedNodePath changes from one path to another', async () => {
    const { timersBefore, timersAfter } = await mountThenSelect('Root/Node1', 'Root/Node2');

    expect(timersAfter).toBe(timersBefore);
    vi.advanceTimersByTime(5000);
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('schedules nothing when selectedNodePath is cleared back to null', async () => {
    const { timersBefore, timersAfter } = await mountThenSelect('Root/OmniLight3D', null);

    expect(timersAfter).toBe(timersBefore);
    vi.advanceTimersByTime(5000);
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });

  it('stays idle on selection change when an authored camera is active', async () => {
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

    vi.advanceTimersByTime(5000);
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();
  });
});
