/**
 * Narrowing the argument VS Code hands a resource-scoped command.
 *
 * The command signatures say `Uri`, but the runtime passes whatever the
 * invoking menu, keybinding or extension supplied — the palette entry passes
 * nothing at all. Every caller that keys a map on the argument needs the
 * narrowing to be strict enough that two different values cannot key alike.
 */

import type * as vscode from 'vscode';

/**
 * Whether `value` is usable as a `Uri` by the panel bookkeeping.
 *
 * Structural, not `instanceof`: the API surface is mocked in tests as a plain
 * object namespace, so `vscode.Uri` is not a constructor to test against.
 *
 * `scheme` is required alongside `fsPath` because the panel map is keyed on
 * `toString()`. A bare `{ fsPath }` object satisfies an `fsPath`-only test and
 * then stringifies to `'[object Object]'`, so every such value collides on one
 * entry — the second preview reveals the first's panel instead of opening its
 * own. A real `Uri` always carries a scheme (`uri.ts`'s parser requires one),
 * and every mock in this package sets it.
 */
export function isUri(value: unknown): value is vscode.Uri {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { fsPath?: unknown; scheme?: unknown };
  return typeof candidate.fsPath === 'string' && typeof candidate.scheme === 'string';
}
