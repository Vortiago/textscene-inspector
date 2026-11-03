// @vitest-environment happy-dom
/* global document, window */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTextureWorkProbe } from './textureWorkProbe.mjs';

const STATUS_TESTID = 'texture-work-status';

function chip() {
  const element = document.createElement('div');
  element.dataset.testid = STATUS_TESTID;
  return element;
}

/** Lets the probe's MutationObserver deliver the records of the task so far. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the probe recording the texture work status', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'PerformanceObserver',
      class {
        observe() {}
      }
    );
    window.Worker = class {};
    installTextureWorkProbe(STATUS_TESTID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('counts a status that attaches and detaches inside one batch of mutations', async () => {
    const status = chip();
    document.body.append(status);
    status.remove();
    await nextTask();
    expect(window.__textureWorkProbe.statusAttached).toHaveLength(1);
    expect(window.__textureWorkProbe.statusDetached).toHaveLength(1);
  });

  it('counts a status inside a subtree that attaches and detaches', async () => {
    const wrapper = document.createElement('section');
    wrapper.append(chip());
    document.body.append(wrapper);
    await nextTask();
    wrapper.remove();
    await nextTask();
    expect(window.__textureWorkProbe.statusAttached).toHaveLength(1);
    expect(window.__textureWorkProbe.statusDetached).toHaveLength(1);
  });

  it('ignores an element that is not the status', async () => {
    const other = document.createElement('div');
    document.body.append(other);
    other.remove();
    await nextTask();
    expect(window.__textureWorkProbe.statusAttached).toEqual([]);
    expect(window.__textureWorkProbe.statusDetached).toEqual([]);
  });
});
