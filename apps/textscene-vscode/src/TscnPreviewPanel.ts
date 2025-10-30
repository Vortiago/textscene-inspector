/**
 * Manages TSCN preview webview panel lifecycle.
 */

import * as vscode from 'vscode';
import { generateWebviewHtml, generateNonce } from './webview/webviewHtml';
import type { IncrementalUpdateData, MissingResource } from '@textscene/renderer';
import { computeIncrementalChanges } from './diffUtils';
import { VSCodeResourceProvider } from './providers/VSCodeResourceProvider';
import * as logger from './logger';

export class TscnPreviewPanel {
  public static readonly viewType = 'tscnPreview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentResource: vscode.Uri;
  private _previousContent: string | undefined;
  private _onDidDispose: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidDispose: vscode.Event<void> = this._onDidDispose.event;

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

      // First load always does full load
      if (!this._previousContent) {
        this._previousContent = textContent;
        this._panel.webview.postMessage({
          type: 'loadTscn',
          content: textContent,
        });
        return;
      }

      // Compute incremental changes using hash-based diff
      const diffResult = computeIncrementalChanges(this._previousContent, textContent);
      this._previousContent = textContent;

      if (diffResult.updateType === 'full' || !diffResult.changes || !diffResult.newScene) {
        // Full reload
        this._panel.webview.postMessage({
          type: 'loadTscn',
          content: textContent,
        });
      } else {
        // Incremental update
        const updateData: IncrementalUpdateData = {
          changes: diffResult.changes,
          sceneData: diffResult.newScene,
        };
        this._panel.webview.postMessage({
          type: 'incrementalUpdate',
          data: updateData,
        });
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

    const nonce = generateNonce();
    return generateWebviewHtml(scriptUri, nonce);
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
        responseContent = btoa(String.fromCharCode(...bytes));
      } else {
        responseContent = content;
      }

      this._panel.webview.postMessage({
        type: 'resourceLoaded',
        requestId,
        content: responseContent,
        isBinary: content instanceof ArrayBuffer,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'resourceLoadError',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
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
}
