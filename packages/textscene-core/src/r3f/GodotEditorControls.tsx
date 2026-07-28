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
 * The component itself only translates events into cursor edits — all the
 * navigation maths lives in `godotEditorCursor.ts`, and all the camera
 * bookkeeping in `EditorControlsHandle` below.
 */
import { useFrame, useThree, type Camera as R3FCamera } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { isTypingTarget } from './hooks/isTypingTarget.js';
import { editorCameraPosition } from './godotEditorCamera.js';
import {
  cursorCameraPosition,
  cursorFromCamera,
  cursorQuaternion,
  dollyCursor,
  freelookCursor,
  freelookMoveCursor,
  orbitCursor,
  orthographicHeight,
  panCursor,
  resolveNavMode,
  resolveWheelMode,
  scaleCursorDistance,
  viewSnapCursor,
  wheelDeltaPixels,
  wheelZoomScale,
  OPPOSITE_VIEW,
  type EditorCursor,
  type FreelookKeys,
  type GodotViewAngle,
  type ZoomRange,
} from './godotEditorCursor.js';
import {
  pinchSpanRatio,
  resolveTouchMode,
  touchCentroid,
  touchSpan,
  type TouchPoint,
} from './pointerGesture.js';

/** Numpad view snaps. Ctrl inverts each to the opposite face. */
const VIEW_SNAP_KEYS: Readonly<Record<string, GodotViewAngle>> = {
  Numpad1: 'front',
  Numpad3: 'right',
  Numpad7: 'top',
};

/** `event.code` → which freelook direction it drives. */
const FREELOOK_KEYS: Readonly<Record<string, keyof FreelookKeys>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'down',
  KeyE: 'up',
};

/** Eye-on-focus-point: no view direction to derive, so orientation is left as-is. */
const DEGENERATE_DISTANCE = 1e-6;

/**
 * three's own duck-typing flag rather than `instanceof`: a host app (or a test
 * runner) that ends up with two copies of three in the module graph still gets
 * the right answer, and the flag is what three itself checks internally.
 */
function isPerspectiveCamera(camera: R3FCamera): camera is THREE.PerspectiveCamera {
  return 'isPerspectiveCamera' in camera && camera.isPerspectiveCamera;
}

/**
 * Owns the camera side of navigation: the orbit focus point, which camera is
 * being driven, and the perspective/orthographic pair.
 *
 * It is also the object `<TscnCanvas>` publishes as R3F's `state.controls`,
 * which is how `frameSceneBounds` (F-to-frame, load-time auto-fit) re-points
 * the viewport: it writes `controls.target` and `camera.position` from the
 * outside and calls `update()`. Nothing here caches a pose across calls —
 * every gesture re-derives the cursor from the live camera — so an external
 * write is picked up rather than overwritten on the next drag.
 *
 * Extends `THREE.EventDispatcher` only because that is the type R3F's
 * `state.controls` slot takes.
 */
export class EditorControlsHandle extends THREE.EventDispatcher {
  /** The orbit focus point. One persistent vector: `frameSceneBounds` copies into it. */
  readonly target = new THREE.Vector3();

  /** The camera being driven — R3F's active one, which may be an authored Camera3D. */
  camera: R3FCamera;

  private readonly perspectiveCamera: THREE.PerspectiveCamera | null;
  private orthographicCamera: THREE.OrthographicCamera | null = null;
  private aspect = 1;

  constructor(
    camera: R3FCamera,
    /** Publishes a projection swap to R3F, which is what actually renders it. */
    private readonly setActiveCamera: (camera: R3FCamera) => void
  ) {
    super();
    this.camera = camera;
    this.perspectiveCamera = isPerspectiveCamera(camera) ? camera : null;
  }

  /** Follow R3F's active camera (the user can switch to an authored Camera3D). */
  setCamera(camera: R3FCamera): void {
    this.camera = camera;
  }

  setAspect(aspect: number): void {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    this.aspect = aspect;
    this.applyProjection(this.cursor());
  }

