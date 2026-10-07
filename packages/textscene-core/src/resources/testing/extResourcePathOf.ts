/** The path an `ExtResource(…)` value names in a scope, for asserting which file's resource it resolves to. */
import { resourceRef } from '../../godot/resourceRef';
import type { SceneScope } from '../../parser/types';
import { findExtResource } from '../SubResourceResolver';

/** The path `value` resolves to in `scope`, or `undefined` for a value that names nothing there. */
export function extResourcePathOf(value: string | undefined, scope: SceneScope): string | undefined {
  const ref = value === undefined ? null : resourceRef(value);
  if (ref?.kind !== 'ExtResource') return undefined;
  return findExtResource(scope.externalResources, ref.id)?.path;
}
