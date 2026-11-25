import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewportModeProvider, useViewportMode } from '../ViewportMode/ViewportModeContext';
import type { ViewportMode } from '../../viewportMode';
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
const LOADING_A_RESOURCE: ViewStatus = {
  ...EMPTY_VIEW_STATUS,
  pending: { ...EMPTY_VIEW_STATUS.pending, resources: 1 },
};

/** A 3D editor camera whose pose a focus moves to `FRAMED`, and the user's moves to anything else. */
function fakeCamera({ isBound }: { isBound: boolean }) {
  const cameras = createEditorCameras();
  let pose: SceneValue = variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 4)');
  const focus = vi.fn(() => {
    pose = FRAMED;
    return null;
  });
  const bind = () =>
    cameras.slot('Camera3D').bind({
      get: (property) => (property === 'transform' ? pose : null),
      set: () => false,
      call: focus,
      pose: () => null,
      setPose: () => {},
      scene: () => '',
    });
  let unbind = isBound ? bind() : () => {};
  return {
    view: { editorCamera: cameras.of('3D') },
    focus,
    bindLate: () => (unbind = bind()),
    unbind: () => unbind(),
    moveByUser: () => (pose = variant('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 9)')),
  };
}

const NO_SCENE_WATCH = { getNodeOrNull: () => null, observe: () => () => {} };

async function mount({ frameOnOpen = true, mode = '3D' as ViewportMode, isStageBound = true } = {}) {
  const camera = fakeCamera({ isBound: isStageBound });
  const heard = renderHook(useHeardStatus).result.current;
  let preview: PreviewCamera | null = null;
  let setMode: (mode: ViewportMode) => void = () => {};
  function PreviewProbe() {
    preview = usePreviewCamera();
    setMode = useViewportMode().setMode;
    return null;
  }
  const shell = (rootScenePath: string) => (
    <ViewportModeProvider initialFrameOnOpen={frameOnOpen} initialMode={mode}>
      <PreviewCameraProvider scene={NO_SCENE_WATCH}>
        <PreviewProbe />
        <FrameOnOpen rootScenePath={rootScenePath} hasScene view={camera.view} heard={heard} />
      </PreviewCameraProvider>
    </ViewportModeProvider>
  );
  let rerender: (ui: ReturnType<typeof shell>) => void = () => {};
  await act(async () => {
    rerender = render(shell('res://main.tscn')).rerender;
  });
  const runTimers = () => act(async () => void vi.advanceTimersByTime(PAST_LAST_TIMER_MS));
  const switchTo = (next: ViewportMode) => act(async () => setMode(next));
  const open = (rootScenePath: string) => act(async () => rerender(shell(rootScenePath)));
  return { ...camera, heard, preview: () => preview!, runTimers, switchTo, open };
}

/** A view that settled once, then started a `.glb` load, with every fit timer run out. */
async function mountWithLateLoad() {
  const mounted = await mount();
  heardSettle(mounted.heard);
  mounted.heard.onStatusChange(LOADING_A_RESOURCE);
  await mounted.runTimers();
  mounted.focus.mockClear();
  const settleLoad = () =>
    act(async () => {
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

  it('frames a scene whose 3D stage binds after every timer, as a hidden canvas does', async () => {
    const { focus, runTimers, bindLate } = await mount({ isStageBound: false });
    await runTimers();

    await act(async () => void bindLate());
    await runTimers();

    expect(focus).toHaveBeenCalledWith('focus', []);
  });

  it('frames on the first settle when the view reports nothing before it, as its loads may be over', async () => {
    const { focus, heard, runTimers } = await mount();
    await runTimers();
    focus.mockClear();

    await act(async () => heardSettle(heard));

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('leaves an orbit made before a switch to 2D and back when the view first reports a settle', async () => {
    const { focus, heard, moveByUser, runTimers, switchTo } = await mount();
    await runTimers();
    moveByUser();
    await switchTo('2D');
    await switchTo('3D');
    focus.mockClear();

    await act(async () => heardSettle(heard));

    expect(focus).not.toHaveBeenCalled();
  });

  it("frames a new scene's first settle though the last status heard is the old scene's", async () => {
    const { focus, heard, open, runTimers } = await mount();
    heardSettle(heard);
    await runTimers();
    await open('res://other.tscn');
    await runTimers();
    focus.mockClear();

    await act(async () => heardSettle(heard));

    expect(focus).toHaveBeenCalledTimes(1);
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
