import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { GizmoScene } from '../testing/GizmoScene';
import { useGizmoDrawn, useGizmoState, type GizmoDrawnFor } from './useGizmoState';

interface Scene {
  showGizmos?: boolean;
  selectedPath?: string | null;
  nodePath?: string | null;
}

function inScene<T>(
  hook: () => T,
  { showGizmos = true, selectedPath = null, nodePath = 'Root/Lamp' }: Scene
): T {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <GizmoScene nodePath={nodePath} selectedPath={selectedPath} showGizmos={showGizmos}>
        {children}
      </GizmoScene>
    );
  }
  return renderHook(hook, { wrapper: Wrapper }).result.current;
}

function stateIn(drawnFor: GizmoDrawnFor, scene: Scene) {
  return inScene(() => useGizmoState(drawnFor), scene);
}

describe('useGizmoState', () => {
  it('is selected for the selected node, whichever nodes the gizmo draws for', () => {
    expect([
      stateIn('every-node', { selectedPath: 'Root/Lamp' }),
      stateIn('selected-only', { selectedPath: 'Root/Lamp' }),
    ]).toEqual(['selected', 'selected']);
  });

  it('is unselected for a gizmo Godot draws for every node', () => {
    expect(stateIn('every-node', { selectedPath: 'Root/Other' })).toBe('unselected');
    expect(stateIn('every-node', { selectedPath: null })).toBe('unselected');
  });

  it('is hidden for an unselected node when Godot draws the gizmo only when selected', () => {
    expect(stateIn('selected-only', { selectedPath: 'Root/Other' })).toBe('hidden');
    expect(stateIn('selected-only', { selectedPath: null })).toBe('hidden');
  });

  it('is hidden for every gizmo, the selected node included, when the Gizmos toggle is off', () => {
    expect([
      stateIn('every-node', { showGizmos: false, selectedPath: 'Root/Lamp' }),
      stateIn('selected-only', { showGizmos: false, selectedPath: 'Root/Lamp' }),
      stateIn('every-node', { showGizmos: false }),
    ]).toEqual(['hidden', 'hidden', 'hidden']);
  });

  it('is hidden outside a node dispatcher, where no path says which node it belongs to', () => {
    expect(stateIn('every-node', { nodePath: null })).toBe('hidden');
  });
});

describe('useGizmoDrawn', () => {
  it('is true when the gizmo has a look to draw and false when it is hidden', () => {
    expect([
      inScene(() => useGizmoDrawn('every-node'), { selectedPath: null }),
      inScene(() => useGizmoDrawn('selected-only'), { selectedPath: 'Root/Lamp' }),
      inScene(() => useGizmoDrawn('selected-only'), { selectedPath: null }),
      inScene(() => useGizmoDrawn('every-node'), { showGizmos: false }),
    ]).toEqual([true, true, false, false]);
  });
});
