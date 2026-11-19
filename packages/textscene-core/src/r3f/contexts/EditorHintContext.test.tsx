import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { RunningGameScope, useDrawsEditorOnly, useIsEditorHint } from './EditorHintContext';

function RunningGame({ children }: { children: ReactNode }) {
  return <RunningGameScope>{children}</RunningGameScope>;
}

describe('the editor hint', () => {
  it('holds in the editor with no scope', () => {
    expect(renderHook(() => useIsEditorHint()).result.current).toBe(true);
  });

  it('clears where the game runs', () => {
    expect(renderHook(() => useIsEditorHint(), { wrapper: RunningGame }).result.current).toBe(false);
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
