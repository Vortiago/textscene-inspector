import type { StageView } from '../editRect/focusSelection2D.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import { valueOfSceneValue, variantOf, type SceneValue } from '../../scene/variant.js';
import type { EditorCameraBacking } from './editorCameras.js';

/** What the camera node reads and moves of the stage. */
export interface Camera2DStage {
  size(): { width: number; height: number };
  /** The view as of now, ahead of the re-render. */
  view(): StageView;
  moveView(next: StageView): void;
  clampZoom(zoom: number): number;
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
    return { zoom, pan: { x: width / 2 - point.x * zoom, y: height / 2 - point.y * zoom } };
  };
  return {
    get(property) {
      if (property === 'position') return vector2(centre());
      if (property === 'zoom') return vector2({ x: stage.view().zoom, y: stage.view().zoom });
      return null;
    },
    set(property, value) {
      const given = vector2Of(value);
      if (!given) return false;
      if (property === 'position') {
        stage.moveView(centredAt(given, stage.view().zoom));
        return true;
      }
      // The stage draws one magnification for both axes.
      if (property !== 'zoom' || given.x !== given.y || !(given.x > 0)) return false;
      stage.moveView(centredAt(centre(), stage.clampZoom(given.x)));
      return true;
    },
    call(method) {
      throw new Error(`expected a method of the 2D editor camera, got ${method}`);
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
