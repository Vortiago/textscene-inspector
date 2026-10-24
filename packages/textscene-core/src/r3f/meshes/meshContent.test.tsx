import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { TscnInternalResource } from '../../parser/types';
import type { SceneResources } from '../SceneResourcesContext';
import type { FontFileResource } from '../../resources/fonts/font/types';
import { MissingResourcesProvider } from '../contexts/MissingResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { useResourceResolution } from '../../resources/useSubOrExtResource';
import { NodePathProvider } from '../contexts/NodePathContext';
import { UndrawnMeshesProvider, useUndrawnMeshTypes } from '../contexts/UndrawnMeshesContext';
import { fixtureFontBytes } from '../controls/native/text/sfntOutlines.testkit';
import { arrayMeshPath, useMeshContent } from './meshContent';

const BOX: TscnInternalResource = { id: 'box', type: 'BoxMesh', data: {} };
const RESOURCES: SceneResources = {
  internalResources: [BOX],
  externalResources: [
    { id: '1', type: 'ArrayMesh', path: 'res:///meshes//rock.tres' },
    { id: '2', type: 'BoxMesh', path: 'res://crate.tres' },
    { id: '3', type: 'PackedScene', path: 'res://rock.glb' },
  ],
};

function seedFiles(fake: FakeResourceLoader): void {
  fake.resources.seed('res://meshes/rock.tres', {
    resourceType: 'ArrayMesh',
    properties: {},
    extResources: [],
    subResources: [],
  });
  fake.resources.seed('res://crate.tres', {
    resourceType: 'BoxMesh',
    properties: { size: 'Vector3(2, 2, 2)' },
    extResources: [],
    subResources: [],
  });
}

function renderResolution(
  meshRef: string | undefined,
  fake: FakeResourceLoader = createFakeResourceLoader()
) {
  return renderHook(
    () => {
      const resolution = useResourceResolution(meshRef, RESOURCES);
      return { ...resolution, arrayMeshPath: arrayMeshPath(resolution) };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      ),
    }
  ).result;
}

