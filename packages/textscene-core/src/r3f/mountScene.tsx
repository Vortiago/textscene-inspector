import { createRoot } from 'react-dom/client';
import type { Scene } from '../scene/openScene.js';
import { encodePng } from '../utils/encodePng.js';
import { TscnCanvas, type TscnCanvasMode } from './TscnCanvas.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import { GameViewStatusProvider } from './gameView/GameViewStatusContext.js';
import { createGameViewStatus, type GameViewSettled } from './gameView/gameViewStatus.js';

export interface MountSceneOptions {
  mode?: TscnCanvasMode;
}

export interface MountedScene {
  /** A new read waits again after the scene changes. Rejects once the view is disposed. */
  readonly settled: Promise<GameViewSettled>;
  /** At the window's size whatever the element's. Rejects before `settled`, and outside In-game. */
  captureImage(): Promise<Blob>;
  /** The scene stays open for another view. */
  dispose(): void;
}

export function mountScene(
  element: HTMLElement,
  scene: Scene,
  { mode = 'in-game' }: MountSceneOptions = {}
): MountedScene {
  const status = createGameViewStatus();
  const disposal = new AbortController();
  const root = createRoot(element);
  root.render(
    <TscnSceneProvider scene={scene}>
      <GameViewStatusProvider status={status}>
        <TscnCanvas mode={mode} />
      </GameViewStatusProvider>
    </TscnSceneProvider>
  );
  const outsideInGame = () => Promise.reject(new Error(`expected the in-game mode, got ${mode}`));
  return {
    get settled() {
      return mode === 'in-game' ? status.whenSettled(disposal.signal) : outsideInGame();
    },
    captureImage: () => (mode === 'in-game' ? status.captureImage().then(encodePng) : outsideInGame()),
    dispose() {
      const canvases = [...element.querySelectorAll('canvas')];
      root.unmount();
      disposal.abort();
      canvases.forEach(loseContext);
    },
  };
}

// A page holds few live WebGL contexts, and R3F releases its own a timer after the unmount.
function loseContext(canvas: HTMLCanvasElement): void {
  canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
}
