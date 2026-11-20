import { createExternalStore } from '../../utils/externalStore.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { describePendingWork, hasPendingWork, type PendingSceneWork } from '../sceneWork.js';

export interface ViewSettled {
  /** Godot readies each script before the first frame (`node.cpp:273`), and this view runs none. */
  scriptedNodeCount: number;
  /** A current Camera3D or Camera2D in the root viewport. */
  hasCurrentCamera: boolean;
}

export interface LiveScene {
  /** Changes with each change a frame draws, so a frame that drew the same revision shows the scene. */
  revision(): number;
  subscribe(listener: () => void): () => void;
}

export interface DrawnFrame {
  revision: number;
  isFullSize: boolean;
  /** The Camera3D the view names and this frame did not draw through, or null. */
  awaitedCamera: string | null;
  work: PendingSceneWork;
  facts: ViewSettled;
}

export interface ViewStatus {
  /** Null while pending, and with no view attached. The drawn frame's own facts, so a hook renders once. */
  settled(): ViewSettled | null;
  /** An attached view that has not settled: no view at all waits on nothing. */
  isPending(): boolean;
  /** How many times the view has turned pending, so a reader that renders later misses no round. */
  pendingRounds(): number;
  subscribe(listener: () => void): () => void;
  /** Stays pending while no view is attached, and rejects with the reason of `signal` once it aborts. */
  whenSettled(signal?: AbortSignal): Promise<ViewSettled>;
  /** Rejects before the view settles, and names the pending work. */
  captureImage(): Promise<RgbaImage>;
  isCapturePending(): boolean;
  /** Null while another view is attached: one status serves one view. */
  attach(scene: LiveScene): (() => void) | null;
  /** Keeps `frame` as the last frame: a view may fill the same record again for its next frame. */
  frameDrawn(frame: DrawnFrame): void;
  /** A capture reads through it a microtask after a settled full-size frame. Returns the removal. */
  readWith(read: () => RgbaImage): () => void;
}

interface PendingCapture {
  image: Promise<RgbaImage>;
  resolve(pixels: RgbaImage): void;
  reject(error: Error): void;
}

export function createViewStatus(): ViewStatus {
  // A count of announcements, so the store notifies on each one.
  const announcements = createExternalStore(0);
  let live: LiveScene | null = null;
  let lastFrame: DrawnFrame | null = null;
  // What subscribers last heard, so a view that settles again on the same facts still tells them.
  let announced: ViewSettled | null = null;
  let rounds = 0;
  let capture: PendingCapture | null = null;
  let reader: (() => RgbaImage) | null = null;
  let isReadQueued = false;

  const showsDrawnState = () => live !== null && lastFrame !== null && live.revision() === lastFrame.revision;
  // Nested viewports draw before their parent in one frame, so one frame shows a revision whole.
  const settled = (): ViewSettled | null =>
    showsDrawnState() && !hasPendingWork(lastFrame!.work) && lastFrame!.awaitedCamera === null
      ? lastFrame!.facts
      : null;

  const notify = () => announcements.set(announcements.get() + 1);

  function announce(now = settled()): void {
    if (now === null && announced !== null) rounds++;
    announced = now;
    notify();
  }

  function publish(): void {
    const now = settled();
    if (now !== announced) announce(now);
  }

  function pendingReason(): string {
    if (!live) return 'no view mounted';
    if (!lastFrame) return 'no frame drawn';
    if (hasPendingWork(lastFrame.work)) return `${describePendingWork(lastFrame.work)} still loading`;
    if (lastFrame.awaitedCamera !== null)
      return `the view does not draw through "${lastFrame.awaitedCamera}" yet`;
    return 'a change to the scene that no frame has drawn';
  }

  function whenSettled(signal?: AbortSignal): Promise<ViewSettled> {
    const now = settled();
    if (now) return Promise.resolve(now);
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const stopListening = announcements.subscribe(() => {
        const value = settled();
        if (!value) return;
        stop();
        resolve(value);
      });
      const abandon = () => {
        stop();
        reject(signal!.reason);
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
    queueRead();
    return image;
  }

  const isCaptureDue = () => capture !== null && lastFrame?.isFullSize === true && settled() !== null;

  // A microtask, so a frame that makes a capture due finishes before the read draws its own.
  function queueRead(): void {
    if (isReadQueued || !reader || !isCaptureDue()) return;
    isReadQueued = true;
    queueMicrotask(() => {
      isReadQueued = false;
      if (reader && isCaptureDue()) read(reader);
    });
  }

  function read(pixels: () => RgbaImage): void {
    const done = capture;
    capture = null;
    try {
      done?.resolve(pixels());
    } catch (error) {
      done?.reject(new Error(`expected the view's pixels, got ${String(error)}`));
    }
    notify();
  }

  function readWith(pixels: () => RgbaImage): () => void {
    reader = pixels;
    queueRead();
    return () => {
      if (reader === pixels) reader = null;
    };
  }

  function attach(scene: LiveScene): (() => void) | null {
    if (live) return null;
    live = scene;
    announce();
    // A change no frame has drawn makes `settled` pending at once, so a host hears it.
    const stopListening = scene.subscribe(() => announce());
    return () => {
      stopListening();
      if (live !== scene) return;
      live = null;
      lastFrame = null;
      const left = capture;
      capture = null;
      left?.reject(new Error('expected the view to stay mounted until its capture'));
      announce();
    };
  }

  function frameDrawn(frame: DrawnFrame): void {
    lastFrame = frame;
    publish();
    queueRead();
  }

  return {
    settled,
    isPending: () => live !== null && settled() === null,
    pendingRounds: () => rounds,
    subscribe: announcements.subscribe,
    whenSettled,
    captureImage,
    isCapturePending: () => capture !== null,
    attach,
    frameDrawn,
    readWith,
  };
}
