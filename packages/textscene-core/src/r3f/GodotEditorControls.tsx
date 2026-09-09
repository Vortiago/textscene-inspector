/**
 * `<GodotEditorControls>` — the viewport navigation of Godot's 3D editor,
 * first-party so it can match the editor exactly rather than approximately.
 *
 * Mouse (Godot's default navigation scheme):
 *   middle-drag             orbit the focus point
 *   shift + middle-drag     pan
 *   ctrl + middle-drag      zoom
 *   wheel                   zoom
 *   shift + wheel           pan
 *   right-drag              freelook — the eye rotates in place
 *   alt + left-drag         orbit, alt + shift + left-drag pan
 *
 * Touch (no Godot equivalent — the 3D-viewer convention instead):
 *   one-finger drag         orbit; a one-finger TAP selects, which viewport
 *                           selection discriminates by distance travelled
 *   two-finger drag         pan, with pinch zooming on the same two pointers
 *
 * The alt+left bindings are Godot's "Emulate 3 Button Mouse" made
 * unconditional, so a trackpad without a middle button can still navigate.
 * Plain left-drag is deliberately inert: it belongs to viewport selection
 * (`useViewportSelection`), exactly as it does in Godot.
 *
 * Keyboard: W/A/S/D/Q/E fly while right-drag freelook is held (Shift
 * sprints); Numpad 1/3/7 snap to the front/right/top face and Ctrl+Numpad to
 * the opposite one; Numpad 5 toggles perspective/orthographic. F is NOT bound
 * here — `<FrameSelectedShortcut>` owns it.
 *
 * There is no damping: Godot's editor camera stops dead on release (its
 * `orbit_inertia` default is 0), and a viewport that never coasts also settles
 * instantly for the visual-regression and Godot-parity capture harnesses.
 *
 * The component itself only wires the handle into R3F. Event translation is in
 * `useEditorNavigation.ts`, and the maths it calls lives in three modules split
 * by provenance: `godotEditorCursor.ts` is Godot's own, `pointerGesture.ts` is
 * browser facts Godot has no analogue for (fingers, `deltaMode`), and
 * `zoomToPointer.ts` is the one deliberate departure (ADR-0029). Camera
 * bookkeeping is in `EditorControlsHandle.ts`.
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { EditorControlsHandle } from './EditorControlsHandle.js';
import { useEditorNavigation } from './useEditorNavigation.js';

export { EditorControlsHandle } from './EditorControlsHandle.js';

export function GodotEditorControls() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);

  // `get`/`set` are stable for the lifetime of the R3F store, so the handle —
  // and with it the focus point every external framing call writes into — is
  // created exactly once per canvas.
  const handle = useMemo(
    () => new EditorControlsHandle(get().camera, (next) => set({ camera: next })),
    [get, set]
  );

  useEffect(() => {
    handle.setCamera(camera);
  }, [handle, camera]);

  useEffect(() => {
    handle.setAspect(size.width / size.height);
  }, [handle, size]);

  // Publish as R3F's controls, restoring whatever was there on unmount — this
  // is the whole contract `frameSceneBounds` consumers rely on. The initial
  // `update()` aims the bare camera at the focus point, which R3F's own
  // default camera does not do.
  useEffect(() => {
    const previous = get().controls;
    set({ controls: handle });
    handle.update();
    invalidate();
    return () => {
      set({ controls: previous });
    };
  }, [handle, get, set, invalidate]);

  useEditorNavigation(gl, handle, invalidate, get);

  return null;
}
