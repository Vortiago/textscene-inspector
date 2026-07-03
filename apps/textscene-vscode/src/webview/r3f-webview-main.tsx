/**
 * R3F webview entry point. Mounted by `webview.ts` when the
 * `textscene.useR3F` workspace setting is true.
 *
 * Listens for `loadTscn` messages from the extension host (sent on
 * panel-open and on file-save hot-reload). When the user double-clicks
 * a node in the scene-tree, we forward a `jumpToNode` postMessage back
 * to the host so the editor can jump to the source line.
 *
 * Single-panel scope: this React tree owns its own `<TscnPreviewShell>`
 * which provides Selection / Hierarchy / CameraControl contexts. Two
 * panels open simultaneously will each instantiate their own webview,
 * each running this file independently — no shared state.
 */
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createResourcePipeline,
  ResourceLoaderProvider,
  TscnPreviewShell,
  setLogAdapter,
  type LogAdapter,
} from '@textscene/core';
import type { TscnNode } from '@textscene/core';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol';
import { WebviewResourceProvider } from './WebviewResourceProvider';

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

class WebviewLogAdapter implements LogAdapter {
  constructor(private readonly vscode: VsCodeApi) {}
  trace(message: string, ...args: unknown[]): void {
    this.vscode.postMessage({ type: 'log', level: 'trace', message, args } satisfies WebviewToHostMessage);
  }
  debug(message: string, ...args: unknown[]): void {
    this.vscode.postMessage({ type: 'log', level: 'debug', message, args } satisfies WebviewToHostMessage);
  }
  info(message: string, ...args: unknown[]): void {
    this.vscode.postMessage({ type: 'log', level: 'info', message, args } satisfies WebviewToHostMessage);
  }
  warn(message: string, ...args: unknown[]): void {
    this.vscode.postMessage({ type: 'log', level: 'warn', message, args } satisfies WebviewToHostMessage);
  }
  error(message: string, ...args: unknown[]): void {
    this.vscode.postMessage({ type: 'log', level: 'error', message, args } satisfies WebviewToHostMessage);
  }
}

function R3FWebviewApp({ vscode }: { vscode: VsCodeApi }) {
  const [content, setContent] = useState<string>('');

  // Wire the WI-79 resource pipeline. The extension host services the
  // provider's `loadResource` calls by responding to `loadResource`
  // postMessages with the file bytes; the FileEventBus + ResourceLoader
  // sit between that provider and `useResource` in node components.
  const loader = useMemo(
    () => createResourcePipeline(new WebviewResourceProvider(vscode)).loader,
    [vscode]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message = event.data as HostToWebviewMessage | undefined;
      if (!message) return;
      if (message.type === 'loadTscn') {
        setContent(message.content);
      } else if (message.type === 'incrementalUpdate') {
        // For now, treat incremental updates as a full reload because
        // React reconciliation makes incremental computation redundant.
        // The host still ships a `sceneData.rawText` payload when
        // available; if not, this is a no-op and the next loadTscn
        // wins.
        const raw = message.data.sceneData?.rawText;
        if (typeof raw === 'string' && raw.length > 0) {
          setContent(raw);
        }
      } else if (message.type === 'resourceChanged') {
        // A dependency (texture, .tres, sub-scene) changed on disk. Drop its
        // cache and re-fetch — nodes subscribed via useResource transition
        // missing/loaded → loaded and re-render with no remount.
        loader.provideFile(message.path);
      }
    }

    window.addEventListener('message', onMessage);

    // Signal handshake-ready to the extension host. The host caches
    // any `loadTscn` payload that arrived before this point (the
    // initial open is a race: the host calls postMessage from its
    // constructor, but React hooks fire async). The host re-posts
    // the cached payload on receipt of this message.
    vscode.postMessage({ type: 'webviewReady' } satisfies WebviewToHostMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [vscode, loader]);

  const panelId = useMemo(
    () => `vscode-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const handleNodeReveal = (path: string, node: TscnNode) => {
    vscode.postMessage({
      type: 'jumpToNode',
      nodeName: node.name,
      path,
      parent: node.parent,
    } satisfies WebviewToHostMessage);
  };

  return (
    <ResourceLoaderProvider loader={loader}>
      <TscnPreviewShell
        panelId={panelId}
        content={content}
        onNodeReveal={handleNodeReveal}
      />
    </ResourceLoaderProvider>
  );
}

export function mountR3FWebview(): void {
  const root = document.getElementById('r3f-root');
  if (!root) {
    throw new Error('R3F webview HTML is missing #r3f-root container');
  }
  const vscode: VsCodeApi = acquireVsCodeApi();
  setLogAdapter(new WebviewLogAdapter(vscode));

  // Make the host fill the viewport so the canvas + sidebar layout
  // works inside the webview's full-bleed body.
  root.style.width = '100vw';
  root.style.height = '100vh';
  root.style.display = 'block';

  createRoot(root).render(<R3FWebviewApp vscode={vscode} />);
}
