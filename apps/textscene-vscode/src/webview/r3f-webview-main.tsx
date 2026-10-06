/**
 * The R3F webview app `webview.ts` mounts. It renders the host's `loadTscn` text
 * and posts `jumpToNode` when the user double-clicks a scene-tree node. Each panel
 * has its own webview and `<TscnPreviewShell>`, so panels share no state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createResourcePipeline,
  ResourceLoaderProvider,
  TscnPreviewShell,
  setLogAdapter,
  type LogAdapter,
  type PreviewCaptureState,
} from '@textscene/core';
import type { TscnNode } from '@textscene/core';
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol';
import { WebviewResourceProvider } from './WebviewResourceProvider';
import { textureWorkerFactory } from './createTextureWorker';
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

const PENDING_CAPTURE: PreviewCaptureState = { status: 'pending' };

function R3FWebviewApp({ vscode }: { vscode: VsCodeApi }) {
  const [content, setContent] = useState<string>('');
  /** The scene text last handed to the shell. Written only by the `loadTscn` handler. */
  const contentRef = useRef('');

  // Child effects run before this component's, so the shell reports its first state
  // before the listener exists. The ref holds the latest, and the host hears it only
  // after `webviewReady`, which resets the host's copy.
  const captureStateRef = useRef<PreviewCaptureState>(PENDING_CAPTURE);
  const isListeningRef = useRef(false);
  /** Capture requests that arrived while pending. Answered and cleared by the next settled state. */
  const heldRequestsRef = useRef<string[]>([]);
  const handleCaptureStateChange = useCallback(
    (state: PreviewCaptureState) => {
      captureStateRef.current = state;
      if (isListeningRef.current) vscode.postMessage(captureStateMessage(state));
      if (state.status === 'pending') return;
      for (const requestId of heldRequestsRef.current.splice(0)) {
        vscode.postMessage(captureAnswer(requestId, state));
      }
    },
    [vscode]
  );

  // The host answers the provider's `loadResource` posts with the file bytes.
  // FileEventBus and ResourceLoader sit between it and `useResource`. Procedural
  // textures build in the blob-URL job worker (ADR-0042).
  const loader = useMemo(
    () =>
      createResourcePipeline(new WebviewResourceProvider(vscode), {
        createWorker: textureWorkerFactory(),
      }).loader,
    [vscode]
  );

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message: unknown = event.data;
      if (!isHostToWebviewMessage(message)) return;
      if (message.type === 'loadTscn') {
        // React renders the new text on a later task, so until the shell reports on it, a
        // capture would show the scene before. The same text again changes nothing.
        if (message.content !== contentRef.current) {
          contentRef.current = message.content;
          handleCaptureStateChange(PENDING_CAPTURE);
        }
        setContent(message.content);
      } else if (message.type === 'resourceChanged') {
        // A dependency (texture, .tres, sub-scene, sidecar, project.godot) changed on
        // disk. Its consumers load it again, with no remount.
        loader.provideFile(message.path);
      } else if (message.type === 'capturePreview') {
        if (captureStateRef.current.status === 'pending') heldRequestsRef.current.push(message.requestId);
        else vscode.postMessage(captureAnswer(message.requestId, captureStateRef.current));
      }
    }

    window.addEventListener('message', onMessage);

    // The host posts `loadTscn` from its constructor before this effect runs, and
    // replays the scene text on every ready, so a remount with empty `content` is
    // refilled too.
    vscode.postMessage({ type: 'webviewReady' } satisfies WebviewToHostMessage);
    isListeningRef.current = true;
    vscode.postMessage(captureStateMessage(captureStateRef.current));

    return () => {
      isListeningRef.current = false;
      window.removeEventListener('message', onMessage);
    };
  }, [vscode, loader, handleCaptureStateChange]);

  const panelId = useMemo(() => `vscode-${Math.random().toString(36).slice(2, 10)}`, []);

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
        onCaptureStateChange={handleCaptureStateChange}
      />
    </ResourceLoaderProvider>
  );
}

function captureStateMessage(state: PreviewCaptureState): WebviewToHostMessage {
  if (state.status === 'ready') return { type: 'previewCaptureReady' };
  if (state.status === 'unavailable') return { type: 'previewCaptureUnavailable', reason: state.reason };
  return { type: 'previewCapturePending' };
}

/**
 * The host posts a request only in the `ready` state, so a request in another state
 * crossed a change on the wire. The webview then names the state it is in.
 */
function captureAnswer(requestId: string, state: PreviewCaptureState): WebviewToHostMessage {
  const dataUrl = state.status === 'ready' ? state.capture() : null;
  if (dataUrl !== null) return { type: 'previewCaptured', requestId, dataUrl };
  const error =
    state.status === 'unavailable' ? state.reason : 'The preview canvas closed before the capture.';
  return { type: 'previewCaptureError', requestId, error };
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
