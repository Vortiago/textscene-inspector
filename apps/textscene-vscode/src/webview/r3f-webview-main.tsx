/**
 * The R3F webview app `webview.ts` mounts. It renders the host's `loadTscn` text
 * and posts `jumpToNode` when the user double-clicks a scene-tree node. Each panel
 * has its own webview and `<TscnPreviewShell>`, so panels share no state.
 */
import { StrictMode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PENDING_CAPTURE,
  TscnPreviewShell,
  setLogAdapter,
  type LogAdapter,
  type PreviewCaptureState,
} from '@textscene/core';
import { openScene, type Scene } from '@textscene/renderer';
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

interface WebviewAppProps {
  readonly vscode: VsCodeApi;
  /** The scene the webview opens with, under the default path, until the host names the document's path. */
  readonly firstScene: Scene;
}

function R3FWebviewApp({ vscode, firstScene }: WebviewAppProps) {
  const [scene, setScene] = useState(firstScene);
  /** Written only by the `loadTscn` handler, which disposes the scene it replaces. */
  const sceneRef = useRef(firstScene);
  const [content, setContent] = useState<string>('');
  /** Written by the host's `previewVisibility`. Undefined until it posts one, and the shell then shows the preview. */
  const [isVisible, setIsVisible] = useState<boolean>();
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
        answerCapture(vscode, requestId, state);
      }
    },
    [vscode]
  );

  useLayoutEffect(() => scene.setSource(content), [scene, content]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message: unknown = event.data;
      if (!isHostToWebviewMessage(message)) return;
      if (message.type === 'loadTscn') {
        const scenePath = message.scenePath ?? firstScene.rootScenePath;
        const isNewScene = scenePath !== sceneRef.current.rootScenePath;
        if (isNewScene) {
          sceneRef.current.dispose();
          sceneRef.current = openScene({
            source: '',
            provider: firstScene.provider,
            rootScenePath: scenePath,
          });
          setScene(sceneRef.current);
        }
        // A capture before the shell reports on a new scene or text would show the scene before.
        if (isNewScene || message.content !== contentRef.current) {
          contentRef.current = message.content;
          handleCaptureStateChange(PENDING_CAPTURE);
        }
        setContent(message.content);
      } else if (message.type === 'capturePreview') {
        if (captureStateRef.current.status === 'pending') heldRequestsRef.current.push(message.requestId);
        else answerCapture(vscode, message.requestId, captureStateRef.current);
      } else if (message.type === 'previewVisibility') {
        setIsVisible(message.isVisible);
      } else if (message.type === 'capturePing') {
        vscode.postMessage({ type: 'capturePong', pingId: message.pingId } satisfies WebviewToHostMessage);
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
  }, [vscode, firstScene, handleCaptureStateChange]);

  const [panelId] = useState(() => `vscode-${Math.random().toString(36).slice(2, 10)}`);

  const handleNodeReveal = (path: string, nodeName: string) => {
    vscode.postMessage({ type: 'jumpToNode', nodeName, path } satisfies WebviewToHostMessage);
  };

  const handleCopyNodePath = (nodePath: string) => {
    vscode.postMessage({ type: 'copyNodePath', nodePath } satisfies WebviewToHostMessage);
  };

  return (
    <TscnPreviewShell
      panelId={panelId}
      scene={scene}
      onNodeReveal={handleNodeReveal}
      onCopyNodePath={handleCopyNodePath}
      initialViewportMode={INITIAL_VIEWPORT_MODE}
      onCaptureStateChange={handleCaptureStateChange}
      isVisible={isVisible}
    />
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
function answerCapture(vscode: VsCodeApi, requestId: string, state: PreviewCaptureState): void {
  if (state.status === 'ready') {
    void capturedMessage(requestId, state.capture).then((message) => vscode.postMessage(message));
    return;
  }
  const error =
    state.status === 'unavailable' ? state.reason : 'The preview canvas closed before the capture.';
  vscode.postMessage({ type: 'previewCaptureError', requestId, error } satisfies WebviewToHostMessage);
}

async function capturedMessage(
  requestId: string,
  capture: () => Promise<Blob>
): Promise<WebviewToHostMessage> {
  try {
    return { type: 'previewCaptured', requestId, dataUrl: await dataUrlOf(await capture()) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { type: 'previewCaptureError', requestId, error: `The capture failed: ${reason}` };
  }
}

function dataUrlOf(image: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('expected the image to read, got no reason'));
    reader.readAsDataURL(image);
  });
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

  // Not in a render, which StrictMode runs twice. Nothing disposes the last scene: it lives with the webview.
  const firstScene = openScene({ source: '', provider: new WebviewResourceProvider(vscode) });
  createRoot(root).render(
    <StrictMode>
      <R3FWebviewApp vscode={vscode} firstScene={firstScene} />
    </StrictMode>
  );
}
