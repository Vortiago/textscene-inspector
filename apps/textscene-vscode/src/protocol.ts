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
  /** The document's `res://` path, which names its sub-resources. Null where no `res://` root holds it. */
  scenePath: string | null;
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

/** The answer to a webview `listDirectory`: the folder's entries, or null when the workspace has no such folder. */
export type DirectoryListedMessage = {
  type: 'directoryListed';
  requestId: string;
  entries: { name: string; isDirectory: boolean }[] | null;
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

/** A PNG data URL request, which the host posts only after `previewCaptureReady`. */
export type CapturePreviewMessage = {
  type: 'capturePreview';
  requestId: string;
};

/** Asks a webview that holds a capture request whether it still runs. It answers `capturePong`. */
export type CapturePingMessage = {
  type: 'capturePing';
  pingId: string;
};

/**
 * Whether the panel's tab shows. A hidden panel keeps its webview alive
 * (`retainContextWhenHidden`), so the webview stops rendering until it shows again. Posted once
 * after `webviewReady`, and on each change.
 */
export type PreviewVisibilityMessage = {
  type: 'previewVisibility';
  isVisible: boolean;
};

export type HostToWebviewMessage =
  | LoadTscnMessage
  | ResourceLoadedMessage
  | ResourceLoadErrorMessage
  | DirectoryListedMessage
  | ResourceChangedMessage
  | CapturePreviewMessage
  | CapturePingMessage
  | PreviewVisibilityMessage;

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

/**
 * The import of the page's entry script failed to fetch, parse or run, so `webviewReady`
 * never comes. The page's own bootstrap posts this with the import's error.
 */
export type WebviewLoadFailedMessage = {
  type: 'webviewLoadFailed';
  error: string;
};

/** Double-click in the scene tree: jump the editor to the node line. */
export type JumpToNodeMessage = {
  type: 'jumpToNode';
  nodeName: string;
  /** Scene-tree path from the root, its first segment the root's name: "Root/B/Leaf". */
  path: string;
};

/** The host writes the path to the clipboard, so the copy does not depend on the webview's permission. */
export type CopyNodePathMessage = {
  type: 'copyNodePath';
  /** As Godot's "Copy Node Path" writes it: from the scene root, `.` for the root. */
  nodePath: string;
};

/** Ask the host to read a resource file from the workspace. */
export type LoadResourceMessage = {
  type: 'loadResource';
  path: string;
  /** Absent for a processor load: the byte layer reads a file without knowing its type. */
  resourceType?: string;
  /** Absent for a file read whole: the byte layer asks for a file's leading bytes only when its parse needs no more. */
  maxBytes?: number;
  requestId: string;
};

/** Ask the host to list a `res://` folder, which has no trailing slash (`res://` is the root). */
export type ListDirectoryMessage = {
  type: 'listDirectory';
  folder: string;
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

/** A `capturePreview` that crossed a capture-state change on the wire or failed, with the reason. */
export type PreviewCaptureErrorMessage = {
  type: 'previewCaptureError';
  requestId: string;
  error: string;
};

/** The webview posts each capture state after `webviewReady`, and again on every change. */
export type PreviewCaptureReadyMessage = {
  type: 'previewCaptureReady';
};

/** The view has not settled on the current scene yet, such as while it mounts or loads a file. */
export type PreviewCapturePendingMessage = {
  type: 'previewCapturePending';
};

/** No canvas can capture until `reason` changes, such as a window with no WebGL context. */
export type PreviewCaptureUnavailableMessage = {
  type: 'previewCaptureUnavailable';
  reason: string;
};

/** The answer to a `capturePing`, posted at once whatever the capture state. */
export type CapturePongMessage = {
  type: 'capturePong';
  pingId: string;
};

export type WebviewToHostMessage =
  | WebviewReadyMessage
  | WebviewLoadFailedMessage
  | JumpToNodeMessage
  | CopyNodePathMessage
  | LoadResourceMessage
  | ListDirectoryMessage
  | LogMessage
  | PreviewCapturedMessage
  | PreviewCaptureErrorMessage
  | PreviewCaptureReadyMessage
  | PreviewCapturePendingMessage
  | PreviewCaptureUnavailableMessage
  | CapturePongMessage;

/**
 * The host listener's guard, since a webview can post anything. Like
 * `isHostToWebviewMessage`, a message is a non-null object carrying a string `type`.
 */
export function isWebviewToHostMessage(data: unknown): data is WebviewToHostMessage {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string';
}
