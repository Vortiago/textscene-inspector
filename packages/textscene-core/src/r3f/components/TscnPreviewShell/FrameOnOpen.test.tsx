import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { ViewportModeProvider, useViewportMode, type ViewportMode } from '../../contexts/ViewportModeContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { createEditorCameras } from '../../editorView/editorCamera/editorCameras';
import { variant, type SceneValue } from '../../../scene/variant';
import type { ViewStatus } from '../../viewStatus/viewStatus';
import { EMPTY_VIEW_STATUS } from '../../viewStatus/viewStatus';
import { FrameOnOpen } from './FrameOnOpen';
import { useHeardStatus, type HeardStatusStore } from './previewViewStatus';
import { PreviewCameraProvider, usePreviewCamera, type PreviewCamera } from './previewCamera';

/** Longer than the last load-time timer (1100 ms), so only a settle can fit after it. */
const PAST_LAST_TIMER_MS = 2000;

const FRAMED = variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 9)');
const SETTLED: ViewStatus = {
  ...EMPTY_VIEW_STATUS,
  settled: { scriptedNodeCount: 0, hasCurrentCamera: false },
};

/** A 3D editor camera whose pose a focus moves to `FRAMED`, and the user's moves to anything else. */
function fakeCamera() {
  const cameras = createEditorCameras();
  let pose: SceneValue = variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 4)');
  const focus = vi.fn(() => {
    pose = FRAMED;
    return null;
  });
  const unbind = cameras.slot('Camera3D').bind({
    get: (property) => (property === 'transform' ? pose : null),
    set: () => false,
    call: focus,
    pose: () => null,
    setPose: () => {},
    scene: () => '',
  });
  return {
    view: { editorCamera: cameras.of('3D') },
    focus,
    unbind,
    moveByUser: () => (pose = variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 9)')),
  };
}

const NO_SCENE_WATCH = { getNodeOrNull: () => null, observe: () => () => {} };

async function mount({ frameOnOpen = true, mode = '3D' as ViewportMode } = {}) {
  const camera = fakeCamera();
  const heard = renderHook(useHeardStatus).result.current;
  const fake = createFakeResourceLoader();
  let preview: PreviewCamera | null = null;
  let setMode: (mode: ViewportMode) => void = () => {};
  function PreviewProbe() {
    preview = usePreviewCamera();
    setMode = useViewportMode().setMode;
    return null;
  }
  await act(async () => {
    render(
      <ResourceLoaderProvider loader={fake.loader}>
        <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene({ nodes: [] }), panelId: 'p' }}>
          <ViewportModeProvider initialFrameOnOpen={frameOnOpen} initialMode={mode}>
            <PreviewCameraProvider scene={NO_SCENE_WATCH}>
              <PreviewProbe />
              <FrameOnOpen view={camera.view} heard={heard} />
            </PreviewCameraProvider>
          </ViewportModeProvider>
        </HierarchyProvider>
      </ResourceLoaderProvider>
    );
  });
  const runTimers = () => act(async () => void vi.advanceTimersByTime(PAST_LAST_TIMER_MS));
  const switchTo = (next: ViewportMode) => act(async () => setMode(next));
  return { ...camera, heard, loader: fake.loader, preview: () => preview!, runTimers, switchTo };
}

/** A view that settled once, then started a `.glb` load, with every fit timer run out. */
async function mountWithLateLoad() {
  const mounted = await mount();
  heardSettle(mounted.heard);
  const releaseLateLoad = mounted.loader.beginPending();
  mounted.heard.onStatusChange(EMPTY_VIEW_STATUS);
  await mounted.runTimers();
  mounted.focus.mockClear();
  const settleLoad = () =>
    act(async () => {
      releaseLateLoad();
      heardSettle(mounted.heard);
    });
  return { ...mounted, settleLoad };
}

function heardSettle(heard: HeardStatusStore): void {
  heard.onStatusChange(SETTLED);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FrameOnOpen', () => {
  it('leaves the camera where Godot would leave it by default', async () => {
    const { focus, runTimers } = await mount({ frameOnOpen: false });

    await runTimers();

    expect(focus).not.toHaveBeenCalled();
  });

  it('frames the scene through the editor camera once the user asks for it', async () => {
    const { focus, runTimers } = await mount();

    await runTimers();

    expect(focus).toHaveBeenCalledWith('focus', []);
  });

  it('frames nothing in the 2D mode, whose camera opens fitted to the frame', async () => {
    const { focus, runTimers } = await mount({ mode: '2D' });

    await runTimers();

    expect(focus).not.toHaveBeenCalled();
  });

  // node_3d_editor_plugin.cpp:4486-4492
  it('does not frame the scene again when a camera preview ends', async () => {
    const { focus, preview, runTimers } = await mount();
    await runTimers();
    await act(async () => preview().previewCamera('Root/Camera3D'));
    focus.mockClear();

    await act(async () => preview().endPreview());
    await runTimers();

    expect(focus).not.toHaveBeenCalled();
  });

  it('leaves the camera where it was on a switch to 2D and back', async () => {
    const { focus, runTimers, switchTo } = await mount();
    await runTimers();
    focus.mockClear();

    await switchTo('2D');
    await switchTo('3D');
    await runTimers();

    expect(focus).not.toHaveBeenCalled();
  });

  it('frames a scene first seen after a switch from 2D', async () => {
    const { focus, runTimers, switchTo } = await mount({ mode: '2D' });
    await runTimers();

    await switchTo('3D');
    await runTimers();

    expect(focus).toHaveBeenCalledWith('focus', []);
  });

  it('starts no fit while no 3D stage is mounted, so none lands on a later one', async () => {
    const { focus, runTimers, unbind } = await mount();
    unbind();

    await runTimers();

    expect(focus).not.toHaveBeenCalled();
  });

  it('frames a load that finishes after an earlier settle and after every timer', async () => {
    const { focus, settleLoad } = await mountWithLateLoad();

    await settleLoad();

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('leaves a camera the user has moved since the last fit', async () => {
    const { focus, settleLoad, moveByUser } = await mountWithLateLoad();
    moveByUser();

    await settleLoad();

    expect(focus).not.toHaveBeenCalled();
  });

  it('does not frame again when a property write that loads nothing settles the view', async () => {
    const { focus, heard, settleLoad } = await mountWithLateLoad();
    await settleLoad();
    focus.mockClear();

    await act(async () => {
      heard.onStatusChange(EMPTY_VIEW_STATUS);
      heardSettle(heard);
    });

    expect(focus).not.toHaveBeenCalled();
  });
});
