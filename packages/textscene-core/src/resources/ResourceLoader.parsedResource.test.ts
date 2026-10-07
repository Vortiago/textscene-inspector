/**
 * Every processor that takes a resource path reads the `resource` slot's cached
 * ParsedResource. The cache holds one parse and the file on disk says otherwise, so a
 * processor that parsed the text itself would decode the file's values.
 */
import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../parser/parsedResource';
import type { ArrayMeshResource } from './processors/createArrayMeshProcessor';
import type { FontResource } from './fonts/font/types';
import type { ThemeResource } from './styles/theme/types';
import { preloadResource } from './testing/preloadResource';
import { loaderServing } from './testing/servingResourceLoader';
import { busServing } from './testing/servingFileBus';
import { ResourceLoader } from './ResourceLoader';
import { wallQuadSurfaces } from './testing/arrayMeshSurfaces';

const SHARED_PATH = 'res://shared.tres';

const SHARED_TRES = [
  '[gd_resource type="Theme" load_steps=4 format=3]',
  '',
  '[sub_resource type="SystemFont" id="SystemFont_a"]',
  'font_names = PackedStringArray("sans-serif")',
  '',
  '[sub_resource type="ArrayMesh" id="ArrayMesh_a"]',
  `_surfaces = ${wallQuadSurfaces({})}`,
  '',
  '[resource]',
  'default_font_size = 20',
  '',
].join('\n');

/** `SHARED_TRES` as edited on disk after the cached parse. */
const EDITED_TRES = SHARED_TRES.replace('"sans-serif"', '"serif"')
  .replace('id="ArrayMesh_a"', 'id="ArrayMesh_b"')
  .replace('default_font_size = 20', 'default_font_size = 99');

function loaderWithCachedParse() {
  const loader = loaderServing({ [SHARED_PATH]: EDITED_TRES });
  preloadResource(loader, 'resource', SHARED_PATH, parseTresFile(SHARED_TRES));
  return loader;
}

describe('ResourceLoader: processors read the cached ParsedResource', () => {
  it('builds a Theme from the parsed [resource] body', async () => {
    const loader = loaderWithCachedParse();

    const loaded = loader.eventBus.once<ThemeResource>('theme', 'loaded', SHARED_PATH, 2000);
    loader.themes.request(SHARED_PATH);

    expect((await loaded).defaultFontSize).toBe(20);
  });

  it('builds a Font from a parsed sub-resource', async () => {
    const loader = loaderWithCachedParse();
    const address = `${SHARED_PATH}::SystemFont_a`;

    const loaded = loader.eventBus.once<FontResource>('font', 'loaded', address, 2000);
    loader.fonts.request(address);

    expect(await loaded).toEqual({ kind: 'system', fontNames: ['sans-serif'], properties: {} });
  });

  it('builds an ArrayMesh from a parsed sub-resource', async () => {
    const loader = loaderWithCachedParse();
    const address = `${SHARED_PATH}::ArrayMesh_a`;

    const loaded = loader.eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', address, 2000);
    loader.arrayMeshes.request(address);

    expect((await loaded).geometry.getAttribute('position').count).toBe(4);
  });

  it("fails with the cached parse's own reason when that parse failed earlier", async () => {
    const loader = loaderServing({
      'res://scene.tscn': '[gd_scene format=3]\n\n[node name="Root" type="Node"]\n',
    });
    const parseFailed = loader.eventBus.once<Error>('resource', 'failed', 'res://scene.tscn', 2000);
    loader.resources.request('res://scene.tscn');
    const reason = (await parseFailed).message;

    const themeFailed = loader.eventBus.once<Error>('theme', 'failed', 'res://scene.tscn', 2000);
    loader.themes.request('res://scene.tscn');

    expect((await themeFailed).message).toBe(reason);
  });
});

/** Two ArrayMesh sub-resources in one file, as a MeshLibrary's item meshes are. */
const TWO_MESH_PATH = 'res://meshes.tres';
const TWO_MESH_TRES = [
  '[gd_resource type="Resource" load_steps=3 format=3]',
  '',
  '[sub_resource type="ArrayMesh" id="ArrayMesh_a"]',
  `_surfaces = ${wallQuadSurfaces({})}`,
  '',
  '[sub_resource type="ArrayMesh" id="ArrayMesh_b"]',
  `_surfaces = ${wallQuadSurfaces({})}`,
  '',
  '[resource]',
  '',
].join('\n');