  /** The live cursor, always re-derived from the camera and the focus point. */
  cursor(): EditorCursor {
    return cursorFromCamera(this.camera.position, this.target);
  }

  /** The zoom range Godot derives from the camera's clip planes. */
  zoomRange(): ZoomRange {
    return { near: this.camera.near, far: this.camera.far };
  }

  /** Move the camera to a cursor — the only place a gesture's result lands. */
  applyCursor(cursor: EditorCursor): void {
    this.target.copy(cursor.target);
    if (cursor.distance > DEGENERATE_DISTANCE) {
      this.camera.position.copy(cursorCameraPosition(cursor));
      this.camera.quaternion.copy(cursorQuaternion(cursor));
    }
    this.applyProjection(cursor);
    this.camera.updateMatrixWorld();
  }

  /**
   * R3F's controls contract, and the second half of `frameSceneBounds`: point
   * the camera at the (possibly just-rewritten) target. Re-orients ONLY — an
   * `update()` that also repositioned would undo the framing that just wrote
   * `camera.position`.
   */
  update(): void {
    const cursor = this.cursor();
    if (cursor.distance > DEGENERATE_DISTANCE) {
      this.camera.quaternion.copy(cursorQuaternion(cursor));
    }
    this.applyProjection(cursor);
    this.camera.updateMatrixWorld();
  }

  /** Back to the pose Godot's editor opens every scene at, in perspective. */
  reset(): void {
    this.usePerspective();
    this.target.set(0, 0, 0);
    this.camera.position.set(...editorCameraPosition());
    this.update();
  }

  get isOrthographic(): boolean {
    return this.camera === this.orthographicCamera;
  }

  /**
   * Numpad 5. Only meaningful while this component's own camera is the active
   * one: with an authored Camera3D in use, the projection is that node's
   * property and not ours to swap.
   */
  toggleProjection(): void {
    if (this.isOrthographic) {
      this.usePerspective();
    } else if (this.perspectiveCamera && this.camera === this.perspectiveCamera) {
      this.useOrthographic();
    }
  }

  private usePerspective(): void {
    if (!this.perspectiveCamera || this.camera === this.perspectiveCamera) return;
    const cursor = this.cursor();
    this.camera = this.perspectiveCamera;
    this.setActiveCamera(this.perspectiveCamera);
    this.applyCursor(cursor);
  }

  private useOrthographic(): void {
    const perspective = this.perspectiveCamera;
    if (!perspective) return;
    const cursor = this.cursor();
    if (!this.orthographicCamera) {
      // R3F resizes an orthographic camera into PIXEL units unless the camera
      // claims its own projection; Godot's ortho frustum is world-sized and
      // derived from the orbit radius, so `manual` opts out of that.
      const ortho: R3FCamera = new THREE.OrthographicCamera(-1, 1, 1, -1);
      ortho.manual = true;
      this.orthographicCamera = ortho;
    }
    this.orthographicCamera.near = perspective.near;
    this.orthographicCamera.far = perspective.far;
    this.camera = this.orthographicCamera;
    this.setActiveCamera(this.orthographicCamera);
    this.applyCursor(cursor);
  }

  /**
   * Orthographic has no perspective divide, so pulling the eye back changes
   * nothing on screen; Godot keeps zoom working by sizing the frustum to what
   * the perspective camera would see AT the focus point.
   */
  private applyProjection(cursor: EditorCursor): void {
    const ortho = this.orthographicCamera;
    if (!ortho || this.camera !== ortho || !this.perspectiveCamera) return;
    const height = orthographicHeight(cursor.distance, this.perspectiveCamera.fov);
    const width = height * this.aspect;
    ortho.left = -width / 2;
    ortho.right = width / 2;
    ortho.top = height / 2;
    ortho.bottom = -height / 2;
    ortho.updateProjectionMatrix();
  }
}

interface DragState {
  pointerId: number;
  button: number;
  x: number;
  y: number;
}

