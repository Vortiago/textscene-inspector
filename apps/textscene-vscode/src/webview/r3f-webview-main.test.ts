/**
 * Tests for `r3f-webview-main.tsx`, the webview half of `../protocol.ts`. `.ts`,
 * not `.tsx`: `vitest.config.ts` collects only `src/**\/*.{test,spec}.ts`, so the
 * mocks use `createElement`. A spied `addEventListener` records 'message' listeners
 * for direct calls, and `useEffect` runs on a macrotask, so tests `await flush()`.
 */
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol';
import type { TscnNode } from '@textscene/core';

interface CapturedShellProps {
  panelId?: string;
  content?: string;
  initialViewportMode?: '2D' | '3D' | undefined;
  onNodeReveal?: (path: string, node: TscnNode) => void;
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
} = {};

// A synthetic mock, no `importActual`: the real `<TscnPreviewShell>` pulls in
// three.js/r3f, which happy-dom cannot run without a WebGL context.
vi.mock('@textscene/core', () => ({
  createResourcePipeline: vi.fn((provider: unknown) => {
    captured.pipelineProvider = provider;
    captured.provideFile = vi.fn();
    return { loader: { provideFile: captured.provideFile } };
  }),
  ResourceLoaderProvider: ({ children }: { children: ReactNode }) => children,
  TscnPreviewShell: (props: CapturedShellProps) => {
    captured.shellProps = props;
    return createElement('div', { 'data-testid': 'fake-shell' }, props.content);
  },
  setLogAdapter: vi.fn((adapter: CapturedLogAdapter) => {
    captured.logAdapter = adapter;
  }),
}));

let messageListeners: Array<(event: MessageEvent) => void>;

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

/**
 * Polls `predicate` until it is true. The first mount in a file pays for
 * `react-dom/client`'s cold start, which can outlast one 10ms `flush()`. Every
 * later effect settles within one `flush()`, so only the first mount polls.
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

describe('incrementalUpdate handling', () => {
  it('treats an incrementalUpdate carrying rawText as a full content replacement', async () => {
    await mountFresh();
    dispatch({ type: 'loadTscn', content: 'original' });
    await waitFor(() => captured.shellProps?.content === 'original');

    dispatch({
      type: 'incrementalUpdate',
      data: { changes: [], sceneData: { rawText: 'incrementally updated' } },
    });
    await waitFor(() => captured.shellProps?.content === 'incrementally updated');

    expect(captured.shellProps?.content).toBe('incrementally updated');
  });

  it('is a no-op when the incrementalUpdate payload carries no rawText', async () => {
    await mountFresh();
    dispatch({ type: 'loadTscn', content: 'original' });
    await waitFor(() => captured.shellProps?.content === 'original');

    dispatch({ type: 'incrementalUpdate', data: { changes: [], sceneData: {} } });
    // A fixed beat, not a `waitFor`: a wait on "still 'original'" passes at once,
    // before an unwanted update has a chance to land.
    await flush();

    expect(captured.shellProps?.content).toBe('original');
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
    expect(logMessages).toEqual([
      { type: 'log', level, message: 'hello', args: [1, { two: 2 }] },
    ]);
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
