/**
 * Manages TSCN preview webview panel lifecycle.
 */

import * as vscode from 'vscode';
import { generateWebviewHtml, generateNonce } from './webview/webviewHtml';
import type { MissingResource } from '@textscene/core';
import { VSCodeResourceProvider } from './providers/VSCodeResourceProvider';
import * as logger from './logger';

// Test observability hooks (only active when running in test context)
// Check for mocha test functions in global scope
const IS_TEST_MODE =
  typeof (global as { it?: unknown }).it === 'function' ||
  typeof (global as { describe?: unknown }).describe === 'function' ||
  typeof (global as { suite?: unknown }).suite === 'function' ||
  process.env.VSCODE_TEST_RUNNER === 'true';

if (IS_TEST_MODE) {
  // Global registry of active panels for testing
  (global as { _testActivePanels?: Map<string, TscnPreviewPanel> })._testActivePanels =
    (global as { _testActivePanels?: Map<string, TscnPreviewPanel> })._testActivePanels || new Map();

  // Global event emitter for panel creation
  (global as { _testPanelCreated?: vscode.EventEmitter<TscnPreviewPanel> })._testPanelCreated =
    (global as { _testPanelCreated?: vscode.EventEmitter<TscnPreviewPanel> })._testPanelCreated ||
    new vscode.EventEmitter<TscnPreviewPanel>();
}

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

  // Test observability: message history
  private _messageHistory: Array<{ type: string; [key: string]: unknown }> = [];

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

    const instance = new TscnPreviewPanel(panel, extensionUri, resource);

    // Test observability: register panel and emit creation event
    if (IS_TEST_MODE) {
      const registry = (global as { _testActivePanels?: Map<string, TscnPreviewPanel> })._testActivePanels;
      if (registry) {
        registry.set(resource.fsPath, instance);
      }

      const emitter = (global as { _testPanelCreated?: vscode.EventEmitter<TscnPreviewPanel> })._testPanelCreated;
      if (emitter) {
        emitter.fire(instance);
      }
    }

    return instance;
  }

  public reveal(column?: vscode.ViewColumn): void {
    this._panel.reveal(column);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, resource: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._currentResource = resource;

    // Set HTML only once during construction
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Load initial content
    this._loadTscnContent(resource);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'webviewReady':
            this._webviewReady = true;
            if (this._pendingLoadContent !== undefined) {
              const content = this._pendingLoadContent;
              this._pendingLoadContent = undefined;
              this._postMessageToWebview({ type: 'loadTscn', content });
            }
            return;
          case 'error':
            vscode.window.showErrorMessage(message.message);
            return;
          case 'jumpToNode':
            this._jumpToNodeDefinition(message.nodeName);
            return;
          case 'loadResource':
            this._handleLoadResource(message.path, message.resourceType, message.requestId);
            return;
          case 'resourceNeeded':
            this._handleResourceNeeded(message.resource);
            return;
          case 'log':
            this._handleLog(message.level, message.message, message.args);
            return;
        }
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

    // Test observability: remove from registry
    if (IS_TEST_MODE) {
      const registry = (global as { _testActivePanels?: Map<string, TscnPreviewPanel> })._testActivePanels;
      if (registry) {
        registry.delete(this._currentResource.fsPath);
      }
    }
  }

  public get resource(): vscode.Uri {
    return this._currentResource;
  }

  public update(resource: vscode.Uri) {
    this._currentResource = resource;
    this._panel.title = `Preview: ${resource.fsPath.split(/[\\/]/).pop()}`;
    this._loadTscnContent(resource);
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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    ).toString();
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css')
    ).toString();

    const nonce = generateNonce();
    return generateWebviewHtml({
      scriptUri,
      cssUri,
      nonce,
      cspSource: webview.cspSource,
    });
  }

  private async _jumpToNodeDefinition(nodeName: string): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(this._currentResource);
      const text = document.getText();
      const lines = text.split('\n');

      // Search for the node definition: [node name="NodeName"
      const pattern = `[node name="${nodeName}"`;
      let targetLine = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.includes(pattern)) {
          targetLine = i;
          break;
        }
      }

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
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(this._currentResource);
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const provider = new VSCodeResourceProvider(
        workspaceFolder.uri,
        this._currentResource
      );

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

  /**
   * Post a message to the webview with test observability.
   */
  private _postMessageToWebview(message: { type: string; [key: string]: unknown }): void {
    // Record message in test mode
    if (IS_TEST_MODE) {
      this._messageHistory.push(message);
    }

    this._panel.webview.postMessage(message);
  }

  /**
   * Test hook: Get all messages sent to the webview.
   * Only available in test mode.
   */
  public _testGetMessages(): Array<{ type: string; [key: string]: unknown }> {
    if (!IS_TEST_MODE) {
      throw new Error('Test hooks not available outside test mode');
    }
    return [...this._messageHistory];
  }

  /**
   * Test hook: Simulate a message from the webview.
   * Only available in test mode.
   */
  public _testTriggerMessage(message: { type: string; [key: string]: unknown }): void {
    if (!IS_TEST_MODE) {
      throw new Error('Test hooks not available outside test mode');
    }

    // Simulate the webview message handler
    // Note: Arrow functions or explicit binding to preserve 'this' context
    switch (message.type) {
      case 'error':
        vscode.window.showErrorMessage((message.message as string) || 'Unknown error');
        return;
      case 'jumpToNode':
        void this._jumpToNodeDefinition(message.nodeName as string);
        return;
      case 'loadResource':
        void this._handleLoadResource(
          message.path as string,
          message.resourceType as string,
          message.requestId as string,
        );
        return;
      case 'resourceNeeded':
        this._handleResourceNeeded(message.resource as MissingResource);
        return;
      case 'log':
        this._handleLog(
          message.level as string,
          message.message as string,
          message.args as unknown[]
        );
        return;
    }
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
