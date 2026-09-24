/**
 * The R3F webview app `webview.ts` mounts. It renders the host's `loadTscn` text
 * and posts `jumpToNode` when the user double-clicks a scene-tree node. Each panel
 * has its own webview and `<TscnPreviewShell>`, so panels share no state.
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
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol';
import { WebviewResourceProvider } from './WebviewResourceProvider';
import { readInitialConfig, resolveInitialViewportMode } from './initialConfig';

// Read once at module load: `webviewHtml.ts` embeds `window.__TEXTSCENE_CONFIG__`
// in a script tag before this module's entry, so the global is set by now.
// `undefined` ("auto", or no host config) keeps Godot-parity auto-select.
const INITIAL_VIEWPORT_MODE = resolveInitialViewportMode(readInitialConfig());

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

  // The host answers the provider's `loadResource` posts with the file bytes.
  // FileEventBus and ResourceLoader sit between it and `useResource`.
  const loader = useMemo(
    () => createResourcePipeline(new WebviewResourceProvider(vscode)).loader,
    [vscode]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message: unknown = event.data;
      if (!isHostToWebviewMessage(message)) return;
      if (message.type === 'loadTscn') {
        setContent(message.content);
      } else if (message.type === 'incrementalUpdate') {
        // A full reload, since React reconciliation does the diff. Without a
        // `sceneData.rawText` this is a no-op, and the next loadTscn wins.
        const raw = message.data.sceneData?.rawText;
        if (typeof raw === 'string' && raw.length > 0) {
          setContent(raw);
        }
      } else if (message.type === 'resourceChanged') {
        // A dependency (texture, .tres, sub-scene) changed on disk. Re-fetching it
        // moves its useResource subscribers to loaded with no remount.
        loader.provideFile(message.path);
      }
    }

    window.addEventListener('message', onMessage);

    // The host posts `loadTscn` from its constructor before this effect runs, and
    // replays the scene text on every ready, so a remount with empty `content` is
    // refilled too.
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
        initialViewportMode={INITIAL_VIEWPORT_MODE}
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
