/**
 * CameraControlContext exposes a `resetCamera`
 * callback that, when fired, drives a registered handler (the canvas's
 * `<GodotEditorControls>` handle's `reset()`). Also pins the pre-existing camera-switch
 * surface (`switchToCamera` / `returnToFreeView` / `activeCameraPath`)
 * so the reset-camera additions don't drift it.
 */
import { useEffect, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import {
  CameraControlProvider,
  useCameraControl,
  useOptionalCameraControl,
} from './CameraControlContext';

function wrapper({ children }: { children: ReactNode }) {
  return <CameraControlProvider>{children}</CameraControlProvider>;
}

describe('CameraControlContext', () => {
  it('exposes activeCameraPath/switchToCamera/returnToFreeView from main', () => {
    const { result } = renderHook(() => useCameraControl(), { wrapper });
    expect(result.current.activeCameraPath).toBeNull();

    act(() => {
      result.current.switchToCamera('Root/Camera3D');
    });
    expect(result.current.activeCameraPath).toBe('Root/Camera3D');

    act(() => {
      result.current.returnToFreeView();
    });
    expect(result.current.activeCameraPath).toBeNull();
  });

  it('exposes resetCamera() that calls the registered handler (WI-UX-7)', () => {
    const handler = vi.fn();

    function ResetHandlerRegistrar() {
      const { registerResetHandler } = useCameraControl();
      useEffect(() => registerResetHandler(handler), [registerResetHandler]);
      return null;
    }

    const { result } = renderHook(
      () => useCameraControl(),
      {
        wrapper: ({ children }) => (
          <CameraControlProvider>
            <ResetHandlerRegistrar />
            {children}
          </CameraControlProvider>
        ),
      }
    );

    expect(handler).not.toHaveBeenCalled();

    act(() => {
      result.current.resetCamera();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resetCamera() is a no-op when no handler is registered', () => {
    const { result } = renderHook(() => useCameraControl(), { wrapper });
    // Should not throw even with no canvas mounted yet.
    expect(() =>
      act(() => {
        result.current.resetCamera();
      })
    ).not.toThrow();
  });

  it('drops the registered handler when the registrar unmounts', () => {
    const handler = vi.fn();

    function ResetHandlerRegistrar() {
      const { registerResetHandler } = useCameraControl();
      useEffect(() => registerResetHandler(handler), [registerResetHandler]);
      return null;
    }

    function TriggerReset() {
      const { resetCamera } = useCameraControl();
      return (
        <button data-testid="trigger" onClick={resetCamera}>
          reset
        </button>
      );
    }

    function App({ showRegistrar }: { showRegistrar: boolean }) {
      return (
        <CameraControlProvider>
          {showRegistrar && <ResetHandlerRegistrar />}
          <TriggerReset />
        </CameraControlProvider>
      );
    }

    const { rerender, getByTestId } = render(<App showRegistrar={true} />);

    act(() => {
      getByTestId('trigger').click();
    });
    expect(handler).toHaveBeenCalledTimes(1);

    // Unmount the registrar — the cleanup should drop the handler.
    rerender(<App showRegistrar={false} />);

    act(() => {
      getByTestId('trigger').click();
    });
    // Still 1 — the handler was unregistered so no additional calls.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('latest registration wins when two registrars overlap', () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function Registrar({ handler }: { handler: () => void }) {
      const { registerResetHandler } = useCameraControl();
      useEffect(() => registerResetHandler(handler), [registerResetHandler, handler]);
      return null;
    }

    function TriggerReset() {
      const { resetCamera } = useCameraControl();
      return (
        <button data-testid="trigger" onClick={resetCamera}>
          reset
        </button>
      );
    }

    const { getByTestId } = render(
      <CameraControlProvider>
        <Registrar handler={firstHandler} />
        <Registrar handler={secondHandler} />
        <TriggerReset />
      </CameraControlProvider>
    );

    act(() => {
      getByTestId('trigger').click();
    });

    // The second registrar's effect runs after the first, so its
    // handler is the active one when reset fires.
    expect(secondHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it('useOptionalCameraControl returns null without a provider', () => {
    const { result } = renderHook(() => useOptionalCameraControl());
    expect(result.current).toBeNull();
  });

  it('useCameraControl throws without a provider', () => {
    // Suppress React's error log for this test — we expect a throw.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCameraControl())).toThrow(/CameraControlProvider/);
    consoleErrorSpy.mockRestore();
  });
});

describe('CameraControlContext — screenshot (#224)', () => {
  it('takeScreenshot() returns the registered handler\'s result', () => {
    const handler = vi.fn(() => 'data:image/png;base64,AAA');

    function ScreenshotHandlerRegistrar() {
      const { registerScreenshotHandler } = useCameraControl();
      useEffect(() => registerScreenshotHandler(handler), [registerScreenshotHandler]);
      return null;
    }

    const { result } = renderHook(() => useCameraControl(), {
      wrapper: ({ children }) => (
        <CameraControlProvider>
          <ScreenshotHandlerRegistrar />
          {children}
        </CameraControlProvider>
      ),
    });

    let captured: string | null = null;
    act(() => {
      captured = result.current.takeScreenshot();
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(captured).toBe('data:image/png;base64,AAA');
  });

  it('takeScreenshot() returns null when no handler is registered (no canvas mounted yet)', () => {
    const { result } = renderHook(() => useCameraControl(), { wrapper });
    let captured: string | null = 'not-null';
    expect(() => {
      act(() => {
        captured = result.current.takeScreenshot();
      });
    }).not.toThrow();
    expect(captured).toBeNull();
  });

  it('drops the registered screenshot handler when the registrar unmounts', () => {
    const handler = vi.fn(() => 'data:image/png;base64,AAA');

    function ScreenshotHandlerRegistrar() {
      const { registerScreenshotHandler } = useCameraControl();
      useEffect(() => registerScreenshotHandler(handler), [registerScreenshotHandler]);
      return null;
    }

    function App({ showRegistrar }: { showRegistrar: boolean }) {
      return (
        <CameraControlProvider>
          {showRegistrar && <ScreenshotHandlerRegistrar />}
          <TriggerScreenshot />
        </CameraControlProvider>
      );
    }
    function TriggerScreenshot() {
      const { takeScreenshot } = useCameraControl();
      return (
        <button data-testid="trigger" onClick={() => takeScreenshot()}>
          screenshot
        </button>
      );
    }

    const { rerender, getByTestId } = render(<App showRegistrar={true} />);
    act(() => {
      getByTestId('trigger').click();
    });
    expect(handler).toHaveBeenCalledTimes(1);

    rerender(<App showRegistrar={false} />);
    act(() => {
      getByTestId('trigger').click();
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
