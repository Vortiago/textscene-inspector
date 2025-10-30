/**
 * TSCN webview entry point - runs inside VS Code webview.
 */

import { TscnPreviewUI } from '@textscene/renderer';
import type { TscnPreviewElements, CameraState } from '@textscene/renderer';
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
  console.log('[TSCN Webview] Saving camera state:', cameraState);
  vscode.setState(state);
}

function restoreState() {
  const state = vscode.getState() as WebviewState | undefined;
  console.log('[TSCN Webview] Restoring state:', state);
  if (state?.cameraState) {
    const renderer = previewUI.getRenderer();
    renderer.setCameraState(state.cameraState);
    console.log('[TSCN Webview] Camera state restored');
  } else {
    console.log('[TSCN Webview] No saved state to restore');
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
      console.log('[TSCN Webview] Received loadTscn message, loading scene...');
      try {
        previewUI.loadTscn(message.content);
        console.log('[TSCN Webview] Scene loaded, restoring state...');
        // Restore camera state after scene loads
        restoreState();
      } catch (error) {
        console.error('[TSCN Webview] Error in webview message handler:', error);
      }
      break;

    case 'incrementalUpdate':
      console.log('[TSCN Webview] Received incrementalUpdate message with', message.data.changes.length, 'changes');
      try {
        previewUI.handleIncrementalUpdate(message.data.changes, message.data.sceneData);
        console.log('[TSCN Webview] Incremental update applied, restoring camera state...');
        restoreState();
      } catch (error) {
        console.error('[TSCN Webview] Error applying incremental update:', error);
      }
      break;
  }
});
