import type { Scene } from '../../scene/openScene.js';
import { encodePng } from '../../utils/encodePng.js';
import { assertLoadedCamera } from '../viewCamera.js';
import type { ViewSettled, ViewStatus } from './viewStatus.js';

/** What a view answers of its frames, in every mode: `mountScene` and a `TscnCanvas` ref give it. */
export interface ViewAnswers {
  /** Waits again after a scene change. Rejects once the view ends, or for a path to no Camera3D. */
  readonly settled: Promise<ViewSettled>;
  /** In-game at the window's size, 3D and 2D at the canvas's size. Rejects before `settled`. */
  captureImage(): Promise<Blob>;
}

/** The view's state that `settled` checks once the loads end. */
interface AnsweringView {
  scene: Scene;
  status: ViewStatus;
  /** Aborts with the reason the view will never settle. */
  ending: AbortSignal;
  /** The Camera3D the 3D mode looks through now, or null. */
  lookedThrough(): string | null;
}

export function viewAnswers({ scene, status, ending, lookedThrough }: AnsweringView): ViewAnswers {
  const ended = () => Promise.reject(ending.reason as Error);
  return {
    get settled() {
      if (ending.aborted) return ended();
      return status.whenSettled(ending).then((settled) => {
        const camera = lookedThrough();
        if (camera !== null) assertLoadedCamera(scene, camera);
        return settled;
      });
    },
    captureImage() {
      if (ending.aborted) return ended();
      return status.captureImage().then(encodePng);
    },
  };
}
