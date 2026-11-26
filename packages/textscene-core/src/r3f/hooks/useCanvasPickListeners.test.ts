import { describe, expect, it, vi } from 'vitest';
import { bindCanvasPickListeners } from './useCanvasPickListeners';
import type { ViewportPointerHandlers } from './useViewportSelection';

function spyHandlers(): ViewportPointerHandlers {
  return {
    onCanvasPointerDown: vi.fn(),
    onCanvasClick: vi.fn(),
    onPointerUp: vi.fn(),
    onWindowPointerEnd: vi.fn(),
    onWindowPointerMove: vi.fn(),
  };
}

const pointer = (type: string) => new Event(type);

describe('bindCanvasPickListeners', () => {
  it('hears the press and the click on the canvas', () => {
    const canvas = document.createElement('canvas');
    const handlers = spyHandlers();
    const unbind = bindCanvasPickListeners(canvas, handlers);

    canvas.dispatchEvent(pointer('pointerdown'));
    canvas.dispatchEvent(pointer('click'));
    unbind();

    expect(handlers.onCanvasPointerDown).toHaveBeenCalledOnce();
    expect(handlers.onCanvasClick).toHaveBeenCalledOnce();
  });

  it('hears the release, the cancel and the move on the window, off the canvas too', () => {
    const canvas = document.createElement('canvas');
    const handlers = spyHandlers();
    const unbind = bindCanvasPickListeners(canvas, handlers);

    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointercancel'));
    window.dispatchEvent(pointer('pointermove'));
    unbind();

    expect(handlers.onWindowPointerEnd).toHaveBeenCalledTimes(2);
    expect(handlers.onWindowPointerMove).toHaveBeenCalledOnce();
  });

  it('hears nothing once the remover runs', () => {
    const canvas = document.createElement('canvas');
    const handlers = spyHandlers();
    bindCanvasPickListeners(canvas, handlers)();

    canvas.dispatchEvent(pointer('pointerdown'));
    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointermove'));

    expect(handlers.onCanvasPointerDown).not.toHaveBeenCalled();
    expect(handlers.onWindowPointerEnd).not.toHaveBeenCalled();
    expect(handlers.onWindowPointerMove).not.toHaveBeenCalled();
  });
});
