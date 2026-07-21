/**
 * `<GodotEditorControls>` — the viewport navigation of Godot's 3D editor,
 * first-party so it can match the editor exactly rather than approximately.
 *
 * Mouse (Godot's default navigation scheme):
 *   middle-drag             orbit the focus point
 *   shift + middle-drag     pan
 *   ctrl + middle-drag      zoom
 *   wheel                   zoom
 *   right-drag              freelook — the eye rotates in place
 *   alt + left-drag         orbit, alt + shift + left-drag pan
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
 * navigation maths lives in `godotEditorControls.ts`, and all the camera
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
  scaleCursorDistance,
  viewSnapCursor,
  wheelZoomScale,
  OPPOSITE_VIEW,
  type EditorCursor,
  type FreelookKeys,
  type GodotViewAngle,
  type ZoomRange,
} from './godotEditorControls.js';

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

    function handlePointerDown(event: PointerEvent): void {
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

    function handlePointerMove(event: PointerEvent): void {
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

      if (freelookRef.current) {
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintRef.current = true;
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
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sprintRef.current = false;
      heldKeysRef.current.delete(event.code);
    }

    function handleBlur(): void {
      heldKeysRef.current.clear();
      sprintRef.current = false;
    }

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', endDrag);
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener('lostpointercapture', endDrag);
    element.addEventListener('contextmenu', handleContextMenu);
    // Not passive: a zoom must not also scroll the page behind the canvas.
    element.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', endDrag);
      element.removeEventListener('pointercancel', endDrag);
      element.removeEventListener('lostpointercapture', endDrag);
      element.removeEventListener('contextmenu', handleContextMenu);
      element.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      endDrag();
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
