import type { Scene } from '../../scene/openScene.js';
import { encodePng } from '../../utils/encodePng.js';
import { assertLoadedCamera } from '../viewCamera.js';
import type { ViewSettled, ViewStatus, ViewStatusStore } from './viewStatus.js';
import type { EditorCameras, EditorViewAnswers } from '../editorCamera/editorCameras.js';
import type { ViewportMode } from '../contexts/ViewportModeContext.js';

/** What a view answers of its frames, in every mode: `mountScene` and a `TscnCanvas` ref give it. */
export interface ViewAnswers {
  /** Waits again after a scene change. Rejects once the view ends, or for a path to no Camera3D. */
  readonly settled: Promise<ViewSettled>;
  /** In-game at the window's size, 3D and 2D at the canvas's size. Rejects before `settled`. */
  captureImage(): Promise<Blob>;
  /** What the view reports of itself now. `onStatusChange` tells of each change but the frame numbers. */
  status(): ViewStatus;
}

/** The view's state that `settled` checks once the loads end. */
interface AnsweringView {
  scene: Scene;
  store: ViewStatusStore;
  /** Aborts with the reason the view will never settle. */
  ending: AbortSignal;
  /** The Camera3D the 3D mode looks through now, or null. */
  lookedThrough(): string | null;
  cameras: EditorCameras;
  /** The mode the view draws in now. */
  mode(): ViewportMode;
}

export function viewAnswers({
  scene,
  store,
  ending,
  lookedThrough,
  cameras,
  mode,
}: AnsweringView): ViewAnswers & EditorViewAnswers {
  const ended = () => Promise.reject(ending.reason as Error);
  return {
    get settled() {
      if (ending.aborted) return ended();
      return store.whenSettled(ending).then((settled) => {
        const camera = lookedThrough();
        if (camera !== null) assertLoadedCamera(scene, camera);
        return settled;
      });
    },
    captureImage() {
      if (ending.aborted) return ended();
      return store.captureImage().then(encodePng);
    },
    status: store.status,
    get editorCamera() {
      return cameras.of(mode());
    },
  };
}
