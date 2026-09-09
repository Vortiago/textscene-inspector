/**
 * Routing for the webview-to-host protocol.
 *
 * Kept apart from the panel so the routing rule — and the untrusted-source
 * guards below — are one testable function rather than a branch of a class.
 */

import { isWebviewToHostMessage, type WebviewToHostMessage } from './protocol';

/**
 * Exhaustive handler table over the webview-to-host protocol union.
 * Adding a new message type to `WebviewToHostMessage` without adding a handler
 * here is a compile error — the mapped type guarantees coverage.
 */
export type WebviewMessageHandlers = {
  [K in WebviewToHostMessage['type']]: (
    msg: Extract<WebviewToHostMessage, { type: K }>
  ) => void;
};

/**
 * Route `msg` to the corresponding handler in `handlers`.
 * Both the production `onDidReceiveMessage` listener and tests go through
 * this function, so the two paths cannot drift.
 */
export function dispatchWebviewMessage(
  msg: unknown,
  handlers: WebviewMessageHandlers
): void {
  // The webview is an untrusted runtime source, and `onDidReceiveMessage` has
  // no catch around it: narrow the RECEIVER first, or `postMessage(null)`
  // throws out of the listener.
  if (!isWebviewToHostMessage(msg)) {
    return;
  }
  // Then the KEY: a `type` outside the protocol union — including inherited
  // names like `__proto__`, `constructor` or `toString` — has no OWN entry in
  // the handler table. Gate on hasOwnProperty rather than a truthy lookup: a
  // bare `handlers[msg.type]` resolves those inherited members and calls them,
  // invoking a builtin on `toString` and throwing on `__proto__`.
  if (!Object.prototype.hasOwnProperty.call(handlers, msg.type)) {
    return;
  }
  // Then the PAYLOAD. A `type` the union knows says nothing about the fields
  // beside it, and the handlers read those: `relayWebviewLog` calls `args.map`
  // and `relayMissingResource` reads `resource.path`, so a well-typed message
  // with a missing or wrong-typed body threw out of a listener with no catch
  // around it. The webview is an untrusted runtime source; a malformed body is
  // dropped exactly as an unknown type is.
  // Cast for the same reason the handler lookup below casts: indexing the
  // per-type table with a union key narrows the parameter to `never`. The key
  // and the value come from the same `msg`, so the pairing is sound.
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
 * One payload check per message type, exhaustive over the union the same way
 * {@link WebviewMessageHandlers} is: adding a type without declaring what its
 * body must carry is a compile error, not a gap.
 *
 * Optional fields are checked only when present — `jumpToNode.parent` is absent
 * for a root node, which is a legal message and not a malformed one.
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
