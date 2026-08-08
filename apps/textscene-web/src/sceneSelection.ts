/**
 * Which built-in scene the app opens on, and how "none of them" is spelled.
 *
 * A leaf so both `r3f-main.tsx` and its toolbar can read the sentinel without
 * importing each other.
 */

import type { ViewportSelectorOption } from '@textscene/core';
import { fixtures } from './fixturesAll';

/** Sentinel value used by `<ViewportSelector>` when no fixture is active (user is on an uploaded .tscn). */
export const NO_FIXTURE = '';

/**
 * First-visit default. Pick a fixture with zero `ext_resource`
 * lines so a new visitor's first paint shows a clean scene, not a wall
 * of missing-file warnings. `unit-plane-mesh.tscn` is the canonical
 * "hello world" of the app: single PlaneMesh, no externals, parses
 * instantly. Falls back to `integration-all-primitives.tscn` (the
 * previous default) and then `fixtures[0]` so the app never lands on
 * an undefined fixture.
 */
export const DEFAULT_FIXTURE =
  fixtures.find((f) => f.file === 'unit-plane-mesh.tscn')?.file ??
  fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
  fixtures[0]?.file ??
  '';

/**
 * The scene palette's option list. When the user is on an uploaded TSCN the
 * dropdown's `value` is `''`, but a native `<select>` falls back to the first
 * `<option>` visually if no option matches — so a placeholder is injected to
 * keep the dropdown in an explicit "(Uploaded file)" state.
 */
export function fixtureOptions(uploadedTscnName: string | null): ViewportSelectorOption[] {
  const options: ViewportSelectorOption[] = fixtures.map((f) => ({
    value: f.file,
    label: f.name,
    category: f.category,
  }));
  if (uploadedTscnName) {
    return [{ value: NO_FIXTURE, label: `(Uploaded: ${uploadedTscnName})` }, ...options];
  }
  return options;
}
