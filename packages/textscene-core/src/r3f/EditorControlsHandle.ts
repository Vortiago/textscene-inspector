/**
 * The camera side of Godot-editor viewport navigation, separated from the
 * gesture translation in `GodotEditorControls.tsx`: this holds the pose, the
 * gestures only edit it.
 */

import type { Camera as R3FCamera } from '@react-three/fiber';
import * as THREE from 'three';
import { editorCameraPosition, EDITOR_CAMERA_FOV } from './godotEditorCamera.js';
import {
  cursorCameraPosition,
  cursorFromCamera,
  cursorQuaternion,
  orthographicHeight,
  DEGENERATE_DISTANCE,
  type EditorCursor,
  type ZoomRange,
} from './godotEditorCursor.js';

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

  /**
   * The vertical fov the visible frustum is derived from.
   *
   * Re-derived from the ACTIVE camera, like `cursor()` and `zoomRange()` — an
   * authored Camera3D becomes R3F's camera and carries its own fov (Godot
   * defaults to 75, this editor camera to 70), and anchoring zoom-to-pointer
   * against the wrong one drifts the subject off the cursor by the ratio of
   * their half-angle tangents. Falls back to this component's own camera for
   * orthographic, whose frustum `orthographicHeight` sizes from that fov.
   */
  fovDegrees(): number {
    if (isPerspectiveCamera(this.camera)) return this.camera.fov;
    return this.perspectiveCamera?.fov ?? EDITOR_CAMERA_FOV;
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
