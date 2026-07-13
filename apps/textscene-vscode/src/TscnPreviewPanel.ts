/**
 * Manages TSCN preview webview panel lifecycle.
 */

import * as vscode from 'vscode';
import { generateWebviewHtml, generateNonce, type WebviewInitialConfig } from './webview/webviewHtml';
import type { MissingResource } from '@textscene/core/parser';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';
import { VSCodeResourceProvider } from './providers/VSCodeResourceProvider';
import { findNodeHeadingLine } from './nodeHeadingResolver';
import * as logger from './logger';

// ============================================================================
// Dispatch table
// ============================================================================

/**
 * Exhaustive handler table over the webview-to-host protocol union.
 * Adding a new message type to `WebviewToHostMessage` without adding a handler
 * here is a compile error — the mapped type guarantees coverage.
 */
type WebviewMessageHandlers = {
  [K in WebviewToHostMessage['type']]: (
    msg: Extract<WebviewToHostMessage, { type: K }>
  ) => void;
};

/**
 * Route `msg` to the corresponding handler in `handlers`.
 * Both the production `onDidReceiveMessage` listener and tests go through
 * this function, so the two paths cannot drift.
 */
export function dispatchWebviewMessage(
  msg: WebviewToHostMessage,
  handlers: WebviewMessageHandlers
): void {
  (handlers[msg.type] as (m: WebviewToHostMessage) => void)(msg);
}

// ============================================================================
// Panel class
// ============================================================================

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
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

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
        void this._jumpToNodeDefinition(msg.nodeName, msg.parent);
      },
      loadResource: (msg) => {
        void this._handleLoadResource(msg.path, msg.resourceType, msg.requestId);
      },
      resourceNeeded: (msg) => {
        this._handleResourceNeeded(msg.resource);
      },
      log: (msg) => {
        this._handleLog(msg.level, msg.message, msg.args);
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

  private _getHtmlForWebview(webview: vscode.Webview): string {
    // WI-R3F-18: webview build moved to `dist/webview/` (ESM + splitting)
    // so lazy-loaded chunks live alongside the entry script and import
    // each other via relative URIs.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'webview.js')
    ).toString();
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'webview.css')
    ).toString();

    const nonce = generateNonce();
    return generateWebviewHtml({
      scriptUri,
      cssUri,
      nonce,
      cspSource: webview.cspSource,
      initialConfig: this._getInitialConfig(),
    });
  }

  /**
   * Read the settings the webview needs at mount. Read once per panel
   * creation (baked into the HTML, not reactive) — like `nonce`, this is
   * fixed for the panel's lifetime; a setting change takes effect on the
   * next preview opened, not the current one.
   */
  private _getInitialConfig(): WebviewInitialConfig {
    const viewportMode = vscode.workspace
      .getConfiguration('textscene')
      .get<'auto' | '2D' | '3D'>('defaultViewportMode', 'auto');
    return { viewportMode };
  }

  private async _jumpToNodeDefinition(nodeName: string, expectedParent?: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(this._currentResource);
      const text = document.getText();
      const lines = text.split('\n');

      const targetLine = findNodeHeadingLine(lines, nodeName, expectedParent);

      if (targetLine === -1) {
        vscode.window.showWarningMessage(`Could not find node "${nodeName}" in file`);
        return;
      }

      // Open the document and jump to the line
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
      });

      // Set selection to the line with the node definition
      const position = new vscode.Position(targetLine, 0);
      const range = new vscode.Range(position, position);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to jump to node: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      // Convert ArrayBuffer to base64 for binary data
      let responseContent: string;
      if (content instanceof ArrayBuffer) {
        const bytes = new Uint8Array(content);
        // Convert to base64 in chunks to avoid stack overflow with large files
        const chunkSize = 8192; // Process 8KB at a time
        let binaryString = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binaryString += String.fromCharCode(...chunk);
        }
        responseContent = btoa(binaryString);
      } else {
        responseContent = content;
      }

      this._postMessageToWebview({
        type: 'resourceLoaded',
        requestId,
        content: responseContent,
        isBinary: content instanceof ArrayBuffer,
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
    this._panel.webview.postMessage(message);
  }

  private _handleResourceNeeded(resource: MissingResource): void {
    const channel = logger.getChannel();
    if (channel) {
      channel.warn(`Missing resource: ${resource.path} (${resource.type})`);
      channel.warn(`  Referenced by node: ${resource.referencedBy}`);
      channel.warn(`  Error: ${resource.error}`);

      // Show the output channel so user can see the error
      logger.show();
    }
  }

  private _handleLog(level: string, message: string, args: unknown[]): void {
    const channel = logger.getChannel();
    if (!channel) {
      return;
    }

    // Format args for display
    const formattedArgs = args.map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    });

    const fullMessage = formattedArgs.length > 0
      ? `${message} ${formattedArgs.join(' ')}`
      : message;

    switch (level) {
      case 'trace':
        channel.trace(fullMessage);
        break;
      case 'debug':
        channel.debug(fullMessage);
        break;
      case 'info':
        channel.info(fullMessage);
        break;
      case 'warn':
        channel.warn(fullMessage);
        break;
      case 'error':
        channel.error(fullMessage);
        break;
      default:
        channel.info(fullMessage);
    }
  }
}
