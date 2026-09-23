/** The webview ResourceProvider: it requests resources from the host by message. */

import type { ResourceProvider } from '@textscene/core';
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol';
import { decodeResourceResponse } from '../wireCodec';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

export class WebviewResourceProvider implements ResourceProvider {
  private pendingRequests: Map<string, { resolve: (value: string | ArrayBuffer) => void; reject: (error: Error) => void; timeoutId: number }> = new Map();
  private requestCounter = 0;

  constructor(private vscode: VsCodeApi) {
    window.addEventListener('message', (event) => {
      const message: unknown = event.data;
      if (!isHostToWebviewMessage(message)) return;

      if (message.type === 'resourceLoaded') {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(message.requestId);
          pending.resolve(decodeResourceResponse(message));
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
      const timeoutId = window.setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Resource load timeout: ${path}`));
        }
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      this.vscode.postMessage({
        type: 'loadResource',
        path,
        resourceType: type,
        requestId,
      } satisfies WebviewToHostMessage);
    });
  }
}
