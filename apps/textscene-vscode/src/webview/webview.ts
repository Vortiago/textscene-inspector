/**
 * TSCN webview entry point - runs inside VS Code webview.
 */

import { TscnPreviewUI, setLogAdapter, info, error, type LogAdapter } from '@textscene/core';
import type { TscnPreviewElements, CameraState } from '@textscene/core';
import { WebviewResourceProvider } from './WebviewResourceProvider';

declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

interface WebviewState {
  cameraState?: CameraState;
  selectedNodePath?: string;
}

const vscode = acquireVsCodeApi();
const resourceProvider = new WebviewResourceProvider(vscode);

// Set up log adapter to forward core library logs to extension host
class WebviewLogAdapter implements LogAdapter {
  trace(message: string, ...args: unknown[]): void {
    console.log(`[TRACE] ${message}`, ...args);
    vscode.postMessage({ type: 'log', level: 'trace', message, args });
  }

  debug(message: string, ...args: unknown[]): void {
    console.log(`[DEBUG] ${message}`, ...args);
    vscode.postMessage({ type: 'log', level: 'debug', message, args });
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
    vscode.postMessage({ type: 'log', level: 'info', message, args });
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
    vscode.postMessage({ type: 'log', level: 'warn', message, args });
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
    vscode.postMessage({ type: 'log', level: 'error', message, args });
  }
}

setLogAdapter(new WebviewLogAdapter());

const elements: TscnPreviewElements = {
  canvas: document.getElementById('canvas') as HTMLCanvasElement,
  errorDisplay: document.getElementById('error-display') as HTMLDivElement,
  errorMessage: document.getElementById('error-message') as HTMLParagraphElement,
  sceneInfo: document.getElementById('scene-info') as HTMLDivElement,
  nodeCount: document.getElementById('node-count') as HTMLParagraphElement,
  rootNode: document.getElementById('root-node') as HTMLParagraphElement,
  treeViewerContainer: document.getElementById('tree-viewer-container') as HTMLDivElement,
  expandAllBtn: document.getElementById('expand-all-btn') as HTMLButtonElement,
  collapseAllBtn: document.getElementById('collapse-all-btn') as HTMLButtonElement,
  treeSearchInput: document.getElementById('tree-search') as HTMLInputElement,
  nodeDetailsPanel: document.getElementById('node-details-panel') as HTMLDivElement,
  detailsNodeName: document.getElementById('details-node-name') as HTMLHeadingElement,
  detailsContent: document.getElementById('details-content') as HTMLDivElement,
};

const previewUI = new TscnPreviewUI(elements, {
  onNodeDoubleClick: (node) => {
    // Send message to extension to jump to node definition in source file
    vscode.postMessage({
      type: 'jumpToNode',
      nodeName: node.name,
    });
  },
  resourceProvider,
  onResourceNeeded: async (resource) => {
    // Send message to extension to log missing resource
    vscode.postMessage({
      type: 'resourceNeeded',
      resource,
    });
    // Cannot provide resource immediately in VSCode - user must add file to workspace
    return null;
  },
});

function saveState() {
  const renderer = previewUI.getRenderer();
  const cameraState = renderer.getCameraState();
  const state: WebviewState = {
    cameraState,
  };
  info('[TSCN Webview] Saving camera state:', cameraState);
  vscode.setState(state);
}

function restoreState() {
  const state = vscode.getState() as WebviewState | undefined;
  info('[TSCN Webview] Restoring state:', state);
  if (state?.cameraState) {
    const renderer = previewUI.getRenderer();
    renderer.setCameraState(state.cameraState);
    info('[TSCN Webview] Camera state restored');
  } else {
    info('[TSCN Webview] No saved state to restore');
  }
}

// Save camera state periodically (every 500ms of inactivity)
let saveTimeout: number | undefined;
const scheduleSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = window.setTimeout(saveState, 500);
};

// Monitor canvas for interactions to trigger state saves
elements.canvas.addEventListener('mousedown', scheduleSave);
elements.canvas.addEventListener('mouseup', () => {
  scheduleSave();
  // Also save immediately on mouse up to catch quick edits before save
  setTimeout(saveState, 100);
});
elements.canvas.addEventListener('wheel', scheduleSave);
elements.canvas.addEventListener('touchstart', scheduleSave);
elements.canvas.addEventListener('touchend', () => {
  scheduleSave();
  setTimeout(saveState, 100);
});

window.addEventListener('message', (event) => {
  const message = event.data;

  switch (message.type) {
    case 'loadTscn':
      info('[TSCN Webview] Received loadTscn message, loading scene...');
      try {
        previewUI.loadTscn(message.content);
        info('[TSCN Webview] Scene loaded, restoring state...');
        // Restore camera state after scene loads
        restoreState();
      } catch (err) {
        error('[TSCN Webview] Error in webview message handler:', err);
      }
      break;

    case 'incrementalUpdate':
      info('[TSCN Webview] Received incrementalUpdate message with', message.data.changes.length, 'changes');
      try {
        previewUI.handleIncrementalUpdate(message.data.changes, message.data.sceneData);
        info('[TSCN Webview] Incremental update applied, restoring camera state...');
        restoreState();
      } catch (err) {
        error('[TSCN Webview] Error applying incremental update:', err);
      }
      break;
  }
});
