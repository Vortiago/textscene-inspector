import { describe, expect, it } from 'vitest';
import { createPendingLoads } from './pendingLoads';

describe('createPendingLoads', () => {
  it('starts at zero', () => {
    expect(createPendingLoads().pending()).toBe(0);
  });

  it('reaches zero only when the last load ends', () => {
    const loads = createPendingLoads();
    const endA = loads.begin();
    const endB = loads.begin();
    expect(loads.pending()).toBe(2);
    endA();
    expect(loads.pending()).toBe(1);
    endB();
    expect(loads.pending()).toBe(0);
  });

  it('ignores a second end, so one load cannot drive the count negative', () => {
    const loads = createPendingLoads();
    const end = loads.begin();
    end();
    end();
    expect(loads.pending()).toBe(0);
  });

  it('notifies a subscriber on begin and on end', () => {
    const loads = createPendingLoads();
    const seen: number[] = [];
    loads.subscribe(() => seen.push(loads.pending()));
    loads.begin()();
    expect(seen).toEqual([1, 0]);
  });

  it('stops notifying after unsubscribe', () => {
    const loads = createPendingLoads();
    let calls = 0;
    const unsubscribe = loads.subscribe(() => {
      calls += 1;
    });
    unsubscribe();
    loads.begin()();
    expect(calls).toBe(0);
  });
});
