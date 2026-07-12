/**
 * CameraFit selection-triggered re-fit (#243).
 *
 * When `selectedNodePath` changes, `CameraFit` must schedule at least one
 * additional delayed `frameSceneBounds` call so selection-mounted gizmo
 * bounds (e.g. a PointLightHelper) are always eventually included in the
 * camera frame — even when the gizmo mounts after the load-time timers
 * (150ms, 500ms, 1100ms) have already fired.
 *
 * Seam: the `frameSceneBounds` module boundary, mocked so we can count
 * calls independently of Three.js scene geometry.
 */
import { useEffect } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';

vi.mock('./frameSceneBounds.js', () => ({
  frameSceneBounds: vi.fn(),
}));

import { frameSceneBounds } from './frameSceneBounds.js';

// CameraFit is not exported from TscnCanvas (it's component-private).
// We import the named export that contains it via TscnSceneContents — but
// since CameraFit is not exported at all, we test it by mounting it
// indirectly through a thin wrapper that only renders the component under
// test inside a ReactThreeTestRenderer tree.
// The cleanest approach: export `CameraFit` for tests (see implementation)
// and import it directly here once the implementation adds that export.
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

describe('CameraFit — selection-triggered re-fit (#243)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    frameSceneBoundsMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules a frame call when selectedNodePath becomes non-null', async () => {
    const graph = makeGraph();
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
        <SelectionProvider>
          <Selector path={null} />
          <CameraFit />
        </SelectionProvider>
      </HierarchyProvider>
    );

    // Drain the load-time timers so only selection-triggered calls are counted.
    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    // Now simulate a selection change.
    await ReactThreeTestRenderer.act(async () => {
      renderer.update(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <Selector path="Root/OmniLight3D" />
            <CameraFit />
          </SelectionProvider>
        </HierarchyProvider>
      );
    });

    // Before timer: no new call yet.
    expect(frameSceneBoundsMock).not.toHaveBeenCalled();

    // After the selection-triggered delay fires, at least one call is expected.
    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('schedules a frame call when selectedNodePath changes from one path to another', async () => {
    const graph = makeGraph();
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
        <SelectionProvider>
          <Selector path="Root/Node1" />
          <CameraFit />
        </SelectionProvider>
      </HierarchyProvider>
    );

    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    await ReactThreeTestRenderer.act(async () => {
      renderer.update(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <Selector path="Root/Node2" />
            <CameraFit />
          </SelectionProvider>
        </HierarchyProvider>
      );
    });

    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('schedules a frame call when selectedNodePath is cleared back to null', async () => {
    const graph = makeGraph();
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
        <SelectionProvider>
          <Selector path="Root/OmniLight3D" />
          <CameraFit />
        </SelectionProvider>
      </HierarchyProvider>
    );

    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    await ReactThreeTestRenderer.act(async () => {
      renderer.update(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <Selector path={null} />
            <CameraFit />
          </SelectionProvider>
        </HierarchyProvider>
      );
    });

    vi.advanceTimersByTime(600);
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(1);
  });

  it('does not schedule an extra frame call when selection is unchanged', async () => {
    const graph = makeGraph();
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
        <SelectionProvider>
          <Selector path="Root/OmniLight3D" />
          <CameraFit />
        </SelectionProvider>
      </HierarchyProvider>
    );

    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    // Re-render with the same selection: no new timer should fire.
    await ReactThreeTestRenderer.act(async () => {
      renderer.update(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <Selector path="Root/OmniLight3D" />
            <CameraFit />
          </SelectionProvider>
        </HierarchyProvider>
      );
    });

    vi.advanceTimersByTime(600);
    // The Selector component will call setSelectedNodePath again, but since
    // the value is the same, React/SelectionContext won't trigger a re-render
    // of CameraFit — zero additional calls expected.
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(0);
  });

  it('does not fire the selection re-fit when an authored camera is active', async () => {
    const graph = makeGraph();
    const { CameraControlProvider } = await import('./contexts/CameraControlContext');
    const { useCameraControl } = await import('./contexts/CameraControlContext');

    function ActivateAuthoredCamera() {
      const { switchToCamera } = useCameraControl();
      useEffect(() => {
        switchToCamera('Root/Camera3D');
      }, [switchToCamera]);
      return null;
    }

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
        <SelectionProvider>
          <CameraControlProvider>
            <ActivateAuthoredCamera />
            <Selector path={null} />
            <CameraFit />
          </CameraControlProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );

    vi.advanceTimersByTime(1200);
    frameSceneBoundsMock.mockClear();

    await ReactThreeTestRenderer.act(async () => {
      renderer.update(
        <HierarchyProvider value={{ sceneGraph: graph, panelId: 'test' }}>
          <SelectionProvider>
            <CameraControlProvider>
              <ActivateAuthoredCamera />
              <Selector path="Root/OmniLight3D" />
              <CameraFit />
            </CameraControlProvider>
          </SelectionProvider>
        </HierarchyProvider>
      );
    });

    vi.advanceTimersByTime(600);
    // With an authored camera active, CameraFit must stay completely idle.
    expect(frameSceneBoundsMock).toHaveBeenCalledTimes(0);
  });
});
