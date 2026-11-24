/**
 * `resetCamera` drives the registered handler, the `reset()` of the canvas's
 * `<GodotEditorControls>`. The camera switch (`previewCamera`,
 * `endCameraPreview`, `previewedCameraPath`) and the 2D framing claim are pinned too.
 */
import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { ViewportActionsProvider, useOptionalViewportActions } from './ViewportActionsContext';
import { useViewportActions } from '../testing/ViewportActionsProbe';

function wrapper({ children }: { children: ReactNode }) {
  return <ViewportActionsProvider>{children}</ViewportActionsProvider>;
}

describe('ViewportActionsContext', () => {
  it('exposes previewedCameraPath/previewCamera/endCameraPreview from main', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    expect(result.current.previewedCameraPath).toBeNull();

    act(() => {
      result.current.previewCamera('Root/Camera3D');
    });
    expect(result.current.previewedCameraPath).toBe('Root/Camera3D');

    act(() => {
      result.current.endCameraPreview();
    });
    expect(result.current.previewedCameraPath).toBeNull();
  });

  it('seeds previewedCameraPath from initialPreviewedCameraPath (?camera= deep-link)', () => {
    const { result } = renderHook(() => useViewportActions(), {
      wrapper: ({ children }) => (
        <ViewportActionsProvider initialPreviewedCameraPath="Root/Camera3D">
          {children}
        </ViewportActionsProvider>
      ),
    });
    // The canvas looks through this camera on open without any user action.
    expect(result.current.previewedCameraPath).toBe('Root/Camera3D');

    // Ending the preview still clears it, since the seed is only the initial value.
    act(() => {
      result.current.endCameraPreview();
    });
    expect(result.current.previewedCameraPath).toBeNull();
  });

  it('defaults previewedCameraPath to null when no initial path is given', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    expect(result.current.previewedCameraPath).toBeNull();
  });

  it('exposes resetCamera() that calls the registered handler (WI-UX-7)', () => {
    const handler = vi.fn();

    function ResetHandlerRegistrar() {
      const { registerResetHandler } = useViewportActions();
      useEffect(() => registerResetHandler(handler), [registerResetHandler]);
      return null;
    }

    const { result } = renderHook(() => useViewportActions(), {
      wrapper: ({ children }) => (
        <ViewportActionsProvider>
          <ResetHandlerRegistrar />
          {children}
        </ViewportActionsProvider>
      ),
    });

    expect(handler).not.toHaveBeenCalled();

    act(() => {
      result.current.resetCamera();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resetCamera() ends a camera preview, so the reset pose is the one on screen', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    act(() => {
      result.current.previewCamera('Root/Camera3D');
    });

    act(() => {
      result.current.resetCamera();
    });

    expect(result.current.previewedCameraPath).toBeNull();
  });

  it('resetCamera() is a no-op when no handler is registered', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    // No throw with no canvas mounted yet.
    expect(() =>
      act(() => {
        result.current.resetCamera();
      })
    ).not.toThrow();
  });

  it('drops the registered handler when the registrar unmounts', () => {
    const handler = vi.fn();

    function ResetHandlerRegistrar() {
      const { registerResetHandler } = useViewportActions();
      useEffect(() => registerResetHandler(handler), [registerResetHandler]);
      return null;
    }

    function TriggerReset() {
      const { resetCamera } = useViewportActions();
      return (
        <button data-testid="trigger" onClick={resetCamera}>
          reset
        </button>
      );
    }

    function App({ showRegistrar }: { showRegistrar: boolean }) {
      return (
        <ViewportActionsProvider>
          {showRegistrar && <ResetHandlerRegistrar />}
          <TriggerReset />
        </ViewportActionsProvider>
      );
    }

    const { rerender, getByTestId } = render(<App showRegistrar={true} />);

    act(() => {
      getByTestId('trigger').click();
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // The registrar's unmount drops the handler.
    rerender(<App showRegistrar={false} />);

    act(() => {
      getByTestId('trigger').click();
    });
    // Still 1, since the handler is unregistered.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('latest registration wins when two registrars overlap', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function Registrar({ handler }: { handler: () => void }) {
      const { registerResetHandler } = useViewportActions();
      useEffect(() => registerResetHandler(handler), [registerResetHandler, handler]);
      return null;
    }

    function TriggerReset() {
      const { resetCamera } = useViewportActions();
      return (
        <button data-testid="trigger" onClick={resetCamera}>
          reset
        </button>
      );
    }

    const { getByTestId } = render(
      <ViewportActionsProvider>
        <Registrar handler={firstHandler} />
        <Registrar handler={secondHandler} />
        <TriggerReset />
      </ViewportActionsProvider>
    );

    act(() => {
      getByTestId('trigger').click();
    });

    // The second registrar's effect runs after the first, so its
    // handler is the active one when reset fires.
    expect(secondHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it('lets a 2D framing request be claimed once, however many stages ask', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    act(() => {
      result.current.requestFrame2D({ center: { x: 1, y: 2 }, zoom: 1 });
    });
    const { requestId } = result.current.frame2D!;

    expect(result.current.claimFrame2D(requestId)).toBe(true);
    expect(result.current.claimFrame2D(requestId)).toBe(false);
  });

  it('lets a newer 2D framing request be claimed after an older one', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    act(() => {
      result.current.requestFrame2D({ center: { x: 1, y: 2 }, zoom: 1 });
    });
    result.current.claimFrame2D(result.current.frame2D!.requestId);

    act(() => {
      result.current.requestFrame2D({ center: { x: 1, y: 2 }, zoom: 1 });
    });

    expect(result.current.claimFrame2D(result.current.frame2D!.requestId)).toBe(true);
  });

  it('refuses to claim a request id no request carries', () => {
    const { result } = renderHook(() => useViewportActions(), { wrapper });
    expect(result.current.claimFrame2D(0)).toBe(false);
  });

  it('useOptionalViewportActions returns null without a provider', () => {
    const { result } = renderHook(() => useOptionalViewportActions());
    expect(result.current).toBeNull();
  });
});
