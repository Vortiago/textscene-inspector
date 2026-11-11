/**
 * `<GodotEditorControls>`: Godot's 3D editor navigation, first-party so it matches
 * exactly. Middle-drag orbits, with shift pans and with ctrl zooms. The wheel zooms,
 * shift+wheel pans, right-drag freelooks and Shift+F toggles freelook. Alt+left-drag orbits and
 * alt+shift+left pans. Plain left-drag belongs to viewport selection (`useViewportSelection`),
 * as in Godot.
 */

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
// Event translation is in `useEditorNavigation.ts` and `useFreelook.ts`. Its maths:
// `godotEditorCursor.ts` (Godot's own), `pointerGesture.ts` and `pointerLock.ts` (browser facts)
// and `zoomToPointer.ts` (a departure, ADR-0029). Camera state: `EditorControlsHandle.ts`.
import { useOptionalViewportActions } from './contexts/ViewportActionsContext.js';
import { EditorControlsHandle } from './EditorControlsHandle.js';
import { Freelook } from './freelook.js';
import { useEditorNavigation } from './useEditorNavigation.js';
import { useFreelook } from './useFreelook.js';

export { EditorControlsHandle } from './EditorControlsHandle.js';

// Keys: W/A/S/D/Q/E fly during freelook (Shift is faster, Alt slower), Numpad 1/3/7 snap to
// front, right and top (Ctrl for the opposite face), Numpad 5 toggles orthographic. F belongs
// to `<FrameSelectedShortcut>`. No damping: Godot's `orbit_inertia` and `freelook_inertia`
// default to 0, and a camera that stops dead settles at once for the capture harnesses.
export function GodotEditorControls() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);

  // `get`/`set` are stable for the R3F store's lifetime, so the handle, and the focus
  // point every external framing call writes into, is created once per canvas.
  const handle = useMemo(
    () => new EditorControlsHandle(get().camera, (next) => set({ camera: next })),
    [get, set]
  );

  useEffect(() => {
    handle.setAspect(size.width / size.height);
  }, [handle, size]);

  // Publish as R3F's controls and restore the previous ones on unmount: the contract
  // `frameSceneBounds` relies on. The first `update()` aims the bare camera at the
  // focus point, which R3F's default camera does not do.
  useEffect(() => {
    const previous = get().controls;
    set({ controls: handle });
    handle.update();
    invalidate();
    return () => {
      set({ controls: previous });
    };
  }, [handle, get, set, invalidate]);

  // Touch has no Godot equivalent, so it follows the 3D-viewer convention: one finger
  // orbits, a one-finger tap selects (by distance travelled), two fingers pan and pinch
  // zooms. Alt+left is Godot's "Emulate 3 Button Mouse", always on, for trackpads.
  const freelook = useMemo(() => new Freelook(), []);
  useEditorNavigation(gl, handle, freelook, invalidate, get);
  const freelookControl = useFreelook(gl, handle, freelook, invalidate, get);

  // The toolbar is outside the `<Canvas>`, so it reaches the toggle through the viewport actions.
  const registerFreelook = useOptionalViewportActions()?.registerFreelook;
  useEffect(() => {
    return registerFreelook?.(freelookControl);
  }, [registerFreelook, freelookControl]);

  return null;
}
