/**
 * The typed host<->webview message protocol: a discriminated union for every
 * message between TscnPreviewPanel and the webview bundle. A shape change here
 * changes the wire, so both sides move together. Type aliases, not interfaces,
 * stay assignable to the integration hooks' loose `{ type: string; … }` records.
 */

import type { MissingResource } from '@textscene/core/parser';
import type { WireResourcePayload } from './wireCodec';

// Host -> Webview

/** Full scene text pushed on panel open and on file-save hot-reload. */
export type LoadTscnMessage = {
  type: 'loadTscn';
  content: string;
};

/**
 * Incremental update payload. The webview treats it as a full reload of
 * `data.sceneData.rawText` when present, since React reconciliation does the diff.
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
} & WireResourcePayload;

/** Failed response to a webview `loadResource` request. */
export type ResourceLoadErrorMessage = {
  type: 'resourceLoadError';
  requestId: string;
  error: string;
};

/**
 * A watched dependency (texture, `.tres`, sub-scene) changed on disk. The webview
 * drops its cache for `path` and re-fetches it, since the main scene is unchanged.
 */
export type ResourceChangedMessage = {
  type: 'resourceChanged';
  /** The Godot `res://` path of the changed resource. */
  path: string;
};

export type HostToWebviewMessage =
  | LoadTscnMessage
  | IncrementalUpdateMessage
  | ResourceLoadedMessage
  | ResourceLoadErrorMessage
  | ResourceChangedMessage;

/**
 * Anything can post to a webview, so a listener narrows before it reads: a
 * message is a non-null object carrying a string `type`. Both webview
 * listeners share this guard so the wire is policed one way.
 */
export function isHostToWebviewMessage(data: unknown): data is HostToWebviewMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}

// Webview -> Host

/** Handshake: the React tree installed its `message` listener. */
export type WebviewReadyMessage = {
  type: 'webviewReady';
};

/** Surfaces an error to the user through `showErrorMessage`. */
export type ErrorMessage = {
  type: 'error';
  message: string;
};

/** Double-click in the scene tree: jump the editor to the node line. */
export type JumpToNodeMessage = {
  type: 'jumpToNode';
  nodeName: string;
  /**
   * Full tree path from the root, such as "Root/B/Leaf" (breadcrumb identifier).
   * Optional: a legacy webview sends `nodeName` alone, which `webviewDispatch`
   * admits and the handler answers with its first-name-match fallback.
   */
  path?: string;
  /**
   * Raw Godot `parent=` value of the node (`undefined` for root, `"."` for a
   * direct child, else the `/`-joined ancestor path minus the root). Used to
   * disambiguate duplicate sibling names when locating the `[node]` heading.
   */
  parent?: string;
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

/**
 * The host listener's guard, since a webview can post anything. Like
 * `isHostToWebviewMessage`, a message is a non-null object carrying a string `type`.
 */
export function isWebviewToHostMessage(data: unknown): data is WebviewToHostMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { type?: unknown }).type === 'string'
  );
}
