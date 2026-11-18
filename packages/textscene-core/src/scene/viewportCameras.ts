import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { VariantValue } from '../godot/variant/variantValue.js';
import * as logger from '../logger.js';
import type { TreeCamera } from './sceneRuntime.js';
import { valueOfSceneValue, variant } from './variant.js';

/** `camera_3d.h:63`, `camera_2d.h:67` */
const CAMERA_3D_CURRENT_DEFAULT = false;
const CAMERA_2D_ENABLED_DEFAULT = true;

/** What the cameras read of the scene. */
export interface CameraSource {
  /** Null with no parse. */
  cameras(): readonly TreeCamera[] | null;
  /** The text of a Camera2D's `enabled`: the host's write, else the file's, else undefined. */
  enabledText(camera: TreeCamera): string | undefined;
}

/** The state `Viewport` keeps of its cameras (`viewport.h`). */
interface ViewportState {
  camera3D: string | null;
  /** `camera_3d_set`: the cameras that entered, in the order they entered. */
  readonly cameras3D: string[];
  camera2D: string | null;
}

/** A text's bool, as the setter's cast reads it. */
function boolOf(text: string | undefined, fallback: boolean): boolean {
  if (text === undefined) return fallback;
  let read: VariantValue;
  try {
    read = valueOfSceneValue(variant(text));
  } catch {
    // A text Godot cannot read leaves the property at its default, as the loader skips it.
    return fallback;
  }
  if (read.type === T.BOOL) return read.value as boolean;
  if (read.type === T.INT || read.type === T.FLOAT) return read.value !== 0;
  return fallback;
}

/** Until a call moves the state, the enter rule over the loaded tree gives it, in game order. */
export class ViewportCameras {
  /** Written only by `sync`, `reset` and the calls: each viewport's state, null for the root window. */
  private readonly viewports = new Map<string | null, ViewportState>();
  /** Written only by `sync` and `reset`: the cameras inside the tree, by live path. */
  private readonly entered = new Map<string, TreeCamera>();
  /** Written only by `sync` and `reset`: the list the state was last brought up to. */
  private seen: readonly TreeCamera[] | null = null;
  /** Written only by `moved` and `reset`: whether a call has moved the state since the text. */
  private isMoved = false;

  constructor(
    private readonly source: CameraSource,
    private readonly onMoved: (livePaths: readonly string[]) => void
  ) {}

  /** A new text frees every node, so the state fills again from the enter rule. */
  reset(): void {
    this.viewports.clear();
    this.entered.clear();
    this.seen = null;
    this.isMoved = false;
  }

  /** `Viewport::get_camera_3d`. */
  camera3D(viewport: string | null): string | null {
    this.sync();
    return this.viewports.get(viewport)?.camera3D ?? null;
  }

  /** `Viewport::get_camera_2d`. */
  camera2D(viewport: string | null): string | null {
    this.sync();
    return this.viewports.get(viewport)?.camera2D ?? null;
  }

  /** `Camera3D::make_current` (`camera_3d.cpp:352-360`). */
  makeCurrent3D(path: string): void {
    const camera = this.camera(path);
    this.moved(camera, () => (this.stateOf(camera.viewport).camera3D = path));
  }

  /** `Camera3D::clear_current`: outside the editor, `enableNext` hands over (`camera_3d.cpp:362-375`). */
  clearCurrent3D(path: string, enableNext: boolean): void {
    const camera = this.camera(path);
    const state = this.stateOf(camera.viewport);
    if (state.camera3D !== path) return;
    this.moved(camera, () => {
      state.camera3D = null;
      if (enableNext) state.camera3D = state.cameras3D.find((other) => other !== path) ?? null;
    });
  }

  /** `Camera3D::is_current` in a running game (`camera_3d.cpp:385-391`). */
  isCurrent3D(path: string): boolean {
    return this.camera3D(this.camera(path).viewport) === path;
  }

  /** `Camera2D::make_current`: a camera that is not enabled changes nothing (`camera_2d.cpp:584-586`). */
  makeCurrent2D(path: string): void {
    const camera = this.camera(path);
    if (!this.isEnabled(camera)) {
      logger.warn(`expected an enabled Camera2D for make_current, got ${path} with enabled false`);
      return;
    }
    this.moved(camera, () => (this.stateOf(camera.viewport).camera2D = path));
  }

  /** `Camera2D::is_current` (`camera_2d.cpp:609-618`). */
  isCurrent2D(path: string): boolean {
    return this.camera2D(this.camera(path).viewport) === path;
  }