describe('arrayMeshPath over a mesh reference', () => {
  it('names the simplified .tres path of an external ArrayMesh', () => {
    const fake = createFakeResourceLoader();
    seedFiles(fake);
    expect(renderResolution('ExtResource("1")', fake).current.arrayMeshPath).toBe('res://meshes/rock.tres');
  });

  it('resolves an external PrimitiveMesh to its file’s resource, with no ArrayMesh path', () => {
    const fake = createFakeResourceLoader();
    seedFiles(fake);
    const resolution = renderResolution('ExtResource("2")', fake).current;
    expect(resolution.scoped?.resource.type).toBe('BoxMesh');
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('resolves a SubResource against the scene, with no ArrayMesh path', () => {
    const resolution = renderResolution('SubResource("box")').current;
    expect(resolution.scoped?.resource).toBe(BOX);
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('is pending while the .tres loads', () => {
    const resolution = renderResolution('ExtResource("2")').current;
    expect(resolution.status).toBe('pending');
    expect(resolution.arrayMeshPath).toBeNull();
  });

  it('is unavailable for a .glb or an unknown id', () => {
    expect(renderResolution('ExtResource("3")').current.status).toBe('unavailable');
    expect(renderResolution('ExtResource("9")').current.status).toBe('unavailable');
  });
});

/** Runs `hook` inside the node at `nodePath`, under a provider that collects undrawn mesh types. */
function renderUnderNode<T>(nodePath: string, hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <UndrawnMeshesProvider>
        <NodePathProvider path={nodePath}>{children}</NodePathProvider>
      </UndrawnMeshesProvider>
    ),
  });
}

describe('useMeshContent for a mesh type no slice builds', () => {
  const FUTURE: TscnInternalResource = { id: 'future', type: 'FutureMesh', data: {} };
  const SCENE: SceneResources = { internalResources: [FUTURE], externalResources: [] };

  it("names the type in the holding node's details", () => {
    const { result } = renderUnderNode('Root/Sign', () => {
      useMeshContent(useResourceResolution('SubResource("future")', SCENE));
      return useUndrawnMeshTypes('Root/Sign');
    });
    expect(result.current).toEqual(['FutureMesh']);
  });
});

const FONT_PATH = 'res://fonts/open-sans.ttf';
const TRUE_TYPE_FILE: FontFileResource = {
  kind: 'file',
  bytes: fixtureFontBytes('open-sans-semibold-subset.ttf'),
  mimeType: 'font/ttf',
  fallbacks: [],
  properties: {},
};
const NOT_AN_SFNT_FILE: FontFileResource = { ...TRUE_TYPE_FILE, bytes: new ArrayBuffer(8) };

describe('useMeshContent for a TextMesh', () => {
  const TEXT: TscnInternalResource = {
    id: 'text',
    type: 'TextMesh',
    data: { text: '"Hi"', font: 'ExtResource("font")', material: 'SubResource("paint")' },
  };
  const PAINT: TscnInternalResource = { id: 'paint', type: 'StandardMaterial3D', data: {} };
  const NO_FONT: TscnInternalResource = { id: 'plain', type: 'TextMesh', data: { text: '"Hi"' } };
  const SCENE: SceneResources = {
    internalResources: [TEXT, PAINT, NO_FONT],
    externalResources: [{ id: 'font', type: 'FontFile', path: FONT_PATH }],
  };

  function renderText(ref: string) {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(
      () => ({
        content: useMeshContent(useResourceResolution(ref, SCENE)),
        undrawn: useUndrawnMeshTypes('Root/Sign'),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MissingResourcesProvider>
            <ResourceLoaderProvider loader={fake.loader}>
              <UndrawnMeshesProvider>
                <NodePathProvider path="Root/Sign">{children}</NodePathProvider>
              </UndrawnMeshesProvider>
            </ResourceLoaderProvider>
          </MissingResourcesProvider>
        ),
      }
    );
    return { fake, result };
  }

  it('loads, and names no undrawn type, while its font file loads', () => {
    const { result } = renderText('SubResource("text")');
    expect(result.current).toEqual({ content: { kind: 'loading' }, undrawn: [] });
  });

  it('draws the glyph outlines of the font once its file and its metrics load, under the mesh own material', async () => {
    const { fake, result } = renderText('SubResource("text")');

    await act(async () => fake.fonts._resolve(FONT_PATH, TRUE_TYPE_FILE));

    const { content, undrawn } = result.current;
    if (content.kind !== 'surfaced') throw new Error(`expected a surfaced mesh, got ${content.kind}`);
    const [part] = content.mesh.parts;
    expect(part.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(part.surfaceIndices).toEqual([0]);
    expect(part.materials[0]).toBeDefined();
    expect(content.mesh.primitive).toBe(TEXT);
    expect(undrawn).toEqual([]);
  });

  it('stays undrawn, and names its type, for a font with no TrueType outlines', async () => {
    const { fake, result } = renderText('SubResource("text")');

    await act(async () => fake.fonts._resolve(FONT_PATH, NOT_AN_SFNT_FILE));

    expect(result.current).toEqual({ content: { kind: 'unresolved' }, undrawn: ['TextMesh'] });
  });

  it('stays undrawn, and names its type, for a font file that failed to load', () => {
    const { fake, result } = renderText('SubResource("text")');

    act(() => fake.fonts._fail(FONT_PATH, 'gone'));

    expect(result.current).toEqual({ content: { kind: 'unresolved' }, undrawn: ['TextMesh'] });
  });

  it('stays undrawn, and names its type, for a TextMesh with no font', () => {
    const { result } = renderText('SubResource("plain")');

    expect(result.current).toEqual({ content: { kind: 'unresolved' }, undrawn: ['TextMesh'] });
  });
});

describe('useMeshContent for a mesh with no surfaces', () => {
  const PLACEHOLDER: TscnInternalResource = { id: 'placeholder', type: 'PlaceholderMesh', data: {} };
  const SCENE: SceneResources = { internalResources: [PLACEHOLDER], externalResources: [] };

  it('is empty, as Godot draws nothing, and names no undrawn type', () => {
    const { result } = renderUnderNode('Root/Stand', () => ({
      content: useMeshContent(useResourceResolution('SubResource("placeholder")', SCENE)),
      undrawn: useUndrawnMeshTypes('Root/Stand'),
    }));
    expect(result.current).toEqual({ content: { kind: 'empty' }, undrawn: [] });
  });
});

describe('useMeshContent for a property that holds no mesh', () => {
  const SCENE: SceneResources = { internalResources: [], externalResources: [] };

  it.each([undefined, 'null', ''])('is none for %j, which Godot draws as nothing', (ref) => {
    const { result } = renderUnderNode('Root/Empty', () => useMeshContent(useResourceResolution(ref, SCENE)));
    expect(result.current).toEqual({ kind: 'none' });
  });

  it('stays unresolved for a mesh the scene lacks, which the previewer cannot draw', () => {
    const { result } = renderUnderNode('Root/Gone', () =>
      useMeshContent(useResourceResolution('SubResource("gone")', SCENE))
    );
    expect(result.current).toEqual({ kind: 'unresolved' });
  });
});
