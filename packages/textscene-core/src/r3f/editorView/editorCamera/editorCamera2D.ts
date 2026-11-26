import { centerSelection, frameSelection } from '../Canvas2DStage/selectionFrame2D.js';
import type { StageView } from '../../world2D/stageView.js';
import { ZERO_RECT, type Rect2 } from '../../../godot/math/rect2.js';
import { VARIANT_TYPE as T } from '../../../godot/variant/variantType.js';
import { liveNodePathOf } from '../../../scene/nodePathWalk.js';
import { valueOfSceneValue, variantOf, type SceneValue } from '../../../scene/variant.js';
import type { EditorCameraBacking } from './editorCameras.js';

/** The canvas point at the centre of a Camera2D's view, and its magnification. */
export interface CameraView2D {
  readonly centre: { x: number; y: number };
  readonly zoom: number;
}

/** What the camera node reads and moves of the stage. */
export interface Camera2DStage {
  size(): { width: number; height: number };
  /** The view as of now, ahead of the re-render. */
  view(): StageView;
  moveView(next: StageView): void;
  /** Leaves the scene's load time open, so a late project size still fits the view. */
  restoreView(view: StageView): void;
  clampZoom(zoom: number): number;
  /** The selection rect of a node by its live path, or null while the stage cannot place it. */
  rectOf(livePath: string): Rect2 | null;
  /** What the Camera2D at a live path shows on the project's screen, or null for another node. */
  cameraViewOf(livePath: string): Promise<CameraView2D | null>;
  /** The view the stage opens a scene at. */
  reset(): void;
  scenePath(): string;
}

/** `position` is the canvas point at the stage's centre, as a centred Camera2D's is (camera_2d.cpp:162). */
export function editorCamera2D(stage: Camera2DStage): EditorCameraBacking {
  const centre = () => {
    const { pan, zoom } = stage.view();
    const { width, height } = stage.size();
    return { x: (width / 2 - pan.x) / zoom, y: (height / 2 - pan.y) / zoom };
  };
  const centredAt = (point: { x: number; y: number }, zoom: number): StageView => {
    const { width, height } = stage.size();
    // A stage with no area has no centre: a pan from it lands off the view once the stage lays out.
    if (width <= 0 || height <= 0) {
      throw new Error(`expected a laid-out 2D stage to centre the camera, got ${width}x${height}`);
    }
    return { zoom, pan: { x: width / 2 - point.x * zoom, y: height / 2 - point.y * zoom } };
  };
  // Nothing selected centres on the origin (canvas_item_editor_plugin.cpp:5165-5167).
  const rectOf = (node: SceneValue | undefined): Rect2 => {
    if (node === undefined) return ZERO_RECT;
    const livePath = typeof node === 'string' ? liveNodePathOf(node) : null;
    if (livePath === null)
      throw new Error(`expected the absolute path of a node to focus, got ${String(node)}`);
    return stage.rectOf(livePath) ?? ZERO_RECT;
  };
  // Godot's F frames a Camera2D's origin, as it has no edit rect (canvas_item.h:258-259): another act.
  const cameraViewOf = async (camera: SceneValue | undefined): Promise<CameraView2D> => {
    const livePath = typeof camera === 'string' ? liveNodePathOf(camera) : null;
    const view = livePath === null ? null : await stage.cameraViewOf(livePath);
    if (!view) throw new Error(`expected the absolute path of a Camera2D to frame, got ${String(camera)}`);
    return view;
  };
  return {
    get(property) {
      if (property === 'position') return vector2(centre());
      if (property !== 'zoom') return null;
      const { zoom } = stage.view();
      return vector2({ x: zoom, y: zoom });
    },
    set(property, value) {
      const given = vector2Of(value);
      if (!given) return false;
      if (property === 'position') {
        stage.moveView(centredAt(given, stage.view().zoom));
        return true;
      }
      // One zoom for both axes, as the 2D editor's (canvas_item_editor_plugin.h:228).
      if (property !== 'zoom' || given.x !== given.y || !(given.x > 0)) return false;
      stage.moveView(centredAt(centre(), stage.clampZoom(given.x)));
      return true;
    },
    call(method, args) {
      if (method === 'reset') stage.reset();
      else if (method === 'focus') {
        stage.moveView(frameSelection(stage.view(), rectOf(args[0]), stage.size(), stage.clampZoom));
      } else if (method === 'center') {
        stage.moveView(centerSelection(stage.view(), rectOf(args[0]), stage.size()));
      } else if (method === 'frame_camera_view') {
        return cameraViewOf(args[0]).then(({ centre, zoom }) => {
          // The stage draws one zoom above 0, as a `set` of `zoom` keeps it.
          if (!(zoom > 0)) throw new Error(`expected a Camera2D zoom above 0 to frame, got ${zoom}`);
          stage.moveView(centredAt(centre, stage.clampZoom(zoom)));
          return null;
        });
      } else {
        throw new Error(
          `expected a method of the 2D editor camera (reset, focus, center, frame_camera_view), got ${method}`
        );
      }
      return null;
    },
    pose: () => stage.view(),
    scene: stage.scenePath,
    setPose(pose) {
      stage.restoreView(pose as StageView);
    },
  };
}

function vector2({ x, y }: { x: number; y: number }): SceneValue {
  return variantOf({ type: T.VECTOR2, value: [x, y] });
}

function vector2Of(value: SceneValue): { x: number; y: number } | null {
  const read = valueOfSceneValue(value);
  if (read.type !== T.VECTOR2) return null;
  const [x, y] = read.value as readonly number[];
  return { x: x!, y: y! };
}
