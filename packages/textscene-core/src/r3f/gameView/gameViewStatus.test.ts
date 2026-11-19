import { describe, expect, it } from 'vitest';
import {
  createGameViewStatus,
  type DrawnFrame,
  type GameViewSettled,
  type LiveScene,
} from './gameViewStatus';
import type { PendingSceneWork } from '../sceneWork';

// The count measured on the In-game goldens, which this suite pins.
const SETTLE_FRAMES = 3;
const NO_PENDING_WORK: PendingSceneWork = { resources: 0, textures: 0, fonts: 0 };

const FACTS: GameViewSettled = { scriptedNodeCount: 2, hasCurrentCamera: true };
const GRAPH = { name: 'graph' };
const WINDOW = { name: 'window' };
const FULL_WINDOW = { name: 'full window' };

function frameOf(shown: readonly unknown[], work: PendingSceneWork = NO_PENDING_WORK): DrawnFrame {
  return { shown, window: WINDOW, isFullWindow: true, work, facts: FACTS };
}

/** A scene that shows `state()` and never tells of a change. */
function sceneShowing(state: () => readonly unknown[]): LiveScene {
  return { state, subscribe: () => () => {} };
}

/** A status with a view attached whose scene now shows `live()`. */
function attachedStatus(live: () => readonly unknown[] = () => [GRAPH]) {
  const status = createGameViewStatus();
  status.attach(sceneShowing(live));
  return status;
}

function drawQuietFrames(status: ReturnType<typeof createGameViewStatus>, count: number, shown = [GRAPH]) {
  for (let frame = 0; frame < count; frame++) status.frameDrawn(frameOf(shown));
}

describe('the settled signal of the In-game view', () => {
  it('is pending with no view attached, though no view waits on it', () => {
    const status = createGameViewStatus();
    expect(status.settled()).toBeNull();
    expect(status.isPending()).toBe(false);
  });

  it('holds an attached view pending until it settles', () => {
    const status = attachedStatus();
    expect(status.isPending()).toBe(true);
    drawQuietFrames(status, SETTLE_FRAMES);
    expect(status.isPending()).toBe(false);
  });

  it('is pending until the named count of frames draw with no pending work', () => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES - 1);
    expect(status.settled()).toBeNull();
    drawQuietFrames(status, 1);
    expect(status.settled()).toEqual(FACTS);
  });

  it.each<[string, PendingSceneWork]>([
    ['a resource', { resources: 1, textures: 0, fonts: 0 }],
    ['a texture', { resources: 0, textures: 1, fonts: 0 }],
    ['a font', { resources: 0, textures: 0, fonts: 1 }],
  ])('starts the count again while %s is on its way', (_, work) => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES - 1);
    status.frameDrawn(frameOf([GRAPH], work));
    drawQuietFrames(status, SETTLE_FRAMES - 1);
    expect(status.settled()).toBeNull();
    drawQuietFrames(status, 1);
    expect(status.settled()).toEqual(FACTS);
  });

  it('is pending again once the scene shows a change that no frame has drawn', () => {
    let live: readonly unknown[] = [GRAPH];
    const status = attachedStatus(() => live);
    drawQuietFrames(status, SETTLE_FRAMES);
    live = [{ name: 'written graph' }];
    expect(status.settled()).toBeNull();
  });

  it('tells its subscribers when the scene changes, so a host hears the pending state', () => {
    let tell = () => {};
    const status = createGameViewStatus();
    status.attach({ state: () => [GRAPH], subscribe: (listener) => ((tell = listener), () => {}) });
    let notices = 0;
    status.subscribe(() => notices++);
    tell();
    expect(notices).toBe(1);
  });

  it('tells its subscribers when it settles again on the same facts after a change', () => {
    let tell = () => {};
    let live: readonly unknown[] = [GRAPH];
    const status = createGameViewStatus();
    status.attach({ state: () => live, subscribe: (listener) => ((tell = listener), () => {}) });
    drawQuietFrames(status, SETTLE_FRAMES);
    const heard: (GameViewSettled | null)[] = [];
    status.subscribe(() => heard.push(status.settled()));
    const changed = [{ name: 'camera call' }];
    live = changed;
    tell();
    drawQuietFrames(status, SETTLE_FRAMES, changed);
    expect(heard).toEqual([null, FACTS]);
  });

  it('settles on a change after its own count of frames', () => {
    const changed = [{ name: 'new text' }];
    let live: readonly unknown[] = [GRAPH];
    const status = attachedStatus(() => live);
    drawQuietFrames(status, SETTLE_FRAMES);
    live = changed;
    drawQuietFrames(status, SETTLE_FRAMES - 1, changed);
    expect(status.settled()).toBeNull();
    drawQuietFrames(status, 1, changed);
    expect(status.settled()).toEqual(FACTS);
  });

  it('keeps one settled object while the facts hold, so a hook renders once', () => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES);
    const first = status.settled();
    drawQuietFrames(status, 3);
    expect(status.settled()).toBe(first);
  });

  it('tells its subscribers when it settles and when a view leaves', () => {
    const status = createGameViewStatus();
    const detach = status.attach(sceneShowing(() => [GRAPH]));
    let notices = 0;
    status.subscribe(() => notices++);
    drawQuietFrames(status, SETTLE_FRAMES + 2);
    expect(notices).toBe(1);
    detach();
    expect(status.settled()).toBeNull();
    expect(notices).toBe(2);
  });

  it('resolves a wait on the frame that settles the view', async () => {
    const status = attachedStatus();
    const settled = status.whenSettled();
    drawQuietFrames(status, SETTLE_FRAMES);
    await expect(settled).resolves.toEqual(FACTS);
  });

  it('rejects a wait whose signal aborts before the view settles', async () => {
    const status = attachedStatus();
    const disposal = new AbortController();
    const settled = status.whenSettled(disposal.signal);
    disposal.abort();
    await expect(settled).rejects.toThrow('expected the In-game view to settle before its dispose');
  });
});

