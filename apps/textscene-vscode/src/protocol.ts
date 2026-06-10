/**
 * Typed host<->webview message protocol.
 *
 * Discriminated unions for every message that flows between the
 * extension host (TscnPreviewPanel) and the webview bundle
 * (r3f-webview-main / WebviewResourceProvider). These types describe
 * the EXISTING wire format exactly — changing a shape here is a
 * protocol change and must be coordinated on both sides.
 *
 * Shapes are declared as type aliases (not interfaces) so they stay
 * assignable to the loose `{ type: string; [key: string]: unknown }`
 * records used by the integration-test observability hooks.
 */

import type { MissingResource } from '@textscene/core/parser';

// ============================================================================
// Host -> Webview
// ============================================================================

/** Full scene text pushed on panel open and on file-save hot-reload. */
export type LoadTscnMessage = {
  type: 'loadTscn';
  content: string;
};

/**
 * Incremental update payload. The webview treats it as a full reload
 * using `data.sceneData.rawText` when present (React reconciliation
 * makes incremental computation redundant).
 */
export type IncrementalUpdateMessage = {
  type: 'incrementalUpdate';
  data: {
    changes: unknown[];
    sceneData: { rawText?: string };
  };
};

/** Successful response to a webview `loadResource` request. */
export type ResourceLoadedMessage = {
  type: 'resourceLoaded';
  requestId: string;
  /** Text content, or base64-encoded bytes when `isBinary` is true. */
  content: string;
  isBinary: boolean;
};

/** Failed response to a webview `loadResource` request. */
export type ResourceLoadErrorMessage = {
  type: 'resourceLoadError';
  requestId: string;
  error: string;
};

export type HostToWebviewMessage =
  | LoadTscnMessage
  | IncrementalUpdateMessage
  | ResourceLoadedMessage
  | ResourceLoadErrorMessage;

// ============================================================================
// Webview -> Host
// ============================================================================

/** Handshake: the React tree installed its `message` listener. */
export type WebviewReadyMessage = {
  type: 'webviewReady';
};

/** Surface an error to the user via `showErrorMessage`. */
export type ErrorMessage = {
  type: 'error';
  message: string;
};

/** Double-click in the scene tree: jump the editor to the node line. */
export type JumpToNodeMessage = {
  type: 'jumpToNode';
  nodeName: string;
  path: string;
};

/** Ask the host to read a resource file from the workspace. */
export type LoadResourceMessage = {
  type: 'loadResource';
  path: string;
  resourceType: string;
  requestId: string;
};

/** Report a resource the renderer needed but could not resolve. */
export type ResourceNeededMessage = {
  type: 'resourceNeeded';
  resource: MissingResource;
};

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Forward a webview log line to the host output channel. */
export type LogMessage = {
  type: 'log';
  level: LogLevel;
  message: string;
  args: unknown[];
};

export type WebviewToHostMessage =
  | WebviewReadyMessage
  | ErrorMessage
  | JumpToNodeMessage
  | LoadResourceMessage
  | ResourceNeededMessage
  | LogMessage;
