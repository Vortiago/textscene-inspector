/**
 * Manages the lifecycle of the TSCN preview webview panel. The rest lives beside it:
 * `webviewDispatch` (routing an inbound message), `jumpToNodeDefinition` (editor
 * navigation), `hostLogRelay` (the output channel) and `panelHtml` (the document).
 */

import * as vscode from 'vscode';
import type { HostToWebviewMessage } from './protocol';
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
  /** Last text read off disk: both the re-read diff and the ready replay read it. */
  private _previousContent: string | undefined;
  private _onDidDispose: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidDispose: vscode.Event<void> = this._onDidDispose.event;

  /**
   * Webview-ready handshake. The `useEffect` that installs the webview's `message`
   * listener runs after `createRoot().render(...)`, so a post sent before it is
   * dropped. Posts wait on this flag, and `webviewReady` replays `_previousContent`.
   */
  private _webviewReady = false;
  /** Set by `dispose()`. `_webviewReady` stays true after it, so it is not this. */
  private _disposed = false;

  /**
   * Cached per panel, so `findProjectRoot`'s walk and the served `fsPath -> res://`
   * map (`VSCodeResourceProvider.getServedResPath`) survive across requests and
   * dependency changes. `update()` discards it only when the document changes.
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

    this._panel.webview.html = buildPanelHtml(this._panel.webview, this._extensionUri);

    this._loadTscnContent(resource);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    const handlers: WebviewMessageHandlers = {
      webviewReady: (_msg) => {
        this._webviewReady = true;
        // Every remount, such as a move to another editor group, posts ready with
        // an empty tree. Replay always, so a ready webview holds the current text:
        // the `_previousContent` diff swallows a later re-read, which leaves the
        // preview on "Loading scene…".
        if (this._previousContent !== undefined) {
          this._postMessageToWebview({ type: 'loadTscn', content: this._previousContent });
        }
      },
      error: (msg) => {
        vscode.window.showErrorMessage(msg.message);
      },
      jumpToNode: (msg) => {
        void jumpToNodeDefinition(
          this._currentResource,
          msg.nodeName,
          msg.parent,
          this._panel.viewColumn
        );
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
      (message: unknown) => {
        dispatchWebviewMessage(message, handlers);
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    if (this._disposed) return;
    // Set first: `_onDidDispose` listeners and a load in flight reach
    // `_postMessageToWebview`, and `WebviewPanel.webview` throws `Webview is
    // disposed`. `_handleLoadResource`'s catch re-posts and throws out of its
    // `void`ed call as an unhandled rejection.
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
    // Only a new document invalidates the cached provider. A same-document refresh
    // keeps it: the webview's cache re-requests no unchanged path, so clearing the
    // served-resources map drops live entries and reopens the relevance gate.
    if (resource.toString() !== this._currentResource.toString()) {
      this._resourceProvider = null;
    }
    this._currentResource = resource;
    this._panel.title = `Preview: ${resource.fsPath.split(/[\\/]/).pop()}`;
    this._loadTscnContent(resource);
  }

  /** Lazily creates this panel's `VSCodeResourceProvider`, then reuses it. */
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
   * Tells the webview to re-fetch a watched dependency that changed on disk, since
   * the unchanged scene text makes `_loadTscnContent` no-op. A path missing from
   * the served-resources map was never requested, so it has nothing to invalidate.
   */
  public async handleDependencyChange(fileUri: vscode.Uri): Promise<void> {
    // A webview that is not ready yet loads everything fresh on mount.
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
   * Asks the webview to drop its cache for a resource and re-fetch it. A no-op
   * before the handshake, since the webview then loads everything fresh on mount.
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

      if (this._previousContent === textContent) {
        return;
      }

      // The host sends the full text: the webview re-parses and React reconciles.
      this._previousContent = textContent;

      // A tree without its `message` listener yet gets this text from the
      // `webviewReady` replay.
      if (this._webviewReady) {
        this._postMessageToWebview({ type: 'loadTscn', content: textContent });
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
