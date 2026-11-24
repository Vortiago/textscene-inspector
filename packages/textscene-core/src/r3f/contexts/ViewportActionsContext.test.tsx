import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { ViewportActionsProvider, useOptionalViewportActions } from './ViewportActionsContext';
import {
  RegisteredFreelook,
  useViewportActions,
  viewportActionsProbe,
} from '../testing/ViewportActionsProbe';
import { Freelook, type FreelookControl } from '../freelook';

/** A canvas's freelook whose toggle the browser always grants. */
function grantedFreelook(freelook = new Freelook()): FreelookControl {
  return {
    toggle: () => freelook.setToggled(!freelook.isToggled),
    getState: freelook.getState,
    subscribe: freelook.subscribe,
  };
}

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

  it('drops the registered freelook when the canvas unmounts', () => {
    const control = grantedFreelook();
    const probe = viewportActionsProbe();
    const { rerender } = render(
      <ViewportActionsProvider>
        <probe.Probe />
        <RegisteredFreelook control={control} />
      </ViewportActionsProvider>
    );
    expect(probe.actions().freelookState()).toEqual(control.getState());

    rerender(
      <ViewportActionsProvider>
        <probe.Probe />
      </ViewportActionsProvider>
    );

    expect(probe.actions().freelookState()).toBeNull();
  });

  it('keeps the latest registration when two canvases overlap', () => {
    const first = grantedFreelook();
    const second = grantedFreelook();
    const probe = viewportActionsProbe();

    render(
      <ViewportActionsProvider>
        <probe.Probe />
        <RegisteredFreelook control={first} />
        <RegisteredFreelook control={second} />
      </ViewportActionsProvider>
    );
    act(() => second.toggle());

    expect(probe.actions().freelookState()?.isToggled).toBe(true);
  });

  it('useOptionalViewportActions returns null without a provider', () => {
    const { result } = renderHook(() => useOptionalViewportActions());
    expect(result.current).toBeNull();
  });
});
