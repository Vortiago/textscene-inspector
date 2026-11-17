import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { RunningGameScope, useDrawsEditorOnly, useIsEditorHint } from './EditorHintContext';
import { ViewportModeProvider, useShowGizmos, useViewportMode } from './ViewportModeContext';

/** The toolbar with every editor overlay and preview on, and labels and fog off. */
function EditorToolbar({ children }: { children: ReactNode }) {
  return (
    <ViewportModeProvider
      initialShowCollisions
      initialShowNavigation
      initialShowGizmos
      initialShowGrid
      initialShowPreviewSun
      initialShowPreviewEnvironment
      initialFrameOnOpen
      initialShowLabels={false}
      initialShowFog={false}
    >
      {children}
    </ViewportModeProvider>
  );
}

function RunningGame({ children }: { children: ReactNode }) {
  return (
    <EditorToolbar>
      <RunningGameScope>{children}</RunningGameScope>
    </EditorToolbar>
  );
}

describe('the editor hint', () => {
  it('holds in the editor with no scope', () => {
    expect(renderHook(() => useIsEditorHint()).result.current).toBe(true);
  });

  it('clears where the game runs', () => {
    expect(renderHook(() => useIsEditorHint(), { wrapper: RunningGame }).result.current).toBe(false);
  });
});

describe('useViewportMode where the game runs', () => {
  it('turns every editor overlay and preview off, whatever the toolbar holds', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: RunningGame });
    expect(result.current).toMatchObject({
      showCollisions: false,
      showNavigation: false,
      showGizmos: false,
      showGrid: false,
      showPreviewSun: false,
      showPreviewEnvironment: false,
      frameOnOpen: false,
    });
  });

  it('draws every Label3D and every fog, which only the toolbar hides', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: RunningGame });
    expect(result.current).toMatchObject({ showLabels: true, showFog: true });
  });

  it("keeps the toolbar's toggles in the editor", () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: EditorToolbar });
    expect(result.current).toMatchObject({ showGizmos: true, showLabels: false });
  });
});

describe('useShowGizmos', () => {
  it('draws no gizmo where the game runs, whatever the toolbar holds', () => {
    expect(renderHook(() => useShowGizmos(), { wrapper: RunningGame }).result.current).toBe(false);
  });

  it("follows the toolbar's Gizmos toggle in the editor", () => {
    expect(renderHook(() => useShowGizmos(), { wrapper: EditorToolbar }).result.current).toBe(true);
  });
});

describe('useDrawsEditorOnly', () => {
  it('draws a node without the flag where the game runs', () => {
    expect(renderHook(() => useDrawsEditorOnly(false), { wrapper: RunningGame }).result.current).toBe(true);
  });

  it('draws no editor-only node where the game runs', () => {
    expect(renderHook(() => useDrawsEditorOnly(true), { wrapper: RunningGame }).result.current).toBe(false);
  });

  it('draws an editor-only node in the editor', () => {
    expect(renderHook(() => useDrawsEditorOnly(true)).result.current).toBe(true);
  });
});