describe('the capture of the In-game view', () => {
  const PIXELS = { width: 2, height: 1, data: new Uint8Array(8) };

  it('rejects with no view attached', async () => {
    await expect(createGameViewStatus().captureImage()).rejects.toThrow(
      'expected a settled view, got no In-game view mounted'
    );
  });

  it('rejects before the view settles, and names the pending work', async () => {
    const status = attachedStatus();
    status.frameDrawn(frameOf([GRAPH], { resources: 2, textures: 1, fonts: 0 }));
    await expect(status.captureImage()).rejects.toThrow(
      'expected a settled view, got 2 resources and 1 texture still loading'
    );
  });

  it('rejects while frames still converge after the last load', async () => {
    const status = attachedStatus();
    drawQuietFrames(status, 1);
    await expect(status.captureImage()).rejects.toThrow(
      `expected a settled view, got 1 of ${SETTLE_FRAMES} quiet frames drawn`
    );
  });

  it('holds the window at full size, and reads it once the full window has settled', async () => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES);
    const image = status.captureImage();
    expect(status.holdsFullWindow()).toBe(true);
    status.frameDrawn({ ...frameOf([GRAPH]), isFullWindow: false });
    expect(status.isCaptureDue()).toBe(false);
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) {
      status.frameDrawn({ ...frameOf([GRAPH]), window: FULL_WINDOW });
    }
    expect(status.isCaptureDue()).toBe(true);
    status.capture(() => PIXELS);
    expect(status.holdsFullWindow()).toBe(false);
    await expect(image).resolves.toBe(PIXELS);
  });

  it('gives a second capture asked before the read the same image', () => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES);
    expect(status.captureImage()).toBe(status.captureImage());
  });

  it('rejects a capture whose read throws, and lets the view draw at its own size again', async () => {
    const status = attachedStatus();
    drawQuietFrames(status, SETTLE_FRAMES);
    const image = status.captureImage();
    status.capture(() => {
      throw new Error('context lost');
    });
    expect(status.holdsFullWindow()).toBe(false);
    await expect(image).rejects.toThrow("expected the window's pixels, got Error: context lost");
  });

  it('rejects a capture the view leaves before it reads', async () => {
    const status = createGameViewStatus();
    const detach = status.attach(sceneShowing(() => [GRAPH]));
    drawQuietFrames(status, SETTLE_FRAMES);
    const image = status.captureImage();
    detach();
    await expect(image).rejects.toThrow('expected the In-game view to stay mounted until its capture');
  });
});
