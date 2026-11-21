import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as logger from '../logger.js';
import type { Scene } from '../scene/openScene.js';
import type { NodeHandle } from '../scene/nodeHandle.js';
import { TscnCanvas, type TscnCanvasMode } from './TscnCanvas.js';
import { TscnSceneProvider } from './TscnSceneProvider.js';
import { assertCameraPath } from './viewCamera.js';
import { ViewStatusProvider } from './viewStatus/ViewStatusContext.js';
import { createViewStatusStore } from './viewStatus/viewStatus.js';
import { viewAnswers, type ViewAnswers } from './viewStatus/viewAnswers.js';
import type { ViewStatus } from './viewStatus/viewStatus.js';
import { assertShow, DEFAULT_SHOW, withShown, type ViewShow } from './viewShow/viewShow.js';

export interface ViewOptions {
  /** `in-game` by default. */
  mode?: TscnCanvasMode;
  /** `false` draws only the frames a load, a settle or a capture needs. `true` by default. */
  visible?: boolean;
  /** The 3D mode's Camera3D, by path from the scene's root. `null`, the default, is the editor camera. */
  camera?: string | null;
  /** The node the view outlines, or null for none. Given, a click leaves the outline to the host. */
  selected?: NodeHandle | null;
  /** The node a click in the 3D mode picks, or null for a click on nothing. `null` stops the calls. */
  onSelect?: ((node: NodeHandle | null) => void) | null;
  /** The editor helpers the 3D and 2D modes draw. In-game draws none but `performance`. */
  show?: Partial<ViewShow>;
  /** Called on each change of `status()` but for its frame numbers. `null` stops the calls. */
  onStatusChange?: ((status: ViewStatus) => void) | null;
}

/** The options a view holds: `mode`, `visible`, `camera` and `show` always, the callbacks once given. */
type MountedOptions = Omit<ViewOptions, 'show'> &
  Required<Pick<ViewOptions, 'mode' | 'visible' | 'camera'>> & { show: ViewShow };

/** `settled` rejects for a failed mount and after a dispose. */
export interface View extends ViewAnswers {
  /** Changes only the keys given a value, in `show` too. A `settled` from before a switch waits for it. */
  update(options: ViewOptions): void;
  /** The scene stays open for another view. */
  dispose(): void;
}

const DEFAULT_OPTIONS: MountedOptions = { mode: 'in-game', visible: true, camera: null, show: DEFAULT_SHOW };

export function mountScene(element: HTMLElement, scene: Scene, options: ViewOptions = {}): View {
  let current = withGiven(DEFAULT_OPTIONS, checked(scene, options));
  const store = createViewStatusStore();
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
        <ViewStatusProvider store={store}>
          <TscnCanvas {...current} />
        </ViewStatusProvider>
      </TscnSceneProvider>
    );
  render();
  const answers = viewAnswers({
    scene,
    store,
    ending: ending.signal,
    lookedThrough: () => (current.mode === '3D' ? current.camera : null),
  });
  return {
    get settled() {
      return answers.settled;
    },
    captureImage: answers.captureImage,
    status: answers.status,
    update(next) {
      if (isDisposed) throw new Error('expected a mounted view to update, got a disposed one');
      current = withGiven(current, checked(scene, next));
      const canvases = [...element.querySelectorAll('canvas')];
      const loseReplaced = () => canvases.filter((canvas) => !canvas.isConnected).forEach(loseContext);
      // Synchronous, so the replaced stage has left the element before its contexts are lost.
      flushSync(render);
      loseReplaced();
      // Inside a host's own React commit, flushSync defers the render past this call.
      setTimeout(loseReplaced);
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

// A key set to `undefined` keeps its value, as if `given` left it out. `null` is a value.
function withGiven(options: MountedOptions, given: ViewOptions): MountedOptions {
  return {
    mode: given.mode ?? options.mode,
    visible: given.visible ?? options.visible,
    camera: given.camera === undefined ? options.camera : given.camera,
    selected: given.selected === undefined ? options.selected : given.selected,
    onSelect: given.onSelect === undefined ? options.onSelect : given.onSelect,
    onStatusChange: given.onStatusChange === undefined ? options.onStatusChange : given.onStatusChange,
    show: withShown(options.show, given.show),
  };
}

// Before the render, so the caller gets the throw, and only for a camera or a show the caller gives now.
function checked(scene: Scene, given: ViewOptions): ViewOptions {
  if (typeof given.camera === 'string') assertCameraPath(scene, given.camera);
  if (given.show) assertShow(given.show);
  return given;
}

// A page holds few live WebGL contexts, and R3F releases its own a timer after the unmount.
function loseContext(canvas: HTMLCanvasElement): void {
  canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
}
