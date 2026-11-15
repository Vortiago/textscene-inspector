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
import { CLASS_BASE_TYPES, descendsFromClass } from '../../godot/classdb/classBaseTypes';

/**
 * The Control descendants a running scene never holds. Godot registers ScrollBar, Separator and
 * Slider as abstract (`scene/register_scene_types.cpp:470, 474, 495`), and the OpenXR editors only
 * in an editor build (`modules/openxr/register_types.cpp:345-349`).
 */
const CONTROLS_NO_SCENE_HOLDS = new Set([
  'ScrollBar',
  'Separator',
  'Slider',
  'OpenXRBindingModifierEditor',
  'OpenXRInteractionProfileEditor',
  'OpenXRInteractionProfileEditorBase',
]);

describe('has2DUIContent ↔ ControlComponentRegistry drift guard', () => {
  it('TWO_D_UI_TYPES exactly mirrors the registered Control component types', () => {
    // An embedded window paints only as the root of its own canvas, and is no Control in its
    // embedder's: a container never sorts it (`container.cpp:143-146` casts to Control).
    const registered = new Set(
      controlComponentRegistry.getAllTypeNames().filter((type) => !isEmbeddedWindow(type))
    );

    expect(new Set(TWO_D_UI_TYPES)).toEqual(registered);
  });

  // The canvas item pass sorts a container's child by this set, where Godot sorts every Control
  // (`container.cpp:143-146`): a Control class missing here stays drawn on a hidden tab page.
  it('TWO_D_UI_TYPES holds every Control class a running scene can hold', () => {
    const missing = Object.keys(CLASS_BASE_TYPES).filter(
      (type) =>
        descendsFromClass(type, 'Control') && !CONTROLS_NO_SCENE_HOLDS.has(type) && !TWO_D_UI_TYPES.has(type)
    );

    expect(missing).toEqual([]);
  });
});
