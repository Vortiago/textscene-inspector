import { describe, expect, it } from 'vitest';
import { createViewStatus, type DrawnFrame, type ViewSettled, type LiveScene } from './viewStatus';
import type { PendingSceneWork } from '../sceneWork';

const NO_PENDING_WORK: PendingSceneWork = { resources: 0, textures: 0, fonts: 0 };

const FACTS: ViewSettled = { scriptedNodeCount: 2, hasCurrentCamera: true };

function frameOf(revision: number, work: PendingSceneWork = NO_PENDING_WORK): DrawnFrame {
  return { revision, isFullSize: true, work, facts: FACTS };
}

/** A scene at `revision()` that never tells of a change. */
function sceneAt(revision: () => number): LiveScene {
  return { revision, subscribe: () => () => {} };
}

/** A status with a view attached whose scene is now at `live()`. */
function attachedStatus(live: () => number = () => 1) {
  const status = createViewStatus();
  status.attach(sceneAt(live));
  return status;
}

function drawFrame(status: ReturnType<typeof createViewStatus>, revision = 1) {
  status.frameDrawn(frameOf(revision));
}

describe('the settled signal of a view', () => {
  it('resolves a wait from before a view was replaced once the next view settles', async () => {
    const status = createViewStatus();
    const scene = sceneAt(() => 1);
    const detachFirst = status.attach(scene)!;
    const settled = status.whenSettled();
    detachFirst();
    status.attach(scene);
    expect(status.settled()).toBeNull();
    drawFrame(status);
    await expect(settled).resolves.toEqual(FACTS);
  });

  it('is pending with no view attached, though no view waits on it', () => {
    const status = createViewStatus();
    expect(status.settled()).toBeNull();
    expect(status.isPending()).toBe(false);
  });

  it('holds an attached view pending until it settles', () => {
    const status = attachedStatus();
    expect(status.isPending()).toBe(true);
    drawFrame(status);
    expect(status.isPending()).toBe(false);
  });

  it('settles on the first frame that draws the current revision with no pending work', () => {
    const status = attachedStatus();
    expect(status.settled()).toBeNull();
    drawFrame(status);
    expect(status.settled()).toEqual(FACTS);
  });

  it.each<[string, PendingSceneWork]>([
    ['a resource', { resources: 1, textures: 0, fonts: 0 }],
    ['a texture', { resources: 0, textures: 1, fonts: 0 }],
    ['a font', { resources: 0, textures: 0, fonts: 1 }],
  ])('is pending on a frame drawn while %s is on its way', (_, work) => {
    const status = attachedStatus();
    drawFrame(status);
    status.frameDrawn(frameOf(1, work));
    expect(status.settled()).toBeNull();
    drawFrame(status);
    expect(status.settled()).toEqual(FACTS);
  });

  it('is pending again once the scene shows a change that no frame has drawn', () => {
    let live = 1;
    const status = attachedStatus(() => live);
    drawFrame(status);
    live = 2;
    expect(status.settled()).toBeNull();
  });

  it('tells its subscribers when the scene changes, so a host hears the pending state', () => {
    let tell = () => {};
    const status = createViewStatus();
    status.attach({ revision: () => 1, subscribe: (listener) => ((tell = listener), () => {}) });
    let notices = 0;
    status.subscribe(() => notices++);
    tell();
    expect(notices).toBe(1);
  });

  it('tells its subscribers when it settles again on the same facts after a change', () => {
    let tell = () => {};
    let live = 1;
    const status = createViewStatus();
    status.attach({ revision: () => live, subscribe: (listener) => ((tell = listener), () => {}) });
    drawFrame(status);
    const heard: (ViewSettled | null)[] = [];
    status.subscribe(() => heard.push(status.settled()));
    const changed = 2;
    live = changed;
    tell();
    drawFrame(status, changed);
    expect(heard).toEqual([null, FACTS]);
  });

  it('stays pending on frames that draw an older revision, and settles on one that draws the change', () => {
    let live = 1;
    const status = attachedStatus(() => live);
    drawFrame(status);
    live = 2;
    drawFrame(status, 1);
    expect(status.settled()).toBeNull();
    drawFrame(status, 2);
    expect(status.settled()).toEqual(FACTS);
  });

  it('keeps one settled object while the facts hold, so a hook renders once', () => {
    const status = attachedStatus();
    drawFrame(status);
    const first = status.settled();
    drawFrame(status);
    drawFrame(status);
    expect(status.settled()).toBe(first);
  });

  it('refuses a second view while one is attached, and takes one after it leaves', () => {
    const status = createViewStatus();
    const detach = status.attach(sceneAt(() => 1));
    expect(status.attach(sceneAt(() => 1))).toBeNull();
    detach!();
    expect(status.attach(sceneAt(() => 1))).not.toBeNull();
  });

  it('tells its subscribers when it settles and when a view leaves', () => {
    const status = createViewStatus();
    const detach = status.attach(sceneAt(() => 1));
    let notices = 0;
    status.subscribe(() => notices++);
    drawFrame(status);
    expect(notices).toBe(1);
    detach!();
    expect(status.settled()).toBeNull();
    expect(notices).toBe(2);
  });

  it('resolves a wait on the frame that settles the view', async () => {
    const status = attachedStatus();
    const settled = status.whenSettled();
    drawFrame(status);
    await expect(settled).resolves.toEqual(FACTS);
  });

  it('rejects a wait whose signal aborts before the view settles', async () => {
    const status = attachedStatus();
    const disposal = new AbortController();
    const settled = status.whenSettled(disposal.signal);
    disposal.abort(new Error('disposed'));
    await expect(settled).rejects.toThrow('disposed');
  });
});

