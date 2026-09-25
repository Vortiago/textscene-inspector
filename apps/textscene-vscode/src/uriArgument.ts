/**
 * Narrows the argument VS Code hands a resource-scoped command. The signature says
 * `Uri`, but the runtime passes whatever the menu, keybinding or extension gave,
 * and the palette passes nothing. A caller keys a map on it, so two different
 * values must not key alike.
 */

import type * as vscode from 'vscode';

/**
 * Whether the panel bookkeeping can use `value` as a `Uri`. Structural, not
 * `instanceof`: the tests mock `vscode.Uri` as a plain object, not a constructor.
 * It requires `scheme`: the panel map keys on `toString()`, and a bare `{ fsPath }`
 * stringifies to `'[object Object]'`. A real `Uri` has one (`uri.ts` requires it).
 */
export function isUri(value: unknown): value is vscode.Uri {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { fsPath?: unknown; scheme?: unknown };
  return typeof candidate.fsPath === 'string' && typeof candidate.scheme === 'string';
}
