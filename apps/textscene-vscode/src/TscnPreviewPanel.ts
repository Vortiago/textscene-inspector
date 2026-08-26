/**
 * Manages TSCN preview webview panel lifecycle.
 *
 * The three things the panel does that are not lifecycle live beside it:
 * `webviewDispatch` (routing an inbound message), `jumpToNodeDefinition`
 * (the editor navigation), `hostLogRelay` (the output channel) and
 * `panelHtml` (the document the webview mounts).
 */

import * as vscode from 'vscode';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';
import { VSCodeResourceProvider } from './providers/VSCodeResourceProvider';
import { buildPanelHtml } from './panelHtml';
import { dispatchWebviewMessage, type WebviewMessageHandlers } from './webviewDispatch';
import { jumpToNodeDefinition } from './jumpToNodeDefinition';
import { relayMissingResource, relayWebviewLog } from './hostLogRelay';
import { encodeResourceResponse } from './wireCodec';

export { dispatchWebviewMessage } from './webviewDispatch';
export type { WebviewMessageHandlers } from './webviewDispatch';

export class TscnPreviewPanel {
  public static readonly viewType = 'tscnPreview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentResource: vscode.Uri;
  private _previousContent: string | undefined;
  private _onDidDispose: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidDispose: vscode.Event<void> = this._onDidDispose.event;

  /**
   * Webview-ready handshake (fixes VSCODE-01 race).
   *
   * The HTML mounts the JS bundle asynchronously, which in turn renders
   * the React tree. React's `useEffect` that installs the `message`
   * listener does not run synchronously with `createRoot().render(...)`,
   * so any `postMessage` the extension host sends before the effect
   * fires is dropped. We work around this by caching the last `loadTscn`
   * payload here and re-sending it after the webview posts the
   * `webviewReady` message.
   */
  private _webviewReady = false;
  /** Set by `dispose()`. `_webviewReady` stays true after it, so it is not this. */
  private _disposed = false;
  private _pendingLoadContent: string | undefined;

  /**
   * Cached per-panel so `findProjectRoot`'s directory walk and the served
   * `fsPath -> res://` map (see `VSCodeResourceProvider.getServedResPath`)
   * survive across the many `loadResource` requests and dependency-change
   * events a single panel handles. Discarded in `update()` only when the
   * panel's underlying document actually changes.
   */
  private _resourceProvider: VSCodeResourceProvider | null = null;

  public static create(extensionUri: vscode.Uri, resource: vscode.Uri): TscnPreviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn! + 1
      : vscode.ViewColumn.Two;

