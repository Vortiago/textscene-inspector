/** The providers and hook of InstanceOwnersContext, and the Gizmos look they decide (`useIsInstantiated`). */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider } from './NodePathContext';
import { InstancedScenePathsProvider } from './InstancedScenePathsContext';
import { EditedRootProvider, InstanceOwnerProvider, useInstanceOwners } from './InstanceOwnersContext';
import { useIsInstantiated } from '../hooks/useIsInstantiated';

const SUB_SCENE = 'res://sub.tscn';

/** The tree the dispatcher builds for the content of the instance `Root/Inst`. */
function insideInstance(editableInstances: readonly string[], nodePath: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <EditedRootProvider editableInstances={editableInstances}>
        <InstanceOwnerProvider path="Inst" editablePaths={[]}>
          <InstancedScenePathsProvider paths={[SUB_SCENE]}>
            <NodePathProvider path={nodePath}>{children}</NodePathProvider>
          </InstancedScenePathsProvider>
        </InstanceOwnerProvider>
      </EditedRootProvider>
    );
  };
}

describe('InstanceOwnersContext', () => {
  it('holds the edited root alone outside every provider', () => {
    const { result } = renderHook(() => useInstanceOwners());
    expect(result.current.map((owner) => owner.level)).toEqual([0]);
  });

  it('adds the instance at the level below the scenes that enclose it', () => {
    const { result } = renderHook(() => useInstanceOwners(), {
      wrapper: insideInstance([], 'Root/Inst/Child'),
    });
    expect(result.current.map((owner) => [owner.level, owner.path])).toEqual([
      [0, ''],
      [1, 'Inst'],
    ]);
  });
});

describe('useIsInstantiated', () => {
  it('is false outside a node dispatcher', () => {
    const { result } = renderHook(() => useIsInstantiated());
    expect(result.current).toBe(false);
  });

  it('is false for a node the edited root authored', () => {
    const { result } = renderHook(() => useIsInstantiated(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NodePathProvider path="Root/Plain">{children}</NodePathProvider>
      ),
    });
    expect(result.current).toBe(false);
  });

  it('is true for a node an instanced scene authored', () => {
    const { result } = renderHook(() => useIsInstantiated(), {
      wrapper: insideInstance([], 'Root/Inst/Child'),
    });
    expect(result.current).toBe(true);
  });

  it('is false once the edited root lists the instance as editable', () => {
    const { result } = renderHook(() => useIsInstantiated(), {
      wrapper: insideInstance(['Inst'], 'Root/Inst/Child'),
    });
    expect(result.current).toBe(false);
  });
});
