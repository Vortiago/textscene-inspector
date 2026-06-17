/**
 * Contract tests for SceneResourcesContext: the synchronous SubResource /
 * ExtResource seam node components read instead of the async useResource hook.
 *
 * The nested-provider case is the instancing case (ADR-0009's two explicit
 * mounts): an instanced sub-scene mounts its OWN SceneResourcesProvider so its
 * nodes resolve refs against the sub-scene's resources FIRST, while inheriting
 * the host pool as a fallback (ADR-0013) so host-added children parented under
 * a collapsed instance can still resolve their host ExtResource ids.
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
    // Top-level provider inherits the EMPTY default, so the resolved pool is
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

    // Inner subtree sees its OWN resources first, then the inherited host pool.
    expect(subSeen!.internalResources).toEqual([...subInternal, ...hostInternal]);
    expect(subSeen!.externalResources).toEqual([...subExternal, ...hostExternal]);
    // Precedence: on a duplicate id ("1_tex"), the sub-scene's own wins via
    // first-match, so the sub-scene never accidentally picks up host content.
    expect(subSeen!.externalResources.find((r) => r.id === '1_tex')?.path).toBe('res://sub.png');
    // A host-added child sitting in the sub-scene subtree can still reach a
    // host-only id (the lamps/doors regression) — host resources are present.
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
