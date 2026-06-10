/**
 * Contract tests for SceneResourcesContext: the synchronous SubResource /
 * ExtResource seam node components read instead of the async useResource hook.
 *
 * The nested-provider override is the instancing case (ADR-0009's two explicit
 * mounts): an instanced sub-scene mounts its OWN SceneResourcesProvider so its
 * nodes resolve refs against the sub-scene's resources, not the host scene's.
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

  it('provider supplies internal and external resources by identity', () => {
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
    expect(result.current.internalResources).toBe(hostInternal);
    expect(result.current.externalResources).toBe(hostExternal);
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

  it('nested provider (instanced sub-scene) overrides for its subtree only', () => {
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

    // Inner subtree resolves against the sub-scene's resources…
    expect(subSeen!.internalResources).toBe(subInternal);
    expect(subSeen!.externalResources).toBe(subExternal);
    // …while the sibling outside the inner provider still sees the host's,
    // even though both scenes use the same ExtResource id ("1_tex").
    expect(hostSeen!.internalResources).toBe(hostInternal);
    expect(hostSeen!.externalResources).toBe(hostExternal);
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
