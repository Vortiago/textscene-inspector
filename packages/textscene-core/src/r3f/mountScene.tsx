import { createRoot } from 'react-dom/client';
import * as logger from '../logger.js';
import type { Scene } from '../scene/openScene.js';
import { encodePng } from '../utils/encodePng.js';
import { TscnCanvas, type TscnCanvasMode } from './TscnCanvas.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import { GameViewStatusProvider } from './gameView/GameViewStatusContext.js';
import { createGameViewStatus, type GameViewSettled } from './gameView/gameViewStatus.js';

export interface ViewOptions {
  /** `in-game` by default. */
  mode?: TscnCanvasMode;
  /** `false` draws only the frames a load or a capture needs. `true` by default. */
  visible?: boolean;
}

export interface View {
  /** A new read waits again after the scene changes. Rejects once the view fails to mount or is disposed. */
  readonly settled: Promise<GameViewSettled>;
  /** At the window's size whatever the element's. Rejects before `settled`, and outside In-game. */
  captureImage(): Promise<Blob>;
  /** Changes only the keys `options` gives a value. A `settled` read before a switch out of In-game rejects. */
  update(options: ViewOptions): void;
  /** The scene stays open for another view. */
  dispose(): void;
}

const DEFAULT_OPTIONS: Required<ViewOptions> = { mode: 'in-game', visible: true };

export function mountScene(element: HTMLElement, scene: Scene, options: ViewOptions = {}): View {
  let current = withGiven(DEFAULT_OPTIONS, options);
  const status = createGameViewStatus();
  // Aborts with the reason the view will never settle: a failed mount, or the dispose.
  const ending = new AbortController();
  // Aborts when the view leaves In-game, so a `settled` read before the switch does not wait forever.
  let inGame = new AbortController();
  let isDisposed = false;
  const root = createRoot(element, {
    onUncaughtError(error) {
      logger.error('[GameView] the view failed to mount', error);
      ending.abort(new Error(`expected the In-game view to mount, got ${String(error)}`));
    },
  });
  const render = () =>
    root.render(
      <TscnSceneProvider scene={scene}>
        <GameViewStatusProvider status={status}>
          <TscnCanvas mode={current.mode} visible={current.visible} />
        </GameViewStatusProvider>
      </TscnSceneProvider>
    );
  render();
  const outsideInGame = () => Promise.reject(new Error(`expected the in-game mode, got ${current.mode}`));
  const ended = () => Promise.reject(ending.signal.reason as Error);
  return {
    get settled() {
      if (ending.signal.aborted) return ended();
      if (current.mode !== 'in-game') return outsideInGame();
      return status.whenSettled(AbortSignal.any([ending.signal, inGame.signal]));
    },
    captureImage() {
      if (ending.signal.aborted) return ended();
      if (current.mode !== 'in-game') return outsideInGame();
      return status.captureImage().then(encodePng);
    },
    update(next) {
      if (isDisposed) throw new Error('expected a mounted view to update, got a disposed one');
      const previousMode = current.mode;
      current = withGiven(current, next);
      if (previousMode === 'in-game' && current.mode !== 'in-game') {
        inGame.abort(new Error(`expected the in-game mode, got ${current.mode}`));
        inGame = new AbortController();
      }
      render();
    },
    dispose() {
      isDisposed = true;
      const canvases = [...element.querySelectorAll('canvas')];
      root.unmount();
      ending.abort(new Error('expected the In-game view to settle before its dispose'));
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
