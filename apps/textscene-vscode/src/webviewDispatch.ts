/**
 * Routing for the webview-to-host protocol, apart from the panel so the routing
 * and its untrusted-source guards are one testable function.
 */

import { isWebviewToHostMessage, type WebviewToHostMessage } from './protocol';

/**
 * Exhaustive handler table over the webview-to-host union: a new
 * `WebviewToHostMessage` type without a handler here fails to compile.
 */
export type WebviewMessageHandlers = {
  [K in WebviewToHostMessage['type']]: (
    msg: Extract<WebviewToHostMessage, { type: K }>
  ) => void;
};

/**
 * Routes `msg` to its handler. The production `onDidReceiveMessage` listener and
 * the tests share this function.
 */
export function dispatchWebviewMessage(
  msg: unknown,
  handlers: WebviewMessageHandlers
): void {
  // The webview is an untrusted runtime source, and `onDidReceiveMessage` has
  // no catch around it: narrow the receiver first, or `postMessage(null)`
  // throws out of the listener.
  if (!isWebviewToHostMessage(msg)) {
    return;
  }
  // Then the key, by hasOwnProperty: a bare `handlers[msg.type]` resolves
  // inherited `__proto__`, `constructor` or `toString` and calls them, invoking a
  // builtin on `toString` and throwing on `__proto__`.
  if (!Object.prototype.hasOwnProperty.call(handlers, msg.type)) {
    return;
  }
  // Then the payload, which the handlers read (`args.map`, `resource.path`), so a
  // malformed body is dropped as an unknown type is. The cast: a union key narrows
  // the per-type table's parameter to `never`, and key and value share one `msg`.
  const carriesPayload = CARRIES_ITS_PAYLOAD[msg.type] as (m: unknown) => boolean;
  if (!carriesPayload(msg)) {
    return;
  }
  const handler = handlers[msg.type] as (m: WebviewToHostMessage) => void;
  handler(msg);
}

/** Fields present, and of the type the handler is about to read them as. */
const isString = (v: unknown): v is string => typeof v === 'string';

/**
 * One payload check per message type, exhaustive like {@link WebviewMessageHandlers},
 * so a type without one fails to compile. An optional field is checked only when
 * present: `jumpToNode.parent` is absent for a root node.
 */
const CARRIES_ITS_PAYLOAD: {
  [K in WebviewToHostMessage['type']]: (msg: Record<string, unknown>) => boolean;
} = {
  webviewReady: () => true,
  error: (m) => isString(m.message),
  // `path` and `parent` are both checked only when present: a legacy webview
  // sends `nodeName` alone, and the handler's documented fallback is to take the
  // first name match. `nodeName` is the one field it cannot work without.
  jumpToNode: (m) =>
    isString(m.nodeName) &&
    (m.path === undefined || isString(m.path)) &&
    (m.parent === undefined || isString(m.parent)),
  loadResource: (m) => isString(m.path) && isString(m.resourceType) && isString(m.requestId),
  resourceNeeded: (m) => typeof m.resource === 'object' && m.resource !== null,
  log: (m) => isString(m.level) && isString(m.message) && Array.isArray(m.args),
};
