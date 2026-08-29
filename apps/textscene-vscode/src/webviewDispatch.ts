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
  const handler = handlers[msg.type] as (m: WebviewToHostMessage) => void;
  handler(msg);
}
