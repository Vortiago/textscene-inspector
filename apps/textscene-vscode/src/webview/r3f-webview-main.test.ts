/**
 * Tests for `r3f-webview-main.tsx`, the webview half of `../protocol.ts`. `.ts`,
 * not `.tsx`: `vitest.config.ts` collects only `src/**\/*.{test,spec}.ts`, so the
 * mocks use `createElement`. A spied `addEventListener` records 'message' listeners
 * for direct calls, and `useEffect` runs on a macrotask, so tests poll with `waitFor`.
 */
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect, type ReactNode } from 'react';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol';
import type { PreviewCaptureState, TscnNode } from '@textscene/core';

interface CapturedShellProps {
  panelId?: string;
  content?: string;
  initialViewportMode?: '2D' | '3D' | undefined;
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onCaptureStateChange?: (state: PreviewCaptureState) => void;
}

interface CapturedLogAdapter {
  trace: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/** Mutable capture box the `@textscene/core` mock writes into on every render/call. */
const captured: {
  shellProps?: CapturedShellProps;
  logAdapter?: CapturedLogAdapter;
  provideFile?: ReturnType<typeof vi.fn>;
  pipelineProvider?: unknown;
  pipelineOptions?: { createWorker?: unknown };
  /** The state the fake shell reports from its mount effect, as the real bridge does. */
  mountCaptureState?: PreviewCaptureState;
} = {};

// A synthetic mock, no `importActual`: the real `<TscnPreviewShell>` pulls in
// three.js/r3f, which happy-dom cannot run without a WebGL context.
vi.mock('@textscene/core', () => ({
  createResourcePipeline: vi.fn((provider: unknown, options?: { createWorker?: unknown }) => {
    captured.pipelineProvider = provider;
    captured.pipelineOptions = options;
    captured.provideFile = vi.fn();
    return { loader: { provideFile: captured.provideFile } };
  }),
  ResourceLoaderProvider: ({ children }: { children: ReactNode }) => children,
  TscnPreviewShell: function FakeShell(props: CapturedShellProps) {
    captured.shellProps = props;
    const { onCaptureStateChange } = props;
    useEffect(() => {
      if (captured.mountCaptureState) onCaptureStateChange?.(captured.mountCaptureState);
    }, [onCaptureStateChange]);
    return createElement('div', { 'data-testid': 'fake-shell' }, props.content);
  },
  setLogAdapter: vi.fn((adapter: CapturedLogAdapter) => {
    captured.logAdapter = adapter;
  }),
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

/** Mount a fresh copy of the module (config globals are read at module-load time). */
async function mountFresh(config?: Record<string, unknown>): Promise<{ vscodeApi: MockVsCodeApi }> {
  vi.resetModules();
  captured.shellProps = undefined;
  captured.logAdapter = undefined;
  messageListeners = [];

  if (config) {
    (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__ = config;
  } else {
    delete (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__;
  }

  document.body.innerHTML = '<div id="r3f-root"></div>';

  const vscodeApi: MockVsCodeApi = {
    postMessage: vi.fn(),
    getState: vi.fn(),
    setState: vi.fn(),
  };
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
  vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
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

  it('posts the webviewReady handshake once the message listener is installed', async () => {
    const { vscodeApi } = await mountFresh();

    const readyMessages = postedMessages(vscodeApi).filter((m) => m.type === 'webviewReady');
    expect(readyMessages).toHaveLength(1);
  });

  it('renders <TscnPreviewShell> with an empty initial content and a stable vscode- panelId', async () => {
    await mountFresh();

    expect(captured.shellProps?.content).toBe('');
    expect(captured.shellProps?.panelId).toMatch(/^vscode-/);
  });

  it('gives the resource pipeline a job worker factory, so textures build off the main thread', async () => {
    await mountFresh();

    expect(typeof captured.pipelineOptions?.createWorker).toBe('function');
  });
});

describe('loadTscn handling', () => {
  it('applies the full scene text to the shell content prop', async () => {
    await mountFresh();
    const expected = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

    dispatch({ type: 'loadTscn', content: expected });
    await waitFor(() => captured.shellProps?.content === expected);

    expect(captured.shellProps?.content).toBe(expected);
  });

  it('replaces previously-loaded content on a subsequent loadTscn (hot-reload)', async () => {
    await mountFresh();

    dispatch({ type: 'loadTscn', content: 'first content' });
    await waitFor(() => captured.shellProps?.content === 'first content');
    dispatch({ type: 'loadTscn', content: 'second content' });
    await waitFor(() => captured.shellProps?.content === 'second content');

    expect(captured.shellProps?.content).toBe('second content');
  });
});

describe('resourceChanged handling', () => {
  it('forwards the changed res:// path to the resource loader for re-fetch', async () => {
    await mountFresh();

    dispatch({ type: 'resourceChanged', path: 'res://textures/wood.png' });

    expect(captured.provideFile).toHaveBeenCalledWith('res://textures/wood.png');
  });
});

describe('jumpToNode forwarding', () => {
  it('posts a jumpToNode message with the node name, path, and parent on reveal', async () => {
    const { vscodeApi } = await mountFresh();

    const fakeNode = { name: 'Leaf', parent: 'A' } as unknown as TscnNode;
    captured.shellProps?.onNodeReveal?.('Root/A/Leaf', fakeNode);

    const jumpMessages = postedMessages(vscodeApi).filter((m) => m.type === 'jumpToNode');
    expect(jumpMessages).toEqual([
      { type: 'jumpToNode', nodeName: 'Leaf', path: 'Root/A/Leaf', parent: 'A' },
    ]);
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

describe('capture state reporting', () => {
  const READY: PreviewCaptureState = { status: 'ready', capture: () => 'data:image/png;base64,AA==' };
  const isCaptureState = (m: WebviewToHostMessage) =>
    m.type === 'previewCaptureReady' ||
    m.type === 'previewCapturePending' ||
    m.type === 'previewCaptureUnavailable';

  it('posts the state the shell reported on mount only after webviewReady', async () => {
    captured.mountCaptureState = READY;

    const { vscodeApi } = await mountFresh();
    const types = postedMessages(vscodeApi).map((m) => m.type);

    expect(types.indexOf('webviewReady')).toBeLessThan(types.indexOf('previewCaptureReady'));
    expect(postedMessages(vscodeApi).filter(isCaptureState)).toEqual([{ type: 'previewCaptureReady' }]);
  });

  it('posts pending after webviewReady while the shell has reported no other state', async () => {
    const { vscodeApi } = await mountFresh();

    expect(postedMessages(vscodeApi).filter(isCaptureState)).toEqual([{ type: 'previewCapturePending' }]);
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

    expect(postedMessages(vscodeApi).filter((m) => m.type === 'previewCaptured')).toEqual([
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
});
