/**
 * `TWO_D_UI_TYPES` is a hand-kept mirror of the registered Control types. A
 * Control slice added or removed without the set fails here, not in the
 * "switch to 2D" hint.
 */
import { describe, it, expect } from 'vitest';
import './index'; // The barrel registers every slice.
import { controlComponentRegistry } from './ControlComponentRegistry';
import { TWO_D_UI_TYPES } from './has2DUIContent';
import { isEmbeddedWindow } from '../../nodes/viewport/subviewport/viewportBoundary';

describe('has2DUIContent ↔ ControlComponentRegistry drift guard', () => {
  it('TWO_D_UI_TYPES exactly mirrors the registered Control component types', () => {
    // An embedded window paints only as the root of its own canvas, and is no Control in its
    // embedder's: a container never sorts it (`container.cpp:143-146` casts to Control).
    const registered = new Set(
      controlComponentRegistry.getAllTypeNames().filter((type) => !isEmbeddedWindow(type))
    );

    expect(new Set(TWO_D_UI_TYPES)).toEqual(registered);
  });
});
