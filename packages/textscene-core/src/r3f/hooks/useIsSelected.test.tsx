import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GizmoScene } from '../testing/GizmoScene';
import { useIsSelected } from './useIsSelected';

function isSelectedIn(nodePath: string | null, selectedPath: string | null): boolean {
  return renderHook(() => useIsSelected(), {
    wrapper: ({ children }) => (
      <GizmoScene nodePath={nodePath} selectedPath={selectedPath}>
        {children}
      </GizmoScene>
    ),
  }).result.current;
}

describe('useIsSelected', () => {
  it('is true for the node the tree selects', () => {
    expect(isSelectedIn('Root/Lamp', 'Root/Lamp')).toBe(true);
  });

  it.each([
    ['nothing is selected', 'Root/Lamp', null],
    ['another node is selected', 'Root/Lamp', 'Root/Other'],
    ['no node owns the hook', null, 'Root/Lamp'],
  ])('is false when %s', (_label, nodePath, selectedPath) => {
    expect(isSelectedIn(nodePath, selectedPath)).toBe(false);
  });

  it('is false outside a selection provider', () => {
    expect(renderHook(() => useIsSelected()).result.current).toBe(false);
  });
});
