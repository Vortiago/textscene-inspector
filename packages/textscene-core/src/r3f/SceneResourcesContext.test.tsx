/**
 * SceneResourcesContext, the synchronous resource seam. A nested provider is an
 * instanced sub-scene (ADR-0009): its own resources come first, and the host pool
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
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

const hostInternal: TscnInternalResource[] = [
  { id: 'BoxMesh_host', type: 'BoxMesh', data: {} },
];
const hostExternal: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: 'res://host.png' },
];
const subInternal: TscnInternalResource[] = [
  { id: 'SphereMesh_sub', type: 'SphereMesh', data: {} },
];
const subExternal: TscnExternalResource[] = [
  { id: '1_tex', type: 'Texture2D', path: 'res://sub.png' },
];

describe('SceneResourcesContext', () => {
  it('defaults to empty resource lists outside a provider (degrade, not throw)', () => {
    const { result } = renderHook(() => useSceneResources());
    expect(result.current.internalResources).toEqual([]);
    expect(result.current.externalResources).toEqual([]);
  });

  it('provider supplies internal and external resources (top level, empty parent)', () => {
    const { result } = renderHook(() => useSceneResources(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SceneResourcesProvider
          internalResources={hostInternal}
          externalResources={hostExternal}
        >
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

  it('nested provider (instanced sub-scene) resolves own resources first, then inherits host', () => {
    let hostSeen: SceneResources | null = null;
    let subSeen: SceneResources | null = null;

    function HostProbe() {
      hostSeen = useSceneResources();
      return null;
    }
    function SubProbe() {
      subSeen = useSceneResources();
      return null;
    }

    render(
      <SceneResourcesProvider internalResources={hostInternal} externalResources={hostExternal}>
        <HostProbe />
        <SceneResourcesProvider internalResources={subInternal} externalResources={subExternal}>
          <SubProbe />
        </SceneResourcesProvider>
      </SceneResourcesProvider>
    );

    // Inner subtree sees its own resources first, then the inherited host pool.
    expect(subSeen!.internalResources).toEqual([...subInternal, ...hostInternal]);
    expect(subSeen!.externalResources).toEqual([...subExternal, ...hostExternal]);
    // On a duplicate id ("1_tex"), the sub-scene's own wins on first match.
    expect(subSeen!.externalResources.find((r) => r.id === '1_tex')?.path).toBe('res://sub.png');
    // A host-added child in the sub-scene subtree still reaches a host-only id.
    expect(subSeen!.internalResources).toContainEqual(hostInternal[0]);

    // The sibling outside the inner provider still sees only the host's.
    expect(hostSeen!.internalResources).toEqual(hostInternal);
    expect(hostSeen!.externalResources).toEqual(hostExternal);
  });
});

describe('findSubResource', () => {
  it('matches the structural id field', () => {
    expect(findSubResource(hostInternal, 'BoxMesh_host')).toBe(hostInternal[0]);
  });

  it('matches the runtime data.id key (cross-pipeline compatibility)', () => {
    const viaDataId: TscnInternalResource[] = [
      { id: '3', type: 'StyleBoxFlat', data: { id: 'StyleBoxFlat_a1b2' } },
    ];
    expect(findSubResource(viaDataId, 'StyleBoxFlat_a1b2')).toBe(viaDataId[0]);
    expect(findSubResource(viaDataId, '3')).toBe(viaDataId[0]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findSubResource(hostInternal, 'NoSuchResource')).toBeUndefined();
  });
});
