import { useImperativeHandle, type Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ViewAnswers } from '../../viewStatus/viewAnswers';
import type { DrawnFrame, ViewSettled, ViewStatus } from '../../viewStatus/viewStatus';
import { useViewStatus } from '../../viewStatus/ViewStatusContext';
import type { PendingSceneWork } from '../../sceneWork';
import type { PreviewCaptureState } from './previewCaptureState';
import { textureWork } from '../../../resources/textures/textureWork';
import { SCENE_LOAD_STATUS_TESTID, TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';

const SETTLED: ViewSettled = { scriptedNodeCount: 0, hasCurrentCamera: false };

/** One mounted view, as a test drives it: its `settled` resolves only when the test says so. */
interface StubView {
  readonly mode: string;
  readonly image: Blob;
  settle(): void;
  fail(error: Error): void;
}

/** Written by each stub view as it mounts, and cleared by `arrangeViews`. */
const views: StubView[] = [];
/** The error the next stub view throws as it renders, as a canvas with no WebGL context does. */
let renderError: Error | null = null;

function arrangeViews(error: Error | null = null): void {
  views.length = 0;
  renderError = error;
}

/** The status the shell hands its view. Written by each stub view as it renders. */
let shellStatus: ViewStatus | null = null;

const NO_WORK: PendingSceneWork = { resources: 0, textures: 0, fonts: 0 };

/** Draws one frame of a view that waits on `work`, as a canvas reports a file it still loads. */
function drawFrame(work: Partial<PendingSceneWork>): void {
  if (!shellStatus) throw new Error('expected the shell to hand its view a status, got none');
  const frame: DrawnFrame = {
    revision: 0,
    isFullSize: true,
    awaitedCamera: null,
    work: { ...NO_WORK, ...work },
    facts: SETTLED,
  };
  shellStatus.attach({
    revision: () => 0,
    subscribe: () => () => {},
  });
  shellStatus.frameDrawn(frame);
}

function latestView(): StubView {
  const view = views[views.length - 1];
  if (!view) throw new Error('expected a mounted view, got none');
  return view;
}

// happy-dom has no WebGL, so the view is a stub whose ref answers as the test drives it.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: (props: { mode?: string; ref?: Ref<ViewAnswers> }) => <StubCanvas {...props} />,
  TscnSceneContents: () => null,
}));

function StubCanvas({ mode = '3D', ref }: { mode?: string; ref?: Ref<ViewAnswers> }) {
  useImperativeHandle(ref, () => stubAnswers(mode), [mode]);
  shellStatus = useViewStatus();
  if (renderError) throw renderError;
  return <div data-testid="canvas-stub" />;
}

/** Each read of `settled` waits anew, as a real view's does, until the test settles or fails the view. */
function stubAnswers(mode: string): ViewAnswers {
  const waits: { resolve: (settled: ViewSettled) => void; reject: (error: Error) => void }[] = [];
  const view: StubView = {
    mode,
    image: new Blob([mode]),
    settle: () => waits.splice(0).forEach((wait) => wait.resolve(SETTLED)),
    fail: (error) => waits.splice(0).forEach((wait) => wait.reject(error)),
  };
  views.push(view);
  return {
    get settled() {
      return new Promise<ViewSettled>((resolve, reject) => waits.push({ resolve, reject }));
    },
    captureImage: () => Promise.resolve(view.image),
  };
}

import { TextShell } from './TscnPreviewShell.testkit';

const SCENE_3D = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

const OTHER_SCENE_3D = `[gd_scene format=3]

[node name="Other" type="Node3D"]
`;

interface RenderedShell {
  readonly states: PreviewCaptureState[];
  readonly showScene: (content: string) => void;
  readonly unmount: () => void;
}

function renderShell(content = SCENE_3D): RenderedShell {
  const states: PreviewCaptureState[] = [];
  const shellWith = (content: string) => (
    <TextShell
      panelId="capture"
      content={content}
      initialViewportMode="3D"
      onCaptureStateChange={(state) => states.push(state)}
    />
  );
  const { rerender, unmount } = render(shellWith(content));
  return { states, showScene: (content) => rerender(shellWith(content)), unmount };
}

function latest(states: PreviewCaptureState[]): PreviewCaptureState | undefined {
  return states[states.length - 1];
}

/** A capture waits for the view to settle again, as a host's request may follow a change. */
async function expectCapture(state: PreviewCaptureState | undefined, view: StubView): Promise<void> {
  if (state?.status !== 'ready') throw new Error(`expected a ready state, got ${state?.status}`);
  const image = state.capture();
  view.settle();
  await expect(image).resolves.toBe(view.image);
}

/** After the scene's own tree work, which a handle read starts and which moves its revision. */
async function settleLatestView(): Promise<void> {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  await act(async () => latestView().settle());
}

