/**
 * Drift guard: `TWO_D_UI_TYPES` is a hand-maintained literal mirror of the
 * Control types in `ControlComponentRegistry` (it can't query the lazy
 * registry at module-load time — see has2DUIContent.ts). This test imports the
 * controls barrel (which side-effect-registers every Control slice) and asserts
 * the set and the registry list each other exactly, so adding or removing a
 * Control slice without updating the set fails CI instead of silently breaking
 * the "switch to 2D" hint.
 */
import { describe, it, expect } from 'vitest';
// Side-effect import: registers all Control components into the registry.
import { controlComponentRegistry } from './index';
import { TWO_D_UI_TYPES } from './has2DUIContent';

describe('has2DUIContent ↔ ControlComponentRegistry drift guard', () => {
  it('TWO_D_UI_TYPES exactly mirrors the registered Control component types', () => {
    const registered = new Set(controlComponentRegistry.getAllTypeNames());

    expect(new Set(TWO_D_UI_TYPES)).toEqual(registered);
  });
});
