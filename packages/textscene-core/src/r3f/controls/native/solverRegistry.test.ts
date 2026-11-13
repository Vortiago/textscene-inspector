import { describe, expect, it } from 'vitest';
import { themedSlotRequests } from './solverRegistry';
import type { ThemedIconRef } from './solveTree';

const ICON = { ref: 'res://a.png', resources: {}, isHeldLocally: false } as unknown as ThemedIconRef;

describe('themedSlotRequests', () => {
  it('requests only the names that have a themed answer', () => {
    const requests = themedSlotRequests(['up', 'down'], { down: ICON });
    expect(requests.map(({ key }) => key)).toEqual(['down']);
  });

  it('gives none when no name is themed', () => {
    expect(themedSlotRequests(['up'], {})).toEqual([]);
  });

  it('keeps the order of the names', () => {
    expect(themedSlotRequests(['b', 'a'], { a: ICON, b: ICON }).map(({ key }) => key)).toEqual(['b', 'a']);
  });
});
