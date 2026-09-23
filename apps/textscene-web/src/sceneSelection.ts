/**
 * Which built-in scene the app opens on, and how "none of them" is spelled.
 *
 * A leaf so both `r3f-main.tsx` and its toolbar can read the sentinel without
 * importing each other.
 */

import type { ViewportSelectorOption } from '@textscene/core';
import { fixtures } from './fixturesAll';

/** The `<ViewportSelector>` value while no fixture is active, on an uploaded .tscn. */
export const NO_FIXTURE = '';

/**
 * The first-visit default: a fixture with no `ext_resource` lines, so the first paint shows
 * a clean scene rather than missing-file warnings. The fallbacks keep the app off an
 * undefined fixture.
 */
export const DEFAULT_FIXTURE =
  fixtures.find((f) => f.file === 'unit-plane-mesh.tscn')?.file ??
  fixtures.find((f) => f.file === 'integration-all-primitives.tscn')?.file ??
  fixtures[0]?.file ??
  '';

/**
 * The scene palette's option list. On an upload the `value` is `''`, and a native `<select>`
 * shows its first `<option>` when none matches, so a placeholder names the uploaded file.
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
