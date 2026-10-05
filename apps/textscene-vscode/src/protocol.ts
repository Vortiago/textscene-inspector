/**
 * The typed host<->webview message protocol: a discriminated union for every
 * message between TscnPreviewPanel and the webview bundle. A shape change here
 * changes the wire, so both sides move together. Type aliases, not interfaces,
 * stay assignable to the integration hooks' loose `{ type: string; … }` records.
 */

import type { WireResourcePayload } from './wireCodec';

// Host -> Webview

/** Full scene text pushed on panel open and on file-save hot-reload. */
export type LoadTscnMessage = {
  type: 'loadTscn';
  content: string;
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

/**
 * Ask the webview to capture the viewport as a PNG data URL, for a save or a tool. The host
 * posts it only after `previewCaptureReady`, so the webview has a screenshot handler.
 */
export type CapturePreviewMessage = {
  type: 'capturePreview';
  requestId: string;
};

export type HostToWebviewMessage =
  | LoadTscnMessage
  | ResourceLoadedMessage
  | ResourceLoadErrorMessage
  | ResourceChangedMessage
  | CapturePreviewMessage;

/**
 * Anything can post to a webview, so a listener narrows before it reads: a
 * message is a non-null object carrying a string `type`. Both webview
 * listeners share this guard so the wire is policed one way.
 */
export function isHostToWebviewMessage(data: unknown): data is HostToWebviewMessage {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string';
}

// Webview -> Host

/** Handshake: the React tree installed its `message` listener. */
export type WebviewReadyMessage = {
  type: 'webviewReady';
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
  /** Absent for a processor load: the byte layer reads a file without knowing its type. */
  resourceType?: string;
  requestId: string;
};

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** Forward a webview log line to the host output channel. */
export type LogMessage = {
  type: 'log';
  level: LogLevel;
  message: string;
  args: unknown[];
};

/** The answer to a `capturePreview`: a `data:image/png;base64,…` URL. */
export type PreviewCapturedMessage = {
  type: 'previewCaptured';
  requestId: string;
  dataUrl: string;
};

/** A `capturePreview` that crossed a change of capture state on the wire, with that state's reason. */
export type PreviewCaptureErrorMessage = {
  type: 'previewCaptureError';
  requestId: string;
  error: string;
};

/**
 * The canvas has a screenshot handler, so a `capturePreview` gets an image. The webview
 * posts each capture state after `webviewReady`, and again on every change.
 */
export type PreviewCaptureReadyMessage = {
  type: 'previewCaptureReady';
};

/** The canvas has no screenshot handler yet, such as while it creates its renderer. */
export type PreviewCapturePendingMessage = {
  type: 'previewCapturePending';
};

/** No canvas can capture until `reason` changes, such as a window with no WebGL context. */
export type PreviewCaptureUnavailableMessage = {
  type: 'previewCaptureUnavailable';
  reason: string;
};

export type WebviewToHostMessage =
  | WebviewReadyMessage
  | JumpToNodeMessage
  | LoadResourceMessage
  | LogMessage
  | PreviewCapturedMessage
  | PreviewCaptureErrorMessage
  | PreviewCaptureReadyMessage
  | PreviewCapturePendingMessage
  | PreviewCaptureUnavailableMessage;

/**
 * The host listener's guard, since a webview can post anything. Like
 * `isHostToWebviewMessage`, a message is a non-null object carrying a string `type`.
 */
export function isWebviewToHostMessage(data: unknown): data is WebviewToHostMessage {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string';
}
