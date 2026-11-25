/**
 * Tests for `r3f-webview-main.tsx`, the webview half of `../protocol.ts`. `.ts`,
 * not `.tsx`: `vitest.config.ts` collects only `src/**\/*.{test,spec}.ts`, so the
 * mocks use `createElement`. A spied `addEventListener` records 'message' listeners
 * for direct calls, and `useEffect` runs on a macrotask, so tests poll with `waitFor`.
 */
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect } from 'react';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol';
import type { PreviewCaptureState } from '@textscene/core';
import type { ResourceProvider } from '@textscene/renderer';

/** What the app does with a scene: it sets the text, and disposes it when the panel goes. */
interface FakeScene {
  text: string;
  readonly provider: ResourceProvider;
  readonly rootScenePath: string;
  isDisposed: boolean;
  setSource(text: string): void;
  dispose(): void;
}

interface CapturedShellProps {
  panelId?: string;
  scene?: FakeScene;
  initialViewportMode?: '2D' | '3D' | undefined;
  onNodeReveal?: (path: string, name: string) => void;
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
  isVisible?: boolean;
}

interface CapturedLogAdapter {
  trace: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/** Written by the `@textscene/core` and `@textscene/renderer` mocks on every render and call. */
const captured: {
  shellProps?: CapturedShellProps;
  scenes: FakeScene[];
  logAdapter?: CapturedLogAdapter;
  /** The state the fake shell reports from its mount effect, as the real bridge does. */
  mountCaptureState?: PreviewCaptureState;
  shellMountEffects: number;
  shellMountCleanups: number;
} = { scenes: [], shellMountEffects: 0, shellMountCleanups: 0 };

/** The text of the scene the app opened last, as the shell would draw it. */
const sceneText = () => captured.scenes.at(-1)?.text;

// A synthetic mock, no `importActual`: the real `<TscnPreviewShell>` pulls in
// three.js/r3f, which happy-dom cannot run without a WebGL context.
vi.mock('@textscene/core', () => ({
  PENDING_CAPTURE: { status: 'pending' },
  TscnPreviewShell: function FakeShell(props: CapturedShellProps) {
    captured.shellProps = props;
    const { onCaptureStateChange } = props;
    useEffect(() => {
      captured.shellMountEffects += 1;
      return () => {
        captured.shellMountCleanups += 1;
      };
    }, []);
    useEffect(() => {
      if (captured.mountCaptureState) onCaptureStateChange?.(captured.mountCaptureState);
    }, [onCaptureStateChange]);
    return createElement('div', { 'data-testid': 'fake-shell' });
  },
  setLogAdapter: vi.fn((adapter: CapturedLogAdapter) => {
    captured.logAdapter = adapter;
  }),
}));

vi.mock('@textscene/renderer', () => ({
  openScene: ({
    source,
    provider,
    rootScenePath = 'res://__inline__.tscn',
  }: {
    source: string;
    provider: ResourceProvider;
    rootScenePath?: string;
  }): FakeScene => {
    const scene: FakeScene = {
      text: source,
      provider,
      rootScenePath,
      isDisposed: false,
      setSource(text) {
        scene.text = text;
      },
      dispose() {
        scene.isDisposed = true;
      },
    };
    captured.scenes.push(scene);
    return scene;
  },
}));

let messageListeners: Array<(event: MessageEvent) => void>;

/**
 * Polls `predicate` until it is true. The first mount in a file pays for
 * `react-dom/client`'s cold start, so its effects can take far longer than later ones.
 */
async function waitFor(predicate: () => boolean, timeoutMs = process.env.CI ? 5000 : 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: condition never became true');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function dispatch(message: HostToWebviewMessage): void {
  messageListeners.forEach((listener) => listener({ data: message } as MessageEvent));
}

interface MockVsCodeApi {
  postMessage: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
  setState: ReturnType<typeof vi.fn>;
}

function postedMessages(vscodeApi: MockVsCodeApi): WebviewToHostMessage[] {
  return vscodeApi.postMessage.mock.calls.map((call) => call[0] as WebviewToHostMessage);
}

/** What the host keeps: each `webviewReady` resets its copy, as a remount sends one. */
function postedSinceLastReady(vscodeApi: MockVsCodeApi): WebviewToHostMessage[] {
  const messages = postedMessages(vscodeApi);
  const lastReady = messages.map((m) => m.type).lastIndexOf('webviewReady');
  if (lastReady === -1) {
    throw new Error(`expected a webviewReady among ${messages.length} posted messages, got none`);
  }
  return messages.slice(lastReady);
}

/** Mount a fresh copy of the module (config globals are read at module-load time). */
async function mountFresh(
  config?: Record<string, unknown>,
  postMessage = vi.fn()
): Promise<{ vscodeApi: MockVsCodeApi }> {
  vi.resetModules();
  captured.shellProps = undefined;
  captured.scenes = [];
  captured.logAdapter = undefined;
  captured.shellMountEffects = 0;
  captured.shellMountCleanups = 0;
  messageListeners = [];

  if (config) {
    (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__ = config;
  } else {
    delete (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__;
  }

  document.body.innerHTML = '<div id="r3f-root"></div>';

  const vscodeApi: MockVsCodeApi = { postMessage, getState: vi.fn(), setState: vi.fn() };
  (globalThis as { acquireVsCodeApi?: () => MockVsCodeApi }).acquireVsCodeApi = () => vscodeApi;

  const mod = await import('./r3f-webview-main');
  mod.mountR3FWebview();

  // A mount's first observable effect is the webviewReady handshake, so waiting
  // for it settles the mount past the first commit's passive effects.
  await waitFor(() =>
    vscodeApi.postMessage.mock.calls.some(
      (call) => (call[0] as { type?: string } | undefined)?.type === 'webviewReady'
    )
  );

  return { vscodeApi };
}

beforeEach(() => {
  messageListeners = [];
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
    if (type === 'message' && typeof listener === 'function') {
      messageListeners.push(listener as (event: MessageEvent) => void);
    }
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
    if (type === 'message') messageListeners = messageListeners.filter((l) => l !== listener);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { acquireVsCodeApi?: unknown }).acquireVsCodeApi;
  delete (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__;
  document.body.innerHTML = '';
  captured.mountCaptureState = undefined;
});

describe('mountR3FWebview', () => {
  it('throws when the #r3f-root container is missing from the HTML', async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    (globalThis as { acquireVsCodeApi?: () => MockVsCodeApi }).acquireVsCodeApi = () => ({
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    });

    const mod = await import('./r3f-webview-main');
    expect(() => mod.mountR3FWebview()).toThrow(/r3f-root/);
  });

  it('mounts under StrictMode, which runs a mount effect, its cleanup and the effect again', async () => {
    await mountFresh();

    expect(captured.shellMountEffects).toBe(2);
    expect(captured.shellMountCleanups).toBe(1);
  });

  it('posts each webviewReady handshake with its message listener installed once', async () => {
    const listenersAtReady: number[] = [];
    const postMessage = vi.fn((message: WebviewToHostMessage) => {
      if (message.type === 'webviewReady') listenersAtReady.push(messageListeners.length);
    });
    const { vscodeApi } = await mountFresh(undefined, postMessage);

    // One handshake per StrictMode mount. The provider listens too, so each sees the count after mount.
    expect(postedMessages(vscodeApi).filter((m) => m.type === 'webviewReady')).toHaveLength(2);
    expect(listenersAtReady).toEqual([messageListeners.length, messageListeners.length]);
  });

  it('hands <TscnPreviewShell> the scene it opened, empty, and a stable vscode- panelId', async () => {
    await mountFresh();

    expect(captured.shellProps?.scene).toBe(captured.scenes[0]);
    expect(sceneText()).toBe('');
    expect(captured.shellProps?.panelId).toMatch(/^vscode-/);
  });
});

describe('loadTscn handling', () => {
  it('sets the full scene text on the scene it opened', async () => {
    await mountFresh();
    const expected = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

    dispatch({ type: 'loadTscn', content: expected, scenePath: null });
    await waitFor(() => sceneText() === expected);

    expect(captured.scenes).toHaveLength(1);
  });

  it('replaces previously-loaded content on a subsequent loadTscn (hot-reload)', async () => {
    await mountFresh();

    dispatch({ type: 'loadTscn', content: 'first content', scenePath: null });
    await waitFor(() => sceneText() === 'first content');
    dispatch({ type: 'loadTscn', content: 'second content', scenePath: null });
    await waitFor(() => sceneText() === 'second content');

    expect(captured.scenes).toHaveLength(1);
  });
});

describe('scene path handling', () => {
  it('opens a scene under the path the host names, and disposes the one before', async () => {
    await mountFresh();

    dispatch({ type: 'loadTscn', content: 'level text', scenePath: 'res://levels/main.tscn' });
    await waitFor(() => sceneText() === 'level text');

    expect(captured.scenes.map((scene) => scene.rootScenePath)).toEqual([
      'res://__inline__.tscn',
      'res://levels/main.tscn',
    ]);
    expect(captured.scenes[0]!.isDisposed).toBe(true);
    expect(captured.shellProps?.scene).toBe(captured.scenes[1]);
  });

  it('keeps the scene for a new text under the same path', async () => {
    await mountFresh();

    dispatch({ type: 'loadTscn', content: 'first', scenePath: 'res://main.tscn' });
    dispatch({ type: 'loadTscn', content: 'second', scenePath: 'res://main.tscn' });
    await waitFor(() => sceneText() === 'second');

    expect(captured.scenes).toHaveLength(2);
  });

  it('shares one provider between the scenes it opens, so a load in flight still answers', async () => {
    await mountFresh();

    dispatch({ type: 'loadTscn', content: 'text', scenePath: 'res://main.tscn' });
    await waitFor(() => sceneText() === 'text');

    expect(captured.scenes[1]!.provider).toBe(captured.scenes[0]!.provider);
  });
});

describe('resourceChanged handling', () => {
  it("hands the shell a provider whose watchers hear the host's changed res:// path", async () => {
    await mountFresh();
    const listener = vi.fn();
    captured.shellProps?.scene?.provider.watch?.(listener);

    dispatch({ type: 'resourceChanged', path: 'res://textures/wood.png' });

    expect(listener).toHaveBeenCalledWith('res://textures/wood.png');
  });
});

describe('jumpToNode forwarding', () => {
  it('posts a jumpToNode message with the node name and tree path on reveal', async () => {
    const { vscodeApi } = await mountFresh();

    captured.shellProps?.onNodeReveal?.('Root/A/Leaf', 'Leaf');

    const jumpMessages = postedMessages(vscodeApi).filter((m) => m.type === 'jumpToNode');
    expect(jumpMessages).toEqual([{ type: 'jumpToNode', nodeName: 'Leaf', path: 'Root/A/Leaf' }]);
  });
});

describe('log adapter', () => {
  const levels = ['trace', 'debug', 'info', 'warn', 'error'] as const;

  it.each(levels)('forwards a %s log line as a "log" message with matching level', async (level) => {
    const { vscodeApi } = await mountFresh();

    captured.logAdapter?.[level]('hello', 1, { two: 2 });

    const logMessages = postedMessages(vscodeApi).filter((m) => m.type === 'log');
    expect(logMessages).toEqual([{ type: 'log', level, message: 'hello', args: [1, { two: 2 }] }]);
  });
});

describe('initial viewport mode threading (__TEXTSCENE_CONFIG__)', () => {
  it('leaves initialViewportMode undefined when no host config is embedded', async () => {
    await mountFresh();

    expect(captured.shellProps?.initialViewportMode).toBeUndefined();
  });

  it('threads an explicit forced viewport mode from window.__TEXTSCENE_CONFIG__ to the shell', async () => {
    await mountFresh({ viewportMode: '2D' });

    expect(captured.shellProps?.initialViewportMode).toBe('2D');
  });
});

describe('preview visibility', () => {
  it('shows the preview until the host says otherwise', async () => {
    await mountFresh();

    expect(captured.shellProps?.isVisible).toBeUndefined();
  });

  it('hands the shell the visibility the host posts, hidden and shown again', async () => {
    await mountFresh();

    dispatch({ type: 'previewVisibility', isVisible: false });
    await waitFor(() => captured.shellProps?.isVisible === false);
    dispatch({ type: 'previewVisibility', isVisible: true });
    await waitFor(() => captured.shellProps?.isVisible === true);

    expect(captured.shellProps?.isVisible).toBe(true);
  });
});

describe('capture state reporting', () => {
  const IMAGE = new Blob([new Uint8Array([0])], { type: 'image/png' });
  const READY: PreviewCaptureState = { status: 'ready', capture: () => Promise.resolve(IMAGE) };
  const captures = (vscodeApi: Parameters<typeof postedMessages>[0]) =>
    postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptured');
  /** The answer posts once the image has read as a data URL, a task later. */
  const answeredCaptures = async (vscodeApi: Parameters<typeof postedMessages>[0]) => {
    await waitFor(() => captures(vscodeApi).length > 0);
    return captures(vscodeApi);
  };
  const isCaptureState = (m: WebviewToHostMessage) =>
    m.type === 'previewCaptureReady' ||
    m.type === 'previewCapturePending' ||
    m.type === 'previewCaptureUnavailable';

  it('posts the state the shell reported on mount only after webviewReady', async () => {
    captured.mountCaptureState = READY;

    const { vscodeApi } = await mountFresh();
    const types = postedMessages(vscodeApi).map((m) => m.type);

    expect(types.indexOf('webviewReady')).toBeLessThan(types.indexOf('previewCaptureReady'));
    expect(postedSinceLastReady(vscodeApi).filter(isCaptureState)).toEqual([{ type: 'previewCaptureReady' }]);
  });

  it('posts pending after webviewReady while the shell has reported no other state', async () => {
    const { vscodeApi } = await mountFresh();

    expect(postedSinceLastReady(vscodeApi).filter(isCaptureState)).toEqual([
      { type: 'previewCapturePending' },
    ]);
  });

  it('posts each later state with its reason', async () => {
    const { vscodeApi } = await mountFresh();

    captured.shellProps?.onCaptureStateChange?.({ status: 'unavailable', reason: 'no WebGL' });

    expect(postedMessages(vscodeApi).filter(isCaptureState).pop()).toEqual({
      type: 'previewCaptureUnavailable',
      reason: 'no WebGL',
    });
  });

  it('answers a capturePreview with the image of the ready capture', async () => {
    captured.mountCaptureState = READY;
    const { vscodeApi } = await mountFresh();

    dispatch({ type: 'capturePreview', requestId: 'c1' });

    expect(await answeredCaptures(vscodeApi)).toEqual([
      { type: 'previewCaptured', requestId: 'c1', dataUrl: 'data:image/png;base64,AA==' },
    ]);
  });

  it('answers a capturePreview that crossed a change to unavailable with the reason', async () => {
    const { vscodeApi } = await mountFresh();
    captured.shellProps?.onCaptureStateChange?.({ status: 'unavailable', reason: 'no WebGL' });

    dispatch({ type: 'capturePreview', requestId: 'c2' });

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptureError')).toEqual([
      { type: 'previewCaptureError', requestId: 'c2', error: 'no WebGL' },
    ]);
  });

  it('answers a capturePreview whose capture fails with the reason', async () => {
    captured.mountCaptureState = {
      status: 'ready',
      capture: () => Promise.reject(new Error('expected the view to stay mounted until its capture')),
    };
    const { vscodeApi } = await mountFresh();

    dispatch({ type: 'capturePreview', requestId: 'c6' });
    await waitFor(() => postedMessages(vscodeApi).some((m) => m.type === 'previewCaptureError'));

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptureError')).toEqual([
      {
        type: 'previewCaptureError',
        requestId: 'c6',
        error: 'The capture failed: expected the view to stay mounted until its capture',
      },
    ]);
  });

  it('holds a capturePreview that arrives while pending, and answers it once the shell is ready', async () => {
    const { vscodeApi } = await mountFresh();

    dispatch({ type: 'capturePreview', requestId: 'c3' });
    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptured')).toEqual([]);
    captured.shellProps?.onCaptureStateChange?.(READY);

    expect(await answeredCaptures(vscodeApi)).toEqual([
      { type: 'previewCaptured', requestId: 'c3', dataUrl: 'data:image/png;base64,AA==' },
    ]);
  });

  it('holds a capturePreview that follows new scene text until the shell is ready for it', async () => {
    captured.mountCaptureState = READY;
    const { vscodeApi } = await mountFresh();

    dispatch({ type: 'loadTscn', content: 'a new scene', scenePath: null });
    dispatch({ type: 'capturePreview', requestId: 'c4' });

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptured')).toEqual([]);
    expect(postedMessages(vscodeApi).filter(isCaptureState).pop()).toEqual({ type: 'previewCapturePending' });
  });

  it('holds a capturePreview that follows the same text under a new scene path', async () => {
    captured.mountCaptureState = READY;
    const { vscodeApi } = await mountFresh();
    dispatch({ type: 'loadTscn', content: 'the scene', scenePath: 'res://old.tscn' });
    captured.shellProps?.onCaptureStateChange?.(READY);

    dispatch({ type: 'loadTscn', content: 'the scene', scenePath: 'res://renamed.tscn' });
    dispatch({ type: 'capturePreview', requestId: 'c7' });

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptured')).toEqual([]);
    expect(postedMessages(vscodeApi).filter(isCaptureState).pop()).toEqual({ type: 'previewCapturePending' });
  });

  it('answers a capturePing at once while the shell is still pending', async () => {
    const { vscodeApi } = await mountFresh();

    dispatch({ type: 'capturePing', pingId: 'p1' });

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'capturePong')).toEqual([
      { type: 'capturePong', pingId: 'p1' },
    ]);
  });

  it('stays ready when the host replays the scene text it already sent', async () => {
    captured.mountCaptureState = READY;
    const { vscodeApi } = await mountFresh();
    dispatch({ type: 'loadTscn', content: 'the scene', scenePath: null });
    captured.shellProps?.onCaptureStateChange?.(READY);

    dispatch({ type: 'loadTscn', content: 'the scene', scenePath: null });
    dispatch({ type: 'capturePreview', requestId: 'c5' });

    expect(await answeredCaptures(vscodeApi)).toEqual([
      { type: 'previewCaptured', requestId: 'c5', dataUrl: 'data:image/png;base64,AA==' },
    ]);
  });
});
