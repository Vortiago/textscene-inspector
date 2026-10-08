import { describe, expect, it } from 'vitest';
import { rootHeadingCounter } from './rootHeading.js';

describe('rootHeadingCounter', () => {
  it('calls the first node heading the root', () => {
    expect(rootHeadingCounter()()).toBe(true);
  });

  it('calls every later node heading a non-root', () => {
    const isRoot = rootHeadingCounter();
    isRoot();
    expect([isRoot(), isRoot()]).toEqual([false, false]);
  });

  it('counts each scan on its own', () => {
    rootHeadingCounter()();
    expect(rootHeadingCounter()()).toBe(true);
  });
});