/** Where the fingers were on the previous move — a touch gesture's origin. */
interface TouchGesture {
  centroid: TouchPoint;
  span: number;
}

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

  const dragRef = useRef<DragState | null>(null);
  // Every touch pointer currently down, in the order it landed — a pinch needs
  // two at once, which a single drag slot cannot hold.
  const touchPointsRef = useRef<Map<number, TouchPoint>>(new Map());
  const touchGestureRef = useRef<TouchGesture | null>(null);
  const freelookRef = useRef(false);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const sprintRef = useRef(false);

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

  useEffect(() => {
    const element = gl.domElement;
    // Captured once: the Map itself never changes identity, and the cleanup
    // must clear the same one the handlers filled rather than whatever
    // `.current` happens to hold by then.
    const touchPoints = touchPointsRef.current;

    /**
     * The invariant every touch path maintains: no fingers, no gesture origin.
     * A stale origin is what would make the next single-finger drag pan from
     * wherever a two-finger gesture happened to end.
     */
    function resetTouch(): void {
      touchPoints.clear();
      touchGestureRef.current = null;
    }

    function endDrag(): void {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      freelookRef.current = false;
      heldKeysRef.current.clear();
      sprintRef.current = false;
      if (element.hasPointerCapture?.(drag.pointerId)) {
        element.releasePointerCapture(drag.pointerId);
      }
    }

    function endPointer(event: PointerEvent): void {
      if (event.pointerType === 'touch') {
        touchPoints.delete(event.pointerId);
        // Lifting one of two fingers leaves the other mid-gesture; re-seed so
        // the survivor orbits from where it is rather than from the centroid.
        touchGestureRef.current = null;
        return;
      }
      endDrag();
    }

    function handlePointerDown(event: PointerEvent): void {
      if (event.pointerType === 'touch') {
        // Touch pointers are implicitly captured to the target, so no explicit
        // capture — and no preventDefault, which would cost tap-to-select the
        // pointerup R3F picks it out of. `touch-action: none` on the canvas is
        // what stops the browser scrolling instead.
        touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
        // A finger landing or leaving changes the centroid and the span
        // discontinuously; dropping the origin re-seeds both on the next move
        // so the view doesn't jump.
        touchGestureRef.current = null;
        return;
      }
      if (dragRef.current) return;
      const mode = resolveNavMode(event.button, event);
      if (!mode) return;
      // Middle-click otherwise opens the platform's auto-scroll widget, which
      // eats every subsequent motion event.
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
      };
      freelookRef.current = mode === 'freelook';
      element.setPointerCapture?.(event.pointerId);
    }

    function handleTouchMove(event: PointerEvent): void {
      if (!touchPoints.has(event.pointerId)) return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const active = [...touchPoints.values()];
      const mode = resolveTouchMode(active.length);
      if (!mode) {
        touchGestureRef.current = null;
        return;
      }

      const gesture: TouchGesture = { centroid: touchCentroid(active), span: touchSpan(active) };
      const previous = touchGestureRef.current;
      touchGestureRef.current = gesture;
      // The first move of a gesture only establishes where it started from.
      if (!previous) return;

      const dx = gesture.centroid.x - previous.centroid.x;
      const dy = gesture.centroid.y - previous.centroid.y;
      if (mode === 'orbit') {
        handle.applyCursor(orbitCursor(handle.cursor(), dx, dy));
      } else {
        // Two fingers pan and pinch at once, exactly as they do on a map: the
        // centroid drives the pan, the span between them drives the zoom.
        const panned = panCursor(handle.cursor(), dx, dy);
        // Inverted: spreading the fingers pulls the eye IN, so the orbit
        // radius scales by the reciprocal of how far they spread.
        const zoom = 1 / pinchSpanRatio(previous.span, gesture.span);
        handle.applyCursor(scaleCursorDistance(panned, zoom, handle.zoomRange()));
      }
      invalidate();
    }

    function handlePointerMove(event: PointerEvent): void {
      if (event.pointerType === 'touch') {
        handleTouchMove(event);
        return;
      }
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (dx === 0 && dy === 0) return;

      const mode = resolveNavMode(drag.button, event);
      // A released modifier (alt on an alt+left drag) suspends navigation
      // without ending the drag — Godot behaves the same way.
      if (!mode) return;
      freelookRef.current = mode === 'freelook';

      const cursor = handle.cursor();
      if (mode === 'orbit') handle.applyCursor(orbitCursor(cursor, dx, dy));
      else if (mode === 'pan') handle.applyCursor(panCursor(cursor, dx, dy));
      else if (mode === 'zoom') handle.applyCursor(dollyCursor(cursor, dy, handle.zoomRange()));
      else handle.applyCursor(freelookCursor(cursor, dx, dy));
      invalidate();
    }

    function handleWheel(event: WheelEvent): void {
      event.preventDefault();
      if (resolveWheelMode(event) === 'pan') {
        // Godot pans by the NEGATED gesture delta, and the delta has to be
        // normalised first: one notch is 100px in Chrome but 3 lines in
        // Firefox, so raw deltas would pan 33x further in one than the other.
        const { dx, dy } = wheelDeltaPixels(event);
        if (dx === 0 && dy === 0) return;
        handle.applyCursor(panCursor(handle.cursor(), -dx, -dy));
        invalidate();
        return;
      }
      const scale = wheelZoomScale(event);
      if (scale === 1) return;
      handle.applyCursor(scaleCursorDistance(handle.cursor(), scale, handle.zoomRange()));
      invalidate();
    }

    function handleContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;

      // Read the sprint modifier off the event rather than tracking its own
      // keydown: Shift held BEFORE freelook started never fires one.
      sprintRef.current = event.shiftKey;
      if (freelookRef.current) {
        if (FREELOOK_KEYS[event.code]) {
          heldKeysRef.current.add(event.code);
          event.preventDefault();
          return;
        }
      }

      const view = VIEW_SNAP_KEYS[event.code];
      if (view) {
        // Without NumLock the numpad emits End/PageUp/…, which scroll the page.
        event.preventDefault();
        handle.applyCursor(
          viewSnapCursor(handle.cursor(), event.ctrlKey ? OPPOSITE_VIEW[view] : view)
        );
        invalidate();
        return;
      }
      if (event.code === 'Numpad5') {
        event.preventDefault();
        handle.toggleProjection();
        invalidate();
      }
    }

    function handleKeyUp(event: KeyboardEvent): void {
      sprintRef.current = event.shiftKey;
      heldKeysRef.current.delete(event.code);
    }

    function handleBlur(): void {
      heldKeysRef.current.clear();
      sprintRef.current = false;
      resetTouch();
    }

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', endPointer);
    element.addEventListener('pointercancel', endPointer);
    element.addEventListener('lostpointercapture', endPointer);
    element.addEventListener('contextmenu', handleContextMenu);
    // Not passive: a zoom must not also scroll the page behind the canvas.
    element.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', endPointer);
      element.removeEventListener('pointercancel', endPointer);
      element.removeEventListener('lostpointercapture', endPointer);
      element.removeEventListener('contextmenu', handleContextMenu);
      element.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      endDrag();
      resetTouch();
    };
  }, [gl, handle, invalidate]);

  // Freelook flight is continuous while the keys are held, so it advances per
  // frame with the frame's own delta rather than per keydown repeat.
  useFrame((_, delta) => {
    if (!freelookRef.current || heldKeysRef.current.size === 0) return;
    const keys: FreelookKeys = { sprint: sprintRef.current };
    for (const code of heldKeysRef.current) {
      const direction = FREELOOK_KEYS[code];
      if (direction) keys[direction] = true;
    }
    handle.applyCursor(freelookMoveCursor(handle.cursor(), keys, delta));
  });

  return null;
}
