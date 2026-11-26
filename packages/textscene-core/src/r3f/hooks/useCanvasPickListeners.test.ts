import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanvasPickListeners } from './useCanvasPickListeners';
import type { ViewportPointerHandlers } from './useViewportSelection';

const canvas = document.createElement('canvas');

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { gl: { domElement: HTMLCanvasElement } }) => unknown) =>
    select({ gl: { domElement: canvas } }),
}));

function spyHandlers(): ViewportPointerHandlers {
  return {
    onCanvasPointerDown: vi.fn(),
    onCanvasClick: vi.fn(),
    onPointerDown: vi.fn(),
    onWindowPointerEnd: vi.fn(),
    onWindowPointerMove: vi.fn(),
  };
}

const pointer = (type: string) => new Event(type);

describe('useCanvasPickListeners', () => {
  afterEach(() => vi.clearAllMocks());

  it('hears the press and the click on the canvas', () => {
    const handlers = spyHandlers();
    const { unmount } = renderHook(() => useCanvasPickListeners(handlers));

    canvas.dispatchEvent(pointer('pointerdown'));
    canvas.dispatchEvent(pointer('click'));
    unmount();

    expect(handlers.onCanvasPointerDown).toHaveBeenCalledOnce();
    expect(handlers.onCanvasClick).toHaveBeenCalledOnce();
  });

  it('hears the release, the cancel and the move on the window, off the canvas too', () => {
    const handlers = spyHandlers();
    const { unmount } = renderHook(() => useCanvasPickListeners(handlers));

    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointercancel'));
    window.dispatchEvent(pointer('pointermove'));
    unmount();

    expect(handlers.onWindowPointerEnd).toHaveBeenCalledTimes(2);
    expect(handlers.onWindowPointerMove).toHaveBeenCalledOnce();
  });

  it('hears nothing once unmounted', () => {
    const handlers = spyHandlers();
    renderHook(() => useCanvasPickListeners(handlers)).unmount();

    canvas.dispatchEvent(pointer('pointerdown'));
    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointermove'));

    expect(handlers.onCanvasPointerDown).not.toHaveBeenCalled();
    expect(handlers.onWindowPointerEnd).not.toHaveBeenCalled();
    expect(handlers.onWindowPointerMove).not.toHaveBeenCalled();
  });

  it('binds nothing for no handlers', () => {
    const spy = vi.spyOn(canvas, 'addEventListener');
    const { unmount } = renderHook(() => useCanvasPickListeners(null));
    unmount();

    expect(spy).not.toHaveBeenCalled();
  });
});