describe('<TextShell> capture state', () => {
  it('reports pending until the view settles', () => {
    arrangeViews();

    const { states } = renderShell();

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports ready once the view settles, and its capture gives the view image', async () => {
    arrangeViews();
    const { states } = renderShell();

    await settleLatestView();
    const state = latest(states);

    expect(state?.status).toBe('ready');
    await expectCapture(state, latestView());
  });

  it('reports the renderer error when the canvas cannot create a WebGL context', () => {
    arrangeViews(new Error('THREE.WebGLRenderer: Error creating WebGL context.'));
    // The boundary logs the caught error, which is the case under test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { states } = renderShell();
    consoleError.mockRestore();

    expect(latest(states)).toEqual({
      status: 'unavailable',
      reason: 'The viewport crashed: THREE.WebGLRenderer: Error creating WebGL context.',
    });
  });

  it('reports why the view will never settle', async () => {
    arrangeViews();
    const { states } = renderShell();

    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    await act(async () => latestView().fail(new Error('Node not found: "Rig/Gone"')));

    expect(latest(states)).toEqual({ status: 'unavailable', reason: 'Node not found: "Rig/Gone"' });
  });

  it('captures the 2D view once the 2D view settles', async () => {
    arrangeViews();
    const { states } = renderShell();
    await settleLatestView();

    await userEvent.click(screen.getByRole('button', { name: '2D' }));
    expect(latest(states)).toEqual({ status: 'pending' });
    await settleLatestView();
    const state = latest(states);

    expect(latestView().mode).toBe('2D');
    await expectCapture(state, latestView());
  });

  it.each([
    ['a resource', 'resources'],
    ['a texture', 'textures'],
    ['a font', 'fonts'],
  ] as const)('reports pending while the settled view loads %s, and ready once it lands', async (_, kind) => {
    arrangeViews();
    const { states } = renderShell();
    await settleLatestView();

    act(() => drawFrame({ [kind]: 1 }));
    expect(latest(states)).toEqual({ status: 'pending' });
    act(() => drawFrame(NO_WORK));
    await settleLatestView();

    await expectCapture(latest(states), latestView());
  });

  it('reports pending again for a load that starts and ends before the shell renders', async () => {
    arrangeViews();
    const { states } = renderShell();
    act(() => drawFrame(NO_WORK));
    await settleLatestView();
    const readyCount = states.length;

    act(() => {
      drawFrame({ resources: 1 });
      drawFrame(NO_WORK);
    });

    expect(states.slice(readyCount)).toEqual([{ status: 'pending' }]);
    await settleLatestView();
    await expectCapture(latest(states), latestView());
  });

  it('reports pending as the shell unmounts', async () => {
    arrangeViews();
    const { states, unmount } = renderShell();
    await settleLatestView();

    await act(async () => unmount());

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports pending after a scene change until the view settles on it', async () => {
    arrangeViews();
    const { states, showScene } = renderShell();
    await settleLatestView();
    expect(latest(states)?.status).toBe('ready');

    await act(async () => showScene(OTHER_SCENE_3D));

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports pending before the host has sent a scene, so a capture never shows an empty view', async () => {
    arrangeViews();
    const { states } = renderShell('');

    await settleLatestView();

    expect(latest(states)).toEqual({ status: 'pending' });
  });
});

describe('<TextShell> scene load status', () => {
  const sceneLoadStatus = () => screen.queryByTestId(SCENE_LOAD_STATUS_TESTID);

  it('shows "Loading scene…" in the top bar until the view settles', async () => {
    arrangeViews();
    renderShell();
    const status = sceneLoadStatus();
    expect(status?.textContent).toBe('Loading scene…');
    expect(status?.closest('header')).not.toBeNull();

    await settleLatestView();

    expect(sceneLoadStatus()).toBeNull();
  });

  it('shows again after a scene change the view has not settled on', async () => {
    arrangeViews();
    const { showScene } = renderShell();
    await settleLatestView();

    await act(async () => showScene(OTHER_SCENE_3D));

    expect(sceneLoadStatus()).not.toBeNull();
  });

  it('shows "Loading scene…" again while the settled view loads a font, and leaves once it lands', async () => {
    arrangeViews();
    renderShell();
    await settleLatestView();

    act(() => drawFrame({ fonts: 1 }));
    expect(sceneLoadStatus()?.textContent).toBe('Loading scene…');
    act(() => drawFrame(NO_WORK));
    await settleLatestView();

    expect(sceneLoadStatus()).toBeNull();
  });

  it('gives way to the texture work status, so one status shows at a time (edge case)', async () => {
    arrangeViews();
    const endTextureWork = textureWork.begin();
    try {
      renderShell();
      expect(sceneLoadStatus()).toBeNull();
      expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).not.toBeNull();
    } finally {
      await act(async () => endTextureWork());
    }
  });

  it('is absent when the viewport crashed, which loads nothing (error case)', () => {
    arrangeViews(new Error('no WebGL'));
    // The boundary logs the caught error, which is the case under test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderShell();
    consoleError.mockRestore();

    expect(sceneLoadStatus()).toBeNull();
  });

  it('is absent before the host has sent a scene (edge case)', () => {
    arrangeViews();
    renderShell('');

    expect(sceneLoadStatus()).toBeNull();
  });
});
