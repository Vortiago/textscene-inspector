/**
 * The forced-rect registry. Its behaviour is the same shape as
 * `ViewportTextureContext`'s, but two properties are load-bearing here in a way
 * they are not there, because the publisher is a `ResizeObserver`:
 *
 *  - an unchanged measurement must not produce a new map, or every layout pass
 *    re-renders the sub-viewport and re-allocates its render target;
 *  - "no rect" must stay distinguishable from "a rect of zero", because the
 *    consumer falls back to the authored `size` on the former.
 */

import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';

import {
  ViewportRectProvider,
  useRegisterViewportRect,
  useViewportRect,
  type ViewportRect,
} from './ViewportRectContext';

/** Renders the rect at `path`, and counts how often it re-rendered. */
function Reader({ path, onRender }: { path: string; onRender?: (r: ViewportRect | null) => void }) {
  const rect = useViewportRect(path);
  useEffect(() => {
    onRender?.(rect);
  });
  return <span data-testid="rect">{rect ? `${rect.x}x${rect.y}` : 'none'}</span>;
}

/** Exposes the register function so a test can drive it like an observer would. */
function Publisher({ onReady }: { onReady: (fn: ReturnType<typeof useRegisterViewportRect>) => void }) {
  const register = useRegisterViewportRect();
  useEffect(() => onReady(register), [register, onReady]);
  return null;
}

function mount(children: ReactNode) {
  return render(<ViewportRectProvider>{children}</ViewportRectProvider>);
}

describe('ViewportRectContext', () => {
  it('a consumer sees no rect until one is published', () => {
    const { getByTestId } = mount(<Reader path="Booth/View" />);
    expect(getByTestId('rect').textContent).toBe('none');
  });

  it('publishes a rect to the consumer at the same path', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" />
      </>
    );
    act(() => {
      register('Booth/View', { x: 572, y: 648 });
    });
    expect(getByTestId('rect').textContent).toBe('572x648');
  });

  it('scopes by path — another surface’s rect is not this one’s', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" />
      </>
    );
    act(() => {
      register('Other/View', { x: 10, y: 10 });
    });
    expect(getByTestId('rect').textContent).toBe('none');
  });

  /**
   * The one that matters for the ResizeObserver: it fires on every layout
   * pass, and a fresh Map per call would re-render the sub-viewport and
   * re-create its render target each time.
   */
  it('does not re-render a consumer when the measurement is unchanged', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const seen: (ViewportRect | null)[] = [];
    mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" onRender={(r) => seen.push(r)} />
      </>
    );
    act(() => {
      register('Booth/View', { x: 572, y: 648 });
    });
    const afterFirst = seen.length;
    act(() => {
      register('Booth/View', { x: 572, y: 648 });
      register('Booth/View', { x: 572, y: 648 });
    });
    expect(seen.length).toBe(afterFirst);
  });

  it('does re-render when the measurement actually changes', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" />
      </>
    );
    act(() => {
      register('Booth/View', { x: 572, y: 648 });
    });
    act(() => {
      register('Booth/View', { x: 300, y: 200 });
    });
    expect(getByTestId('rect').textContent).toBe('300x200');
  });

  it('unregisters on cleanup, so the consumer falls back again', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" />
      </>
    );
    let release!: () => void;
    act(() => {
      release = register('Booth/View', { x: 572, y: 648 });
    });
    act(() => {
      release();
    });
    expect(getByTestId('rect').textContent).toBe('none');
  });

  /** Null-safe without a provider, like every other registry in this layer. */
  it('mounts without a provider at all', () => {
    const { getByTestId } = render(<Reader path="Booth/View" />);
    expect(getByTestId('rect').textContent).toBe('none');
  });

  it('a zero-sized rect is still a rect, not an absence', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Reader path="Booth/View" />
      </>
    );
    act(() => {
      register('Booth/View', { x: 0, y: 0 });
    });
    expect(getByTestId('rect').textContent).toBe('0x0');
  });
});

describe('a sub-viewport sized by a forced rect', () => {
  /**
   * The consumer's whole contract, stated where both halves are visible: the
   * forced rect wins when there is one, and the authored `size` stands when
   * there is not — which is Godot's early return for a non-stretching
   * container, and the only behaviour for a sub-viewport with no container.
   */
  function Sized({ path, authored }: { path: string; authored: ViewportRect }) {
    const forced = useViewportRect(path);
    const [x, y] = [forced?.x ?? authored.x, forced?.y ?? authored.y];
    return <span data-testid="size">{`${x}x${y}`}</span>;
  }

  it('falls back to the authored size when no container forced one', () => {
    const { getByTestId } = mount(
      <Sized path="Booth/View" authored={{ x: 399, y: 480 }} />
    );
    expect(getByTestId('size').textContent).toBe('399x480');
  });

  it('prefers the forced rect once the container publishes it', () => {
    let register!: ReturnType<typeof useRegisterViewportRect>;
    const { getByTestId } = mount(
      <>
        <Publisher onReady={(fn) => (register = fn)} />
        <Sized path="Booth/View" authored={{ x: 399, y: 480 }} />
      </>
    );
    act(() => {
      register('Booth/View', { x: 572, y: 648 });
    });
    expect(getByTestId('size').textContent).toBe('572x648');
  });
});
