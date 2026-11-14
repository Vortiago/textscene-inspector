/**
 * `useControlTransformsUnder` hands a y-sort the Controls below its own path only, and keeps the map
 * it gave while those entries stay as they were.
 */
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { transform2DFromParts } from '../../godot/math/transform2d';
import { YSortProvider, useControlTransformsUnder, usePublishControlTransforms } from './YSortContext';

const at = (y: number) => transform2DFromParts(0, { x: 1, y: 1 }, 0, { x: 0, y });

function mountReaders() {
  const wrapper = ({ children }: { children: ReactNode }) => <YSortProvider>{children}</YSortProvider>;
  return renderHook(
    () => ({
      publish: usePublishControlTransforms()!,
      floorA: useControlTransformsUnder('Root/FloorA'),
      floorB: useControlTransformsUnder('Root/FloorB'),
    }),
    { wrapper }
  );
}

describe('useControlTransformsUnder', () => {
  it('keeps the map of a sort when a Control moves under another sort', () => {
    const view = mountReaders();
    act(() =>
      view.result.current.publish(
        'walk',
        new Map([
          ['Root/FloorA/x', at(1)],
          ['Root/FloorB/y', at(2)],
        ])
      )
    );
    const floorA = view.result.current.floorA;
    act(() =>
      view.result.current.publish(
        'walk',
        new Map([
          ['Root/FloorA/x', at(1)],
          ['Root/FloorB/y', at(9)],
        ])
      )
    );
    expect(view.result.current.floorA).toBe(floorA);
    expect(view.result.current.floorB.get('Root/FloorB/y')?.ty).toBe(9);
  });

  it('gives a new map when a Control below the sort moves', () => {
    const view = mountReaders();
    act(() => view.result.current.publish('walk', new Map([['Root/FloorA/x', at(1)]])));
    const floorA = view.result.current.floorA;
    act(() => view.result.current.publish('walk', new Map([['Root/FloorA/x', at(5)]])));
    expect(view.result.current.floorA).not.toBe(floorA);
    expect(view.result.current.floorA.get('Root/FloorA/x')?.ty).toBe(5);
  });

  it('leaves out a sibling path that shares the name prefix', () => {
    const view = mountReaders();
    act(() => view.result.current.publish('walk', new Map([['Root/FloorAB/x', at(1)]])));
    expect(view.result.current.floorA.size).toBe(0);
  });
});
