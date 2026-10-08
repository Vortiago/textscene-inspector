import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { parseTresFile } from '../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader, type FakeResourceLoader } from './testing/createFakeResourceLoader';
import { useResourceResolution, useSubOrExtResource } from './useSubOrExtResource';

const INLINE: TscnInternalResource = { id: 'mm', type: 'MultiMesh', data: { instance_count: '2' } };
const SCENE_EXT: TscnExternalResource[] = [
  { id: '1', type: 'MultiMesh', path: 'res://grass.tres' },
  { id: '2', type: 'MultiMesh', path: 'res://grass.res' },
];
const SCENE = { internalResources: [INLINE], externalResources: SCENE_EXT };
const TRES = parseTresFile(`[gd_resource type="MultiMesh" load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[resource]
mesh = SubResource("BoxMesh_1")
`);

function renderResolution(ref: string | undefined, fake: FakeResourceLoader = createFakeResourceLoader()) {
  return renderHook(() => useResourceResolution(ref, SCENE), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  }).result;
}

function renderScoped(ref: string | undefined, fake: FakeResourceLoader = createFakeResourceLoader()) {
  return renderHook(() => useSubOrExtResource(ref, SCENE), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    ),
  }).result;
}

describe('useSubOrExtResource', () => {
  it('scopes a SubResource to the pools it resolves in', () => {
    const scoped = renderScoped('SubResource("mm")').current!;
    expect(scoped.resource).toBe(INLINE);
    expect(scoped.resources).toBe(SCENE);
  });

  it('scopes a loaded .tres to the file’s own pools', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://grass.tres', TRES);
    const scoped = renderScoped('ExtResource("1")', fake).current!;
    expect(scoped.resource).toMatchObject({ id: 'res://grass.tres', type: 'MultiMesh' });
    expect(scoped.resources.internalResources.map((resource) => resource.id)).toEqual(['BoxMesh_1']);
  });

  it('is null while the .tres loads', () => {
    expect(renderScoped('ExtResource("1")').current).toBeNull();
  });

  it('is null for a binary .res, which no processor reads', () => {
    expect(renderScoped('ExtResource("2")').current).toBeNull();
  });

  it('is null for no reference', () => {
    expect(renderScoped(undefined).current).toBeNull();
  });
});

describe('useResourceResolution', () => {
  it('is loaded once the .tres has loaded', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed('res://grass.tres', TRES);
    expect(renderResolution('ExtResource("1")', fake).current.status).toBe('loaded');
  });

  it('is pending while the .tres loads', () => {
    expect(renderResolution('ExtResource("1")').current).toEqual({ scoped: null, status: 'pending' });
  });

  it('is unavailable for a binary .res, never pending', () => {
    expect(renderResolution('ExtResource("2")').current).toEqual({ scoped: null, status: 'unavailable' });
  });
});
