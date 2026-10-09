/**
 * SceneResourcesContext, the synchronous resource seam. A nested provider is an
 * instanced sub-scene (ADR-0009): its own ids shadow the host's, and the host pool
 * stays as a fallback for host-added children (ADR-0013).
 */
import { describe, expect, it } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SceneResourcesProvider,
  useSceneResources,
  findSubResource,
  type SceneResources,
} from './SceneResourcesContext';
import { findExtResource } from '../resources/SubResourceResolver';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

const hostInternal: TscnInternalResource[] = [{ id: 'BoxMesh_host', type: 'BoxMesh', data: {} }];
const hostExternal: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: 'res://host.png' },
  { id: '2_host', type: 'Texture2D', path: 'res://host-only.png' },
];
const subInternal: TscnInternalResource[] = [{ id: 'SphereMesh_sub', type: 'SphereMesh', data: {} }];
const subExternal: TscnExternalResource[] = [{ id: '1_tex', type: 'Texture2D', path: 'res://sub.png' }];

describe('SceneResourcesContext', () => {
  it('defaults to empty resource lists outside a provider (degrade, not throw)', () => {
    const { result } = renderHook(() => useSceneResources());
    expect(result.current.internalResources).toEqual([]);
    expect(result.current.externalResources).toEqual([]);
  });

  it('provider supplies internal and external resources (top level, empty parent)', () => {
    const { result } = renderHook(() => useSceneResources(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SceneResourcesProvider internalResources={hostInternal} externalResources={hostExternal}>
          {children}
        </SceneResourcesProvider>
      ),
    });
    // Top-level provider inherits the empty default, so the resolved pool is
    // exactly the supplied resources.
    expect(result.current.internalResources).toEqual(hostInternal);
    expect(result.current.externalResources).toEqual(hostExternal);
  });

  it('omitted props default to empty arrays', () => {
    const { result } = renderHook(() => useSceneResources(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SceneResourcesProvider>{children}</SceneResourcesProvider>
      ),
    });
    expect(result.current.internalResources).toEqual([]);
    expect(result.current.externalResources).toEqual([]);
  });

  it('nested provider (instanced sub-scene) resolves a shared external id to its own', () => {
    const seen = nestedPools(subExternal);
    expect(findExtResource(seen.sub.externalResources, '1_tex')?.path).toBe('res://sub.png');
  });

  it('nested provider resolves an id its own file repeats to the last declaration (edge case)', () => {
    const repeated: TscnExternalResource[] = [
      { id: '1_tex', type: 'Texture2D', path: 'res://first.png' },
      { id: '1_tex', type: 'Texture2D', path: 'res://last.png' },
    ];
    const seen = nestedPools(repeated);
    expect(findExtResource(seen.sub.externalResources, '1_tex')?.path).toBe('res://last.png');
  });

  it('nested provider resolves a shared internal id to its own', () => {
    const shared: TscnInternalResource[] = [{ id: 'BoxMesh_host', type: 'SphereMesh', data: {} }];
    const seen = nestedPools(subExternal, shared);
    expect(findSubResource(seen.sub.internalResources, 'BoxMesh_host')?.type).toBe('SphereMesh');
  });

  it('nested provider still reaches a host-only id, for a child the host added', () => {
    const seen = nestedPools(subExternal);
    expect(findSubResource(seen.sub.internalResources, 'BoxMesh_host')).toBe(hostInternal[0]);
    expect(findExtResource(seen.sub.externalResources, '2_host')?.path).toBe('res://host-only.png');
  });

  it('a sibling outside the nested provider sees only the host pool', () => {
    const seen = nestedPools(subExternal);
    expect(seen.host.internalResources).toEqual(hostInternal);
    expect(seen.host.externalResources).toEqual(hostExternal);
  });
});

/** The pools a host probe and an instanced sub-scene's probe each see. */
function nestedPools(
  subExternalResources: readonly TscnExternalResource[],
  subInternalResources: readonly TscnInternalResource[] = subInternal
): { host: SceneResources; sub: SceneResources } {
  const seen: Partial<Record<'host' | 'sub', SceneResources>> = {};
  function Probe({ name }: { name: 'host' | 'sub' }) {
    seen[name] = useSceneResources();
    return null;
  }
  render(
    <SceneResourcesProvider internalResources={hostInternal} externalResources={hostExternal}>
      <Probe name="host" />
      <SceneResourcesProvider
        internalResources={subInternalResources}
        externalResources={subExternalResources}
      >
        <Probe name="sub" />
      </SceneResourcesProvider>
    </SceneResourcesProvider>
  );
  return { host: seen.host!, sub: seen.sub! };
}

describe('findSubResource', () => {
  it('matches the structural id field', () => {
    expect(findSubResource(hostInternal, 'BoxMesh_host')).toBe(hostInternal[0]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findSubResource(hostInternal, 'NoSuchResource')).toBeUndefined();
  });
});
