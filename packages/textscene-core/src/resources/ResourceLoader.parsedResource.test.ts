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
