/** The webview ResourceProvider: it requests resources from the host by message. */

import type { ResourceProvider } from '@textscene/core';
import type { DirectoryEntry } from '@textscene/core/resources/projectListing';
import { isHostToWebviewMessage, type WebviewToHostMessage } from '../protocol';
import { decodeResourceResponse } from '../wireCodec';

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

/** A request awaiting its answer from the host. */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

export class WebviewResourceProvider implements ResourceProvider {
  private pending = new Map<string, PendingRequest>();
  private requestCounter = 0;

  constructor(private vscode: VsCodeApi) {
    window.addEventListener('message', (event) => {
      const message: unknown = event.data;
      if (!isHostToWebviewMessage(message)) return;

      if (message.type === 'resourceLoaded') {
        this.settle(message.requestId)?.resolve(decodeResourceResponse(message));
      } else if (message.type === 'resourceLoadError') {
        this.settle(message.requestId)?.reject(new Error(message.error));
      } else if (message.type === 'directoryListed') {
        this.settle(message.requestId)?.resolve(message.entries);
      }
    });
  }

  async loadResource(path: string, type?: string, maxBytes?: number): Promise<string | ArrayBuffer> {
    return this.request('resource', `Resource load timeout: ${path}`, (requestId) => ({
      type: 'loadResource',
      path,
      resourceType: type,
      maxBytes,
      requestId,
    }));
  }

  async listDirectory(folder: string): Promise<DirectoryEntry[] | null> {
    return this.request('listing', `Directory listing timeout: ${folder}`, (requestId) => ({
      type: 'listDirectory',
      folder,
      requestId,
    }));
  }

  /** The pending request for `requestId`, removed with its timeout, or undefined when it timed out or was answered. */
  private settle(requestId: string): PendingRequest | undefined {
    const request = this.pending.get(requestId);
    if (request) {
      clearTimeout(request.timeoutId);
      this.pending.delete(requestId);
    }
    return request;
  }

  /** Posts the message `makeMessage` builds and waits up to 10 s for the host's answer under the same id. */
  private request<T>(
    idPrefix: string,
    timeoutMessage: string,
    makeMessage: (requestId: string) => WebviewToHostMessage
  ): Promise<T> {
    const requestId = `${idPrefix}_${this.requestCounter++}`;
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pending.delete(requestId)) reject(new Error(timeoutMessage));
      }, 10000);
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeoutId });
      this.vscode.postMessage(makeMessage(requestId));
    });
  }
}
