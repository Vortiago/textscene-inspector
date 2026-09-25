/**
 * `TWO_D_UI_TYPES` is a hand-kept mirror of the registered Control types. A
 * Control slice added or removed without the set fails here, not in the
 * "switch to 2D" hint.
 */
import { describe, it, expect } from 'vitest';
import { controlComponentRegistry } from './index'; // The barrel registers every slice.
import { TWO_D_UI_TYPES } from './has2DUIContent';

describe('has2DUIContent ↔ ControlComponentRegistry drift guard', () => {
  it('TWO_D_UI_TYPES exactly mirrors the registered Control component types', () => {
    const registered = new Set(controlComponentRegistry.getAllTypeNames());

    expect(new Set(TWO_D_UI_TYPES)).toEqual(registered);
  });
});