    const filename = resource.fsPath.split(/[\\/]/).pop();
    const panel = vscode.window.createWebviewPanel(
      TscnPreviewPanel.viewType,
      `Preview: ${filename}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
      }
    );

    return new TscnPreviewPanel(panel, extensionUri, resource);
  }

  public reveal(column?: vscode.ViewColumn): void {
    this._panel.reveal(column);
  }

  public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, resource: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._currentResource = resource;

    // Set HTML only once during construction
    this._panel.webview.html = buildPanelHtml(this._panel.webview, this._extensionUri);

    // Load initial content
    this._loadTscnContent(resource);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    const handlers: WebviewMessageHandlers = {
      webviewReady: (_msg) => {
        this._webviewReady = true;
        if (this._pendingLoadContent !== undefined) {
          const content = this._pendingLoadContent;
          this._pendingLoadContent = undefined;
          this._postMessageToWebview({ type: 'loadTscn', content });
        }
      },
      error: (msg) => {
        vscode.window.showErrorMessage(msg.message);
      },
      jumpToNode: (msg) => {
        void jumpToNodeDefinition(this._currentResource, msg.nodeName, msg.parent);
      },
      loadResource: (msg) => {
        void this._handleLoadResource(msg.path, msg.resourceType, msg.requestId);
      },
      resourceNeeded: (msg) => {
        relayMissingResource(msg.resource);
      },
      log: (msg) => {
        relayWebviewLog(msg.level, msg.message, msg.args);
      },
    };

    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToHostMessage) => {
        dispatchWebviewMessage(message, handlers);
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    if (this._disposed) return;
    // Set FIRST: `_onDidDispose` listeners and any load still in flight both
    // reach `_postMessageToWebview`, and `WebviewPanel.webview` throws
    // `Webview is disposed` from its getter. `_handleLoadResource` posts from
    // inside its own try/catch, so the catch re-posts and throws again, escaping
    // its `void`ed call as an unhandled rejection.
    this._disposed = true;
    this._onDidDispose.fire();

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this._onDidDispose.dispose();
  }

  public get resource(): vscode.Uri {
    return this._currentResource;
  }

  public update(resource: vscode.Uri) {
    // Only a genuine document-identity change invalidates the cached provider
    // — its project-root cache and served-resources map (see
    // `_getResourceProvider`) stay valid across a same-document refresh (an
    // in-editor save, an external edit), and deliberately aren't cleared then:
    // resources whose path didn't change won't be re-requested by the
    // webview's own client-side cache, so clearing here would silently drop
    // still-relevant entries and reopen the relevance gate this cache closes.
    if (resource.toString() !== this._currentResource.toString()) {
      this._resourceProvider = null;
    }
    this._currentResource = resource;
    this._panel.title = `Preview: ${resource.fsPath.split(/[\\/]/).pop()}`;
    this._loadTscnContent(resource);
  }

  /**
   * Lazily create (and reuse) this panel's `VSCodeResourceProvider`, so its
   * `findProjectRoot` result and served-resources map persist across the many
   * `loadResource` requests and dependency-change events a panel handles,
   * instead of re-walking the project-root search and re-resolving every path
   * from scratch on each call.
   */
  private _getResourceProvider(): VSCodeResourceProvider | null {
    if (this._resourceProvider) {
      return this._resourceProvider;
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(this._currentResource);
    if (!workspaceFolder) {
      return null;
    }
    this._resourceProvider = new VSCodeResourceProvider(workspaceFolder.uri, this._currentResource);
    return this._resourceProvider;
  }

  /**
   * A watched dependency (texture, `.tres`, sub-scene) changed on disk. The main
   * scene text is unchanged, so `_loadTscnContent`'s content-diff guard would
   * no-op; instead tell the webview to re-fetch just this resource. Looks up
   * the file's `res://` path in the provider's served-resources map — a miss
   * means the current scene never requested this file (irrelevant, or not yet
   * loaded), so there is nothing to invalidate.
   */
  public async handleDependencyChange(fileUri: vscode.Uri): Promise<void> {
    // A not-yet-ready webview loads everything fresh on mount — skip the
    // lookup entirely in that window.
    if (!this._webviewReady) {
      return;
    }
    const provider = this._getResourceProvider();
    if (!provider) {
      return;
    }
    const resPath = provider.getServedResPath(fileUri);
    if (resPath) {
      this.invalidateResource(resPath);
    }
  }

  /**
   * Ask the webview to drop its cache for a resource and re-fetch it. No-op until
   * the webview handshake completes — a not-yet-ready webview loads everything
   * fresh once it mounts, so there is nothing to invalidate.
   */
  public invalidateResource(resPath: string): void {
    if (!this._webviewReady) {
      return;
    }
    this._postMessageToWebview({ type: 'resourceChanged', path: resPath });
  }

  private async _loadTscnContent(resource: vscode.Uri) {
    try {
      const fileContent = await vscode.workspace.fs.readFile(resource);
      const textContent = new TextDecoder().decode(fileContent);

      // Check if content actually changed
      if (this._previousContent === textContent) {
        return;
      }

      // React reconciliation handles diffing inside the webview, so the
      // extension host always sends the full text and lets the shell
      // re-parse + reconcile.
      this._previousContent = textContent;

      // Gate the post on the webview-ready handshake. If the React
      // tree hasn't installed its `message` listener yet, cache the
      // payload and let the `webviewReady` handler replay it.
      if (this._webviewReady) {
        this._postMessageToWebview({ type: 'loadTscn', content: textContent });
      } else {
        this._pendingLoadContent = textContent;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load TSCN file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async _handleLoadResource(
    resourcePath: string,
    resourceType: string,
    requestId: string
  ): Promise<void> {
    try {
      const provider = this._getResourceProvider();
      if (!provider) {
        throw new Error('No workspace folder found');
      }

      const content = await provider.loadResource(resourcePath, resourceType);
      const payload = encodeResourceResponse(content);

      this._postMessageToWebview({
        type: 'resourceLoaded',
        requestId,
        ...payload,
      });
    } catch (error) {
      this._postMessageToWebview({
        type: 'resourceLoadError',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private _postMessageToWebview(message: HostToWebviewMessage): void {
    if (this._disposed) return;
    this._panel.webview.postMessage(message);
  }
}
