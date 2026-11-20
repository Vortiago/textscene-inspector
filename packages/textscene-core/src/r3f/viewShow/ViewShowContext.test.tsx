import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { memo, useState, type ReactNode } from 'react';
import { RunningGameScope } from '../contexts/EditorHintContext';
import { ViewShowProvider, useShowGizmos, useViewShow } from './ViewShowContext';
import type { ViewShow } from './viewShow';

/** Every helper on, and labels and fog off. */
const EVERY_HELPER: ViewShow = {
  grid: true,
  gizmos: true,
  collisions: true,
  labels: false,
  navigation: true,
  previewSun: true,
  previewEnvironment: true,
  fog: false,
  performance: true,
};

function Editor({ children }: { children: ReactNode }) {
  return <ViewShowProvider show={EVERY_HELPER}>{children}</ViewShowProvider>;
}

function RunningGame({ children }: { children: ReactNode }) {
  return (
    <Editor>
      <RunningGameScope>{children}</RunningGameScope>
    </Editor>
  );
}

describe('useViewShow', () => {
  it("draws Godot's editor defaults with no provider", () => {
    expect(renderHook(() => useViewShow()).result.current).toEqual({
      grid: false,
      gizmos: true,
      collisions: false,
      labels: true,
      navigation: true,
      previewSun: true,
      previewEnvironment: true,
      fog: true,
      performance: false,
    });
  });

  it('gives a key the show leaves out its default', () => {
    const { result } = renderHook(() => useViewShow(), {
      wrapper: ({ children }) => <ViewShowProvider show={{ grid: true }}>{children}</ViewShowProvider>,
    });
    expect(result.current).toMatchObject({ grid: true, gizmos: true });
  });

  it('keeps the show in the editor', () => {
    expect(renderHook(() => useViewShow(), { wrapper: Editor }).result.current).toEqual(EVERY_HELPER);
  });

  it('turns every editor helper off where the game runs, whatever the show holds', () => {
    expect(renderHook(() => useViewShow(), { wrapper: RunningGame }).result.current).toMatchObject({
      grid: false,
      gizmos: false,
      collisions: false,
      navigation: false,
      previewSun: false,
      previewEnvironment: false,
    });
  });

  it('draws every Label3D and every fog where the game runs, and keeps the performance panel', () => {
    expect(renderHook(() => useViewShow(), { wrapper: RunningGame }).result.current).toMatchObject({
      labels: true,
      fog: true,
      performance: true,
    });
  });
});

describe('useShowGizmos', () => {
  it('draws no gizmo where the game runs, whatever the show holds', () => {
    expect(renderHook(() => useShowGizmos(), { wrapper: RunningGame }).result.current).toBe(false);
  });

  it('follows the gizmos key in the editor', () => {
    const { result } = renderHook(() => useShowGizmos(), {
      wrapper: ({ children }) => <ViewShowProvider show={{ gizmos: false }}>{children}</ViewShowProvider>,
    });
    expect(result.current).toBe(false);
  });

  it('re-renders a reader for the gizmos key and for no other', () => {
    let gizmoReads = 0;
    const GizmoReader = memo(function GizmoReader() {
      useShowGizmos();
      gizmoReads += 1;
      return null;
    });
    let setShow: (show: Partial<ViewShow>) => void = () => {};
    function Host() {
      const [show, set] = useState<Partial<ViewShow>>({});
      setShow = set;
      return (
        <ViewShowProvider show={show}>
          <GizmoReader />
        </ViewShowProvider>
      );
    }
    render(<Host />);
    const afterMount = gizmoReads;
    act(() => setShow({ grid: true }));
    expect(gizmoReads).toBe(afterMount);
    act(() => setShow({ grid: true, gizmos: false }));
    expect(gizmoReads).toBe(afterMount + 1);
  });

  it('re-renders no reader for a new show object of the same keys', () => {
    let reads = 0;
    // A memo, so only a new context value re-renders it.
    const MemoReader = memo(function Reader() {
      useViewShow();
      reads += 1;
      return null;
    });
    let rerender: () => void = () => {};
    function Host() {
      const [, setTick] = useState(0);
      rerender = () => setTick((tick) => tick + 1);
      return (
        <ViewShowProvider show={{ grid: true }}>
          <MemoReader />
        </ViewShowProvider>
      );
    }
    render(<Host />);
    const afterMount = reads;
    act(() => rerender());
    expect(reads).toBe(afterMount);
  });
});
