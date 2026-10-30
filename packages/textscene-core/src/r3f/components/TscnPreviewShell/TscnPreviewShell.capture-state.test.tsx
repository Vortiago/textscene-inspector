/**
 * `onCaptureStateChange` reports `ready` only once the canvas has rendered the current scene
 * and its resources and textures have landed, `unavailable` with the reason when the viewport
 * cannot capture, and `pending` in between. A host waits on these states instead of polling.
 */
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useViewportActions } from '../../testing/ViewportActionsProbe';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext';
import { useResourceLoader } from '../../../resources/useResource';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { textureWork } from '../../../resources/textures/textureWork';
import { fontWork } from '../../controls/native/text/settledChannel';
import type { PreviewCaptureState } from './previewCaptureState';
import { SCENE_LOAD_STATUS_TESTID, TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';
import type { SceneGraph } from '../../../core/SceneGraph';

const DATA_URL = 'data:image/png;base64,AAA';
const DATA_URL_2D = 'data:image/png;base64,BBB';

interface CanvasStub {
  /** Whether the stub registers a screenshot handler, as a canvas with a renderer does. */
  registersHandler: boolean;
  /** The error the stub throws as it renders, as a canvas with no WebGL context does. */
  error: Error | null;
  /** Whether the stub holds one resource pending through the shell's loader, as `useResource` does. */
  holdsResource: boolean;
  /** Whether the stub keeps showing the first scene it rendered after the shell gets another. */
  lagsScene: boolean;
  /** Ends the held resource. Written by the stub as it mounts. */
  releaseResource: () => void;
}

/** Written by `arrangeCanvas` before each render. The stub canvas reads it as it mounts. */
const canvasStub: CanvasStub = {
  registersHandler: false,
  error: null,
  holdsResource: false,
  lagsScene: false,
  releaseResource: () => {},
};

function arrangeCanvas(overrides: Partial<Omit<CanvasStub, 'releaseResource'>>): void {
  Object.assign(
    canvasStub,
    { registersHandler: true, error: null, holdsResource: false, lagsScene: false },
    overrides
  );
}

/** Registers `dataUrl` as the screenshot of `shownScene` while `registers` holds, as a canvas's bridge does. */
function useStubScreenshotHandler(dataUrl: string, shownScene: SceneGraph | null, registers = true): void {
  const { registerScreenshotHandler } = useViewportActions();
  useEffect(
    () => (registers ? registerScreenshotHandler(() => dataUrl, shownScene) : undefined),
    [registerScreenshotHandler, dataUrl, shownScene, registers]
  );
}

// happy-dom has no WebGL, so the R3F canvas is a stub that registers or throws on demand.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: function StubCanvas() {
    const loader = useResourceLoader();
    const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
    const firstScene = useRef(sceneGraph);
    const shownScene = canvasStub.lagsScene ? firstScene.current : sceneGraph;
    useEffect(() => {
      if (!canvasStub.holdsResource || !loader) return undefined;
      canvasStub.releaseResource = loader.beginPending();
      return canvasStub.releaseResource;
    }, [loader]);
    useStubScreenshotHandler(DATA_URL, shownScene, canvasStub.registersHandler);
    if (canvasStub.error) throw canvasStub.error;
    return <div data-testid="canvas-stub" />;
  },
  TscnSceneContents: () => null,
}));
// The 2D stage registers its own handler, as its world canvas's `ScreenshotBridge` does.
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: function StubStage() {
    useStubScreenshotHandler(DATA_URL_2D, useOptionalHierarchy()?.sceneGraph ?? null);
    return <div data-testid="stage-2d-stub" />;
  },
}));

import { TscnPreviewShell } from './TscnPreviewShell';

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
  const loader = createFakeResourceLoader().loader;
  // A host wraps the shell in its resource loader, as the extension's webview does.
  const shellWith = (content: string) => (
    <ResourceLoaderProvider loader={loader}>
      <TscnPreviewShell
        panelId="capture"
        content={content}
        initialViewportMode="3D"
        onCaptureStateChange={(state) => states.push(state)}
      />
    </ResourceLoaderProvider>
  );
  const { rerender, unmount } = render(shellWith(content));
  return { states, showScene: (content) => rerender(shellWith(content)), unmount };
}

function latest(states: PreviewCaptureState[]): PreviewCaptureState | undefined {
  return states[states.length - 1];
}

