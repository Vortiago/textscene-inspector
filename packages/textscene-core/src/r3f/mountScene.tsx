import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as logger from '../logger.js';
import type { Scene } from '../scene/openScene.js';
import { encodePng } from '../utils/encodePng.js';
import { TscnCanvas, type TscnCanvasMode } from './TscnCanvas.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import { ViewStatusProvider } from './viewStatus/ViewStatusContext.js';
import { createViewStatus, type ViewSettled } from './viewStatus/viewStatus.js';

export interface ViewOptions {
  /** `in-game` by default. */
  mode?: TscnCanvasMode;
  /** `false` draws only the frames a load, a settle or a capture needs. `true` by default. */
  visible?: boolean;
}

export interface View {
  /** A new read waits again after the scene changes. Rejects once the view fails to mount or is disposed. */
  readonly settled: Promise<ViewSettled>;
  /** In-game at the window's size, 3D and 2D at the canvas's size. Rejects before `settled`. */
  captureImage(): Promise<Blob>;
  /** Changes only the keys given a value. A `settled` read from before a switch waits for the new mode. */
  update(options: ViewOptions): void;
  /** The scene stays open for another view. */
  dispose(): void;
}

const DEFAULT_OPTIONS: Required<ViewOptions> = { mode: 'in-game', visible: true };

export function mountScene(element: HTMLElement, scene: Scene, options: ViewOptions = {}): View {
  let current = withGiven(DEFAULT_OPTIONS, options);
  const status = createViewStatus();
  // Aborts with the reason the view will never settle: a failed mount, or the dispose.
  const ending = new AbortController();
  let isDisposed = false;
  const root = createRoot(element, {
    onUncaughtError(error) {
      logger.error('[View] the view failed to mount', error);
      ending.abort(new Error(`expected the view to mount, got ${String(error)}`));
    },
  });
  const render = () =>
    root.render(
      <TscnSceneProvider scene={scene}>
        <ViewStatusProvider status={status}>
          <TscnCanvas mode={current.mode} visible={current.visible} />
        </ViewStatusProvider>
      </TscnSceneProvider>
    );
  render();
  const ended = () => Promise.reject(ending.signal.reason as Error);
  return {
    get settled() {
      return status.whenSettled(ending.signal);
    },
    captureImage() {
      if (ending.signal.aborted) return ended();
      return status.captureImage().then(encodePng);
    },
    update(next) {
      if (isDisposed) throw new Error('expected a mounted view to update, got a disposed one');
      current = withGiven(current, next);
      const canvases = [...element.querySelectorAll('canvas')];
      // Synchronous, so the replaced stage has left the element before its contexts are lost.
      flushSync(render);
      canvases.filter((canvas) => !canvas.isConnected).forEach(loseContext);
    },
    dispose() {
      isDisposed = true;
      const canvases = [...element.querySelectorAll('canvas')];
      root.unmount();
      ending.abort(new Error('expected the view to settle before its dispose'));
      canvases.forEach(loseContext);
    },
  };
}

// A key set to `undefined` keeps its value, as if `given` left it out.
function withGiven(options: Required<ViewOptions>, given: ViewOptions): Required<ViewOptions> {
  return { mode: given.mode ?? options.mode, visible: given.visible ?? options.visible };
}

// A page holds few live WebGL contexts, and R3F releases its own a timer after the unmount.
function loseContext(canvas: HTMLCanvasElement): void {
  canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
}
