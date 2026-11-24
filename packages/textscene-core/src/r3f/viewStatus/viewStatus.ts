import { createExternalStore } from '../../utils/externalStore.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { describePendingWork, hasPendingWork, type PendingSceneWork } from '../sceneWork.js';
import type { FrameStats } from '../frameProfile/frameStats.js';
import { createUndrawnNodes, type UndrawnNode, type UndrawnReason } from './undrawnNodes.js';

export interface ViewSettled {
  /** Godot readies each script before the first frame (`node.cpp:273`), and this view runs none. */
  scriptedNodeCount: number;
  /** A current Camera3D or Camera2D in the root viewport. */
  hasCurrentCamera: boolean;
}

/** What a view reports of itself now: `view.status()` and the `TscnCanvas` ref give it. */
export interface ViewStatus {
  /** The settled value, or null while the view is pending. */
  settled: ViewSettled | null;
  /** The textures and fonts still building on the page: two views of one page count each other's. */
  pending: { textures: number; fonts: number };
  /** The last window of frame numbers, or null before the first: its `timings` need `show.performance`. */
  frame: FrameStats | null;
  /** Each node the view holds and does not draw as authored, in path order. */
  undrawn: readonly UndrawnNode[];
  /** The browser draws the view's WebGL in software, so every frame is slow. */
  isSoftwareRendering: boolean;
}

/** What a host has heard before a view reports: nothing settled, pending, measured, undrawn or found. */
export const EMPTY_VIEW_STATUS: ViewStatus = {
  settled: null,
  pending: { textures: 0, fonts: 0 },
  frame: null,
  undrawn: [],
  isSoftwareRendering: false,
};

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

export interface ViewStatusStore {
  /** One object while nothing in it changes, so a reader compares identities. */
  status(): ViewStatus;
  /** A load can start while no frame draws, so the counts change between frames too. */
  workChanged(work: PendingSceneWork): void;
  /** Opens one report of an undrawn node. Returns its end. */
  reportUndrawn(path: string, reason: UndrawnReason): () => void;
  /** A view never draws in hardware again once the browser falls back to software. */
  softwareRenderingFound(): void;
  /** Null once the profile stops. */
  frameMeasured(stats: FrameStats | null): void;
  /** Null while pending, and with no view attached. The drawn frame's own facts, so a hook renders once. */
  settled(): ViewSettled | null;
  /** An attached view that has not settled: no view at all waits on nothing. */
  isPending(): boolean;
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

export function createViewStatusStore(): ViewStatusStore {
  // A count of announcements, so the store notifies on each one.
  const announcements = createExternalStore(0);
  let live: LiveScene | null = null;
  let lastFrame: DrawnFrame | null = null;
  // What subscribers last heard, so a view that settles again on the same facts still tells them.
  let announced: ViewSettled | null = null;
  let capture: PendingCapture | null = null;
  let reader: (() => RgbaImage) | null = null;
  let isReadQueued = false;
  const pending = { textures: 0, fonts: 0 };
  let frame: FrameStats | null = null;
  let isSoftwareRendering = false;
  // Written only by `status`, and cleared by each change it shows.
  let shown: ViewStatus | null = null;
  const undrawn = createUndrawnNodes();
  // Many nodes report as a scene mounts, so their reports reach the subscribers once per task.
  let isUndrawnNoticeQueued = false;
  undrawn.subscribe(() => {
    shown = null;
    if (isUndrawnNoticeQueued) return;
    isUndrawnNoticeQueued = true;
    queueMicrotask(() => {
      isUndrawnNoticeQueued = false;
      notify();
    });
  });

  const showsDrawnState = () => live !== null && lastFrame !== null && live.revision() === lastFrame.revision;
  // Nested viewports draw before their parent in one frame, so one frame shows a revision whole.
  const settled = (): ViewSettled | null =>
    showsDrawnState() && !hasPendingWork(lastFrame!.work) && lastFrame!.awaitedCamera === null
      ? lastFrame!.facts
      : null;

  const notify = () => {
    shown = null;
    announcements.set(announcements.get() + 1);
  };

  function announce(now = settled()): void {
    announced = now;
    notify();
  }

  function publish(): void {
    const now = settled();
    if (now !== announced) announce(now);
  }

  function status(): ViewStatus {
    const now = settled();
    // A scene edit makes `settled` pending before any notice clears the snapshot, so it is read fresh.
    if (shown?.settled !== now) shown = null;
    shown ??= {
      settled: now,
      pending: { ...pending },
      frame,
      undrawn: undrawn.nodes(),
      isSoftwareRendering,
    };
    return shown;
  }

  function workChanged(work: PendingSceneWork): void {
    if (work.textures === pending.textures && work.fonts === pending.fonts) return;
    pending.textures = work.textures;
    pending.fonts = work.fonts;
    notify();
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

  function frameDrawn(drawn: DrawnFrame): void {
    lastFrame = drawn;
    workChanged(drawn.work);
    publish();
    queueRead();
  }

  return {
    status,
    workChanged,
    reportUndrawn: undrawn.report,
    softwareRenderingFound() {
      if (isSoftwareRendering) return;
      isSoftwareRendering = true;
      notify();
    },
    frameMeasured(stats) {
      if (stats === frame) return;
      frame = stats;
      notify();
    },
    settled,
    isPending: () => live !== null && settled() === null,
    subscribe: announcements.subscribe,
    whenSettled,
    captureImage,
    isCapturePending: () => capture !== null,
    attach,
    frameDrawn,
    readWith,
  };
}