describe('the capture of a view', () => {
  const PIXELS = { width: 2, height: 1, data: new Uint8Array(8) };

  it('rejects with no view attached', async () => {
    await expect(createViewStatus().captureImage()).rejects.toThrow(
      'expected a settled view, got no view mounted'
    );
  });

  it('rejects before the view settles, and names the pending work', async () => {
    const status = attachedStatus();
    status.frameDrawn(frameOf(1, { resources: 2, textures: 1, fonts: 0 }));
    await expect(status.captureImage()).rejects.toThrow(
      'expected a settled view, got 2 resources and 1 texture still loading'
    );
  });

  it('rejects while a change to the scene waits for its frame', async () => {
    let live = 1;
    const status = attachedStatus(() => live);
    drawFrame(status);
    live = 2;
    await expect(status.captureImage()).rejects.toThrow(
      'expected a settled view, got a change to the scene that no frame has drawn'
    );
  });

  it('holds the window at full size, and reads it once the full window has settled', async () => {
    const status = attachedStatus();
    drawFrame(status);
    const image = status.captureImage();
    expect(status.isCapturePending()).toBe(true);
    status.frameDrawn({ ...frameOf(1), isFullSize: false });
    expect(status.isCaptureDue()).toBe(false);
    drawFrame(status);
    expect(status.isCaptureDue()).toBe(true);
    status.capture(() => PIXELS);
    expect(status.isCapturePending()).toBe(false);
    await expect(image).resolves.toBe(PIXELS);
  });

  it('gives a second capture asked before the read the same image', () => {
    const status = attachedStatus();
    drawFrame(status);
    expect(status.captureImage()).toBe(status.captureImage());
  });

  it('rejects a capture whose read throws, and lets the view draw at its own size again', async () => {
    const status = attachedStatus();
    drawFrame(status);
    const image = status.captureImage();
    status.capture(() => {
      throw new Error('context lost');
    });
    expect(status.isCapturePending()).toBe(false);
    await expect(image).rejects.toThrow("expected the view's pixels, got Error: context lost");
  });

  it('rejects a capture the view leaves before it reads', async () => {
    const status = createViewStatus();
    const detach = status.attach(sceneAt(() => 1));
    drawFrame(status);
    const image = status.captureImage();
    detach!();
    await expect(image).rejects.toThrow('expected the view to stay mounted until its capture');
  });
});