  /** The hand-over of `Camera2D::set_enabled` after the write of `enabled` (`camera_2d.cpp:522-536`). */
  enabledChanged2D(path: string, isEnabled: boolean): void {
    const camera = this.camera(path);
    const state = this.stateOf(camera.viewport);
    if (isEnabled && state.camera2D === null) this.makeCurrent2D(path);
    else if (!isEnabled && state.camera2D === path) {
      this.moved(camera, () => (state.camera2D = this.nextEnabled2D(camera.viewport)));
    }
  }

  /** The camera at `path`, which the tree holds since a handle reached it. */
  private camera(path: string): TreeCamera {
    this.sync();
    const camera = this.entered.get(path);
    if (!camera) throw new Error(`expected a camera inside the tree at ${path}, found none`);
    return camera;
  }

  /** Brings the state up to the loaded tree: a camera enters or exits as the tree gains or loses it. */
  private sync(): void {
    const cameras = this.source.cameras();
    if (cameras === this.seen) return;
    if (!this.isMoved) this.reset();
    this.seen = cameras;
    const inTree = new Map((cameras ?? []).map((camera) => [camera.path, camera]));
    for (const camera of [...this.entered.values()]) {
      if (inTree.has(camera.path)) continue;
      this.entered.delete(camera.path);
      this.exit(camera);
    }
    for (const camera of inTree.values()) {
      const isEntering = !this.entered.has(camera.path);
      // The newest node of the path, whose texts the hand-over of a Camera2D reads.
      this.entered.set(camera.path, camera);
      if (isEntering) this.enter(camera);
    }
  }

  /** `NOTIFICATION_ENTER_WORLD` of a Camera3D, `NOTIFICATION_ENTER_TREE` of a Camera2D. */
  private enter(camera: TreeCamera): void {
    const state = this.stateOf(camera.viewport);
    if (camera.dimension === '2D') {
      // camera_2d.cpp:353-355
      if (state.camera2D === null && this.isEnabled(camera)) state.camera2D = camera.path;
      return;
    }
    const isCurrent = boolOf(camera.rawProperties.current, CAMERA_3D_CURRENT_DEFAULT);
    state.cameras3D.push(camera.path);
    // camera_3d.cpp:189-191
    if (isCurrent || state.cameras3D.length === 1) state.camera3D = camera.path;
  }

  /** `Viewport::_camera_3d_remove` (`viewport.cpp:4602-4607`), and a Camera2D's `NOTIFICATION_EXIT_TREE`. */
  private exit(camera: TreeCamera): void {
    const state = this.stateOf(camera.viewport);
    if (camera.dimension === '2D') {
      if (state.camera2D === camera.path) state.camera2D = this.nextEnabled2D(camera.viewport);
      return;
    }
    // `HashSet::erase` moves the last key into the hole, so the next camera changes (`hash_set.h:290-296`).
    const at = state.cameras3D.indexOf(camera.path);
    const last = state.cameras3D.pop()!;
    if (at < state.cameras3D.length) state.cameras3D[at] = last;
    if (state.camera3D === camera.path) state.camera3D = null;
  }

  /** `Viewport::assign_next_enabled_camera_2d`: the first enabled camera of the group, in tree order. */
  private nextEnabled2D(viewport: string | null): string | null {
    for (const { path } of this.seen ?? []) {
      const camera = this.entered.get(path);
      if (camera?.dimension !== '2D' || camera.viewport !== viewport) continue;
      if (this.isEnabled(camera)) return path;
    }
    return null;
  }

  /** Runs `move`, and tells the views of each camera whose `is_current` it changed. */
  private moved(camera: TreeCamera, move: () => void): void {
    this.isMoved = true;
    const state = this.stateOf(camera.viewport);
    const before = [state.camera3D, state.camera2D];
    move();
    const after = [state.camera3D, state.camera2D];
    const changed = [...before, ...after].filter(
      (path): path is string => path !== null && before.includes(path) !== after.includes(path)
    );
    if (changed.length > 0) this.onMoved([...new Set(changed)]);
  }

  private isEnabled(camera: TreeCamera): boolean {
    return boolOf(this.source.enabledText(camera), CAMERA_2D_ENABLED_DEFAULT);
  }

  private stateOf(viewport: string | null): ViewportState {
    let state = this.viewports.get(viewport);
    if (!state) this.viewports.set(viewport, (state = { camera3D: null, cameras3D: [], camera2D: null }));
    return state;
  }
}