/** A Theme whose default font is a sub-resource of its own file. */
const THEME_PATH = 'res://theme.tres';
const THEME_TRES = [
  '[gd_resource type="Theme" load_steps=2 format=3]',
  '',
  '[sub_resource type="SystemFont" id="SystemFont_a"]',
  'font_names = PackedStringArray("serif")',
  '',
  '[resource]',
  'default_font = SubResource("SystemFont_a")',
  '',
].join('\n');

function loaderOverBus() {
  const { bus, provider, loads } = busServing({ [TWO_MESH_PATH]: TWO_MESH_TRES, [THEME_PATH]: THEME_TRES });
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return { loader, loads };
}

function loadMesh(loader: ResourceLoader, address: string): Promise<ArrayMeshResource> {
  const loaded = loader.eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', address, 2000);
  loader.arrayMeshes.request(address);
  return loaded;
}

function loadTheme(loader: ResourceLoader): Promise<ThemeResource> {
  const loaded = loader.eventBus.once<ThemeResource>('theme', 'loaded', THEME_PATH, 2000);
  loader.themes.request(THEME_PATH);
  return loaded;
}

describe('ResourceLoader: a parse lives until every section built from it settles', () => {
  it('drops the parse once the mesh is built, so its `_surfaces` text is not held twice', async () => {
    const { loader } = loaderOverBus();

    await loadMesh(loader, `${TWO_MESH_PATH}::ArrayMesh_a`);

    expect(loader.resources.isCached(TWO_MESH_PATH)).toBe(false);
  });

  it('reads the file once for meshes requested together from it', async () => {
    const { loader, loads } = loaderOverBus();

    await Promise.all([
      loadMesh(loader, `${TWO_MESH_PATH}::ArrayMesh_a`),
      loadMesh(loader, `${TWO_MESH_PATH}::ArrayMesh_b`),
    ]);

    expect(loads).toEqual([TWO_MESH_PATH]);
  });

  it('reads the file once for a Theme and the font it declares beside it', async () => {
    const { loader, loads } = loaderOverBus();

    await loadTheme(loader);

    expect(loads).toEqual([THEME_PATH]);
  });

  it('drops the parse once a Theme and its own font are built', async () => {
    const { loader } = loaderOverBus();

    await loadTheme(loader);

    expect(loader.resources.isCached(THEME_PATH)).toBe(false);
  });
});

describe('ResourceLoader: a parse hold survives a rebuild and a clear', () => {
  /** Re-request `address` on `invalidated` at once, as a mounted `useResource` consumer does. */
  function reRequestOnInvalidated(loader: ResourceLoader, address: string): void {
    loader.eventBus.on('arraymesh', 'invalidated', (key) => {
      if (key === address) loader.arrayMeshes.request(address);
    });
  }

  /** The next `loaded` for `address`, through any `invalidated` before it, which `once` would reject on. */
  function nextLoaded(loader: ResourceLoader, address: string): Promise<void> {
    return new Promise((resolve) => {
      const onLoaded = (key: string) => {
        if (key !== address) return;
        loader.eventBus.off('arraymesh', 'loaded', onLoaded);
        resolve();
      };
      loader.eventBus.on('arraymesh', 'loaded', onLoaded);
    });
  }

  it('drops the parse once a mesh rebuilt by a hot-reload settles', async () => {
    const { loader } = loaderOverBus();
    const address = `${TWO_MESH_PATH}::ArrayMesh_a`;
    reRequestOnInvalidated(loader, address);
    await loadMesh(loader, address);

    const rebuilt = nextLoaded(loader, address);
    loader.provideFile(TWO_MESH_PATH);
    await rebuilt;

    expect(loader.resources.isCached(TWO_MESH_PATH)).toBe(false);
  });

  it('drops the parse of a mesh built after a clear that interrupted a build', async () => {
    const { loader } = loaderOverBus();
    const address = `${TWO_MESH_PATH}::ArrayMesh_a`;
    loader.arrayMeshes.request(address);
    loader.clear();

    await loadMesh(loader, address);

    expect(loader.resources.isCached(TWO_MESH_PATH)).toBe(false);
  });
});
