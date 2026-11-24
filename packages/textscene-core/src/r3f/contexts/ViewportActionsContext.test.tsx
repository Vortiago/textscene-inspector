import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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

  it('useOptionalViewportActions returns null without a provider', () => {
    const { result } = renderHook(() => useOptionalViewportActions());
    expect(result.current).toBeNull();
  });
});
