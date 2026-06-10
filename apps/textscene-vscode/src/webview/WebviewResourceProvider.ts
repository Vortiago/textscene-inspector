/**
 * ResourceProvider implementation for VS Code webview environment.
 * Requests resources from the extension via message passing.
 */

import type { ResourceProvider } from '@textscene/core';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../protocol';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

export class WebviewResourceProvider implements ResourceProvider {
  private pendingRequests: Map<string, { resolve: (value: string | ArrayBuffer) => void; reject: (error: Error) => void; timeoutId: number }> = new Map();
  private requestCounter = 0;

  constructor(private vscode: VsCodeApi) {
    // Listen for resource responses from extension
    window.addEventListener('message', (event) => {
      const message = event.data as HostToWebviewMessage;

      if (message.type === 'resourceLoaded') {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(message.requestId);

          // Convert base64 back to content
          if (message.isBinary) {
            // Decode base64 to ArrayBuffer
            const binaryString = atob(message.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            pending.resolve(bytes.buffer);
          } else {
            pending.resolve(message.content);
          }
        }
      } else if (message.type === 'resourceLoadError') {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(message.requestId);
          pending.reject(new Error(message.error));
        }
      }
    });
  }

  async loadResource(path: string, type: string): Promise<string | ArrayBuffer> {
    const requestId = `resource_${this.requestCounter++}`;

    return new Promise((resolve, reject) => {
      // Timeout after 10 seconds
      const timeoutId = window.setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Resource load timeout: ${path}`));
        }
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      // Send request to extension
      this.vscode.postMessage({
        type: 'loadResource',
        path,
        resourceType: type,
        requestId,
      } satisfies WebviewToHostMessage);
    });
  }

  hasResource(_path: string): boolean {
    // Can't determine synchronously in webview, return true
    return true;
  }
}
