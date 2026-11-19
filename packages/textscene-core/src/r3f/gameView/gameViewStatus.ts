import { sameElements } from '../../utils/sameElements.js';
import { createExternalStore } from '../hooks/createExternalStore.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { describePendingWork, hasPendingWork, type PendingSceneWork } from '../sceneWork.js';

export interface GameViewSettled {
  /** Godot readies each script before the first frame (`node.cpp:273`), and this view runs none. */
  scriptedNodeCount: number;
  /** A current Camera3D or Camera2D in the root viewport. */
  hasCurrentCamera: boolean;
}

export interface LiveScene {
  /** What a frame now would show, compared item by item with what a frame drew. */
  state(): readonly unknown[];
  subscribe(listener: () => void): () => void;
}

export interface DrawnFrame {
  shown: readonly unknown[];
  /** A new window starts the count again, since its passes draw again. */
  window: unknown;
  isFullWindow: boolean;
  work: PendingSceneWork;
  facts: GameViewSettled;
}

export interface GameViewStatus {
  /** Null while pending, and with no view attached. The drawn frame's own facts, so a hook renders once. */
  settled(): GameViewSettled | null;
  /** An attached view that has not settled: no view at all waits on nothing. */
  isPending(): boolean;
  subscribe(listener: () => void): () => void;
  /** Stays pending while no view is attached, and rejects once `signal` aborts. */
  whenSettled(signal?: AbortSignal): Promise<GameViewSettled>;
  /** Rejects before the view settles, and names the pending work. */
  captureImage(): Promise<RgbaImage>;
  /** A capture reads the full window, so the view draws its target at full size until then. */
  holdsFullWindow(): boolean;
  attach(scene: LiveScene): () => void;
  frameDrawn(frame: DrawnFrame): void;
  isCaptureDue(): boolean;
  /** Resolves the capture with `read`, or rejects it with what `read` throws. */
  capture(read: () => RgbaImage): void;
}

// A draw that reads a target an earlier draw wrote shows the change a frame later.
const SETTLE_FRAMES = 3;

interface PendingCapture {
  image: Promise<RgbaImage>;
  resolve(pixels: RgbaImage): void;
  reject(error: Error): void;
}

export function createGameViewStatus(): GameViewStatus {
  // A count of announcements, so the store notifies on each one.
  const announcements = createExternalStore(0);
  let live: LiveScene | null = null;
  let lastFrame: DrawnFrame | null = null;
  let quietFrames = 0;
  // What subscribers last heard, so a view that settles again on the same facts still tells them.
  let announced: GameViewSettled | null = null;
  let capture: PendingCapture | null = null;

  const showsDrawnState = () =>
    live !== null && lastFrame !== null && sameElements(live.state(), lastFrame.shown);
  const isQuiet = () => lastFrame !== null && quietFrames >= SETTLE_FRAMES;

  const settled = (): GameViewSettled | null => (isQuiet() && showsDrawnState() ? lastFrame!.facts : null);

  const notify = () => announcements.set(announcements.get() + 1);

  function announce(now = settled()): void {
    announced = now;
    notify();
  }

  function publish(): void {
    const now = settled();
    if (now !== announced) announce(now);
  }

  function drawsAnotherState(frame: DrawnFrame): boolean {
    if (!lastFrame) return true;
    return !sameElements(frame.shown, lastFrame.shown) || frame.window !== lastFrame.window;
  }

  function pendingReason(): string {
    if (!live) return 'no In-game view mounted';
    if (!lastFrame) return 'no frame drawn';
    if (hasPendingWork(lastFrame.work)) return `${describePendingWork(lastFrame.work)} still loading`;
    if (!showsDrawnState()) return 'a change to the scene that no frame has drawn';
    return `${quietFrames} of ${SETTLE_FRAMES} quiet frames drawn`;
  }

  function whenSettled(signal?: AbortSignal): Promise<GameViewSettled> {
    const now = settled();
    if (now) return Promise.resolve(now);
    const abandoned = () => new Error('expected the In-game view to settle before its dispose');
    if (signal?.aborted) return Promise.reject(abandoned());
    return new Promise((resolve, reject) => {
      const stopListening = announcements.subscribe(() => {
        const value = settled();
        if (!value) return;
        stop();
        resolve(value);
      });
      const abandon = () => {
        stop();
        reject(abandoned());
      };
      function stop(): void {
        stopListening();
        signal?.removeEventListener('abort', abandon);
      }
      signal?.addEventListener('abort', abandon, { once: true });
    });
  }

  function captureImage(): Promise<RgbaImage> {
    if (capture) return capture.image;
    if (!settled()) return Promise.reject(new Error(`expected a settled view, got ${pendingReason()}`));
    let resolve: (pixels: RgbaImage) => void = () => {};
    let reject: (error: Error) => void = () => {};
    const image = new Promise<RgbaImage>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    capture = { image, resolve, reject };
    notify();
    return image;
  }

  function attach(scene: LiveScene): () => void {
    live = scene;
    announce();
    // A change no frame has drawn makes `settled` pending at once, so a host hears it.
    const stopListening = scene.subscribe(() => announce());
    return () => {
      stopListening();
      if (live !== scene) return;
      live = null;
      lastFrame = null;
      quietFrames = 0;
      const left = capture;
      capture = null;
      left?.reject(new Error('expected the In-game view to stay mounted until its capture'));
      announce();
    };
  }

  function frameDrawn(frame: DrawnFrame): void {
    if (hasPendingWork(frame.work)) quietFrames = 0;
    else quietFrames = drawsAnotherState(frame) ? 1 : quietFrames + 1;
    lastFrame = frame;
    publish();
  }

  function captureWith(read: () => RgbaImage): void {
    const done = capture;
    capture = null;
    try {
      done?.resolve(read());
    } catch (error) {
      done?.reject(new Error(`expected the window's pixels, got ${String(error)}`));
    }
    notify();
  }

  return {
    settled,
    isPending: () => live !== null && settled() === null,
    subscribe: announcements.subscribe,
    whenSettled,
    captureImage,
    holdsFullWindow: () => capture !== null,
    attach,
    frameDrawn,
    isCaptureDue: () => capture !== null && lastFrame?.isFullWindow === true && settled() !== null,
    capture: captureWith,
  };
}