describe('<TscnPreviewShell> capture state', () => {
  it('reports pending while the canvas has no screenshot handler', () => {
    arrangeCanvas({ registersHandler: false });

    const { states } = renderShell();

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports ready with a working capture once the canvas registers its handler', () => {
    arrangeCanvas({});

    const { states } = renderShell();
    const state = latest(states);

    expect(state?.status).toBe('ready');
    expect(state?.status === 'ready' && state.capture()).toBe(DATA_URL);
  });

  it('reports the renderer error when the canvas cannot create a WebGL context', () => {
    arrangeCanvas({
      registersHandler: false,
      error: new Error('THREE.WebGLRenderer: Error creating WebGL context.'),
    });
    // The boundary logs the caught error, which is the case under test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { states } = renderShell();
    consoleError.mockRestore();

    expect(latest(states)).toEqual({
      status: 'unavailable',
      reason: 'The viewport crashed: THREE.WebGLRenderer: Error creating WebGL context.',
    });
  });

  it('captures the 2D view once the 2D canvas registers its handler', async () => {
    arrangeCanvas({});
    const { states } = renderShell();

    await userEvent.click(screen.getByRole('button', { name: '2D' }));
    const state = latest(states);

    expect(state?.status).toBe('ready');
    expect(state?.status === 'ready' && state.capture()).toBe(DATA_URL_2D);
  });

  it('reports pending as the shell unmounts', () => {
    arrangeCanvas({});
    const { states, unmount } = renderShell();

    act(() => unmount());

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports pending while a resource the scene uses is loading, and ready once it lands', () => {
    arrangeCanvas({ holdsResource: true });
    const { states } = renderShell();
    expect(latest(states)).toEqual({ status: 'pending' });

    act(() => canvasStub.releaseResource());

    expect(latest(states)?.status).toBe('ready');
  });

  it('reports pending while a texture is building, and ready once it is done', () => {
    arrangeCanvas({});
    const endTextureWork = textureWork.begin();
    try {
      const { states } = renderShell();
      expect(latest(states)).toEqual({ status: 'pending' });

      act(() => endTextureWork());

      expect(latest(states)?.status).toBe('ready');
    } finally {
      endTextureWork();
    }
  });

  it('reports pending while a scene font is loading, and ready once it settles', () => {
    arrangeCanvas({});
    const endFontWork = fontWork.begin();
    try {
      const { states } = renderShell();
      expect(latest(states)).toEqual({ status: 'pending' });

      act(() => endFontWork());

      expect(latest(states)?.status).toBe('ready');
    } finally {
      endFontWork();
    }
  });

  it('reports pending while the canvas still shows the previous scene', () => {
    arrangeCanvas({ lagsScene: true });
    const { states, showScene } = renderShell();
    expect(latest(states)?.status).toBe('ready');

    showScene(OTHER_SCENE_3D);

    expect(latest(states)).toEqual({ status: 'pending' });
  });

  it('reports pending before the host has sent a scene, so a capture never shows an empty view', () => {
    arrangeCanvas({});

    const { states } = renderShell('');

    expect(latest(states)).toEqual({ status: 'pending' });
  });
});

describe('<TscnPreviewShell> scene load status', () => {
  const sceneLoadStatus = () => screen.queryByTestId(SCENE_LOAD_STATUS_TESTID);

  it('shows "Loading scene…" in the top bar while a resource is on its way, and leaves once it lands', () => {
    arrangeCanvas({ holdsResource: true });
    renderShell();
    const status = sceneLoadStatus();
    expect(status?.textContent).toBe('Loading scene…');
    expect(status?.closest('header')).not.toBeNull();

    act(() => canvasStub.releaseResource());

    expect(sceneLoadStatus()).toBeNull();
  });

  it('shows while the canvas still shows the previous scene', () => {
    arrangeCanvas({ lagsScene: true });
    const { showScene } = renderShell();
    expect(sceneLoadStatus()).toBeNull();

    showScene(OTHER_SCENE_3D);

    expect(sceneLoadStatus()).not.toBeNull();
  });

  it('shows "Loading scene…" while a scene font is loading, and leaves once it settles', () => {
    arrangeCanvas({});
    const endFontWork = fontWork.begin();
    try {
      renderShell();
      expect(sceneLoadStatus()?.textContent).toBe('Loading scene…');

      act(() => endFontWork());

      expect(sceneLoadStatus()).toBeNull();
    } finally {
      endFontWork();
    }
  });

  it('gives way to the texture work status, so one status shows at a time (edge case)', () => {
    arrangeCanvas({});
    const endTextureWork = textureWork.begin();
    try {
      renderShell();
      expect(sceneLoadStatus()).toBeNull();
      expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).not.toBeNull();
    } finally {
      act(() => endTextureWork());
    }
  });

  it('is absent when the viewport crashed, which loads nothing (error case)', () => {
    arrangeCanvas({ registersHandler: false, error: new Error('no WebGL') });
    // The boundary logs the caught error, which is the case under test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderShell();
    consoleError.mockRestore();

    expect(sceneLoadStatus()).toBeNull();
  });

  it('is absent before the host has sent a scene (edge case)', () => {
    arrangeCanvas({});
    renderShell('');

    expect(sceneLoadStatus()).toBeNull();
  });
});
