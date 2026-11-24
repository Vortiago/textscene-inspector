import { afterEach, describe, expect, it, vi } from 'vitest';

/** SceneListeners as a browser loads it, with the frame callbacks held until `drawFrame`. */
async function listenersInBrowser() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (tell: FrameRequestCallback) => frames.push(tell));
  vi.resetModules();
  const { SceneListeners } = await import('./sceneListeners');
  const drawFrame = () => frames.splice(0).forEach((tell) => tell(0));
  return { listeners: new SceneListeners((path) => path), drawFrame };
}

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SceneListeners in a browser', () => {
  it('tells the views once for the writes of one frame, though they land in two tasks', async () => {
    const { listeners, drawFrame } = await listenersInBrowser();
    const view = vi.fn();
    listeners.subscribe(view);
    listeners.written('/root/Main/A');
    await nextTask();
    listeners.written('/root/Main/B');
    await nextTask();
    expect(view).not.toHaveBeenCalled();
    drawFrame();
    expect(view).toHaveBeenCalledTimes(1);
  });

  it('tells the views once in the frame after a load changes the tree', async () => {
    const { listeners, drawFrame } = await listenersInBrowser();
    const view = vi.fn();
    listeners.subscribe(view);
    listeners.treeChanged();
    expect(view).not.toHaveBeenCalled();
    drawFrame();
    expect(view).toHaveBeenCalledTimes(1);
  });

  it('counts a new revision for each write, new text and tree change, at once', async () => {
    const { listeners } = await listenersInBrowser();
    const revisions = [listeners.revision()];
    listeners.written('/root/Main/A');
    revisions.push(listeners.revision());
    listeners.textChanged();
    revisions.push(listeners.revision());
    listeners.treeChanged();
    revisions.push(listeners.revision());
    expect(new Set(revisions).size).toBe(4);
  });

  it('tells an observer of a written node at the end of the task, before the frame', async () => {
    const { listeners } = await listenersInBrowser();
    const observer = vi.fn();
    listeners.observe('/root/Main/A', observer);
    listeners.written('/root/Main/A');
    await nextTask();
    expect(observer).toHaveBeenCalledTimes(1);
  });
});
