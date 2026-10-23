import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { SelectSeeder } from '../testing/SelectSeeder';
import { useGizmoState, type GizmoDrawnFor } from './useGizmoState';

interface Scene {
  showGizmos?: boolean;
  selectedPath?: string | null;
  nodePath?: string | null;
}

function stateIn(
  drawnFor: GizmoDrawnFor,
  { showGizmos = true, selectedPath = null, nodePath = 'Root/Lamp' }: Scene
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const inNode =
      nodePath === null ? children : <NodePathProvider path={nodePath}>{children}</NodePathProvider>;
    return (
      <ViewportModeProvider initialShowGizmos={showGizmos}>
        <SelectionProvider>
          <SelectSeeder path={selectedPath} />
          {inNode}
        </SelectionProvider>
      </ViewportModeProvider>
    );
  }
  return renderHook(() => useGizmoState(drawnFor), { wrapper: Wrapper }).result.current;
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
