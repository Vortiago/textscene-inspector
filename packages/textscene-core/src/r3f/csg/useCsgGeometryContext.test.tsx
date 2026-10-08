import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnNode } from '../../parser/types';
import { MissingResourcesProvider, useMissingResources } from '../contexts/MissingResourcesContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import '../../nodes/3d/csg/csgbox3d/index.r3f';
import '../../nodes/3d/csg/csgmesh3d/index.r3f';
import { useCsgGeometryContext } from './useCsgGeometryContext';

const ROCK = 'res://rock.tres';
const EXT: TscnExternalResource[] = [{ id: '1', type: 'ArrayMesh', path: ROCK }];
const ROCK_FILE: ParsedResource = {
  resourceType: 'ArrayMesh',
  properties: {},
  extResources: [],
  subResources: [],
};

function node(type: string, properties: Record<string, unknown>, children: TscnNode[] = []): TscnNode {
  return {
    rawProperties: {},
    name: type,
    type,
    children,
    properties: { name: type, ...properties } as never,
  };
}

/** A box root holding a CSGMesh3D whose mesh is `rock.tres`. */
const ROOT = node('CSGBox3D', {}, [node('CSGMesh3D', { mesh: 'ExtResource("1")', flipFaces: false })]);

function renderSetup(root: TscnNode, fake: FakeResourceLoader) {
  return renderHook(
    () => ({ setup: useCsgGeometryContext(root), missing: useMissingResources().missingPaths }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MissingResourcesProvider>
          <ResourceLoaderProvider loader={fake.loader}>
            <SceneResourcesProvider externalResources={EXT}>{children}</SceneResourcesProvider>
          </ResourceLoaderProvider>
        </MissingResourcesProvider>
      ),
    }
  ).result;
}

describe('useCsgGeometryContext', () => {
  it('serves the .tres a shape under the root reads, once it loads', () => {
    const fake = createFakeResourceLoader();
    const result = renderSetup(ROOT, fake);
    expect(result.current.setup.isLoading).toBe(true);
    expect(result.current.setup.context.file(ROCK)).toBeUndefined();

    act(() => fake.resources._resolve(ROCK, ROCK_FILE));
    expect(result.current.setup.isLoading).toBe(false);
    expect(result.current.setup.context.file(ROCK)).toBe(ROCK_FILE);
  });

  it('pins the file while mounted', () => {
    const fake = createFakeResourceLoader();
    renderSetup(ROOT, fake);
    expect(fake.resources.pinCounts.get(ROCK)).toBe(1);
  });

  it('reports a file that failed as missing, and stops loading', () => {
    const fake = createFakeResourceLoader();
    const result = renderSetup(ROOT, fake);
    act(() => fake.resources._fail(ROCK, 'gone'));
    expect(result.current.setup.isLoading).toBe(false);
    expect(result.current.setup.context.file(ROCK)).toBeUndefined();
    expect(result.current.missing.has(ROCK)).toBe(true);
  });

  it('reads no file for a subtree of inline shapes', () => {
    const fake = createFakeResourceLoader();
    const result = renderSetup(node('CSGBox3D', {}), fake);
    expect(result.current.setup.isLoading).toBe(false);
    expect(fake.resources.pinCounts.size).toBe(0);
  });
});
