/**
 * `provideFile` reaches a mounted consumer on every bus: a changed file shows its new
 * value, a file that arrives late loads, and a removed file becomes unavailable. The
 * loader re-requests nothing itself, so each case also proves that the consumer's own
 * answer to `invalidated` is enough.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { TscnScene } from '../parser/types';
import type { ParsedResource } from '../parser/parsedResource';
import type { ResourceType } from './ResourceEventBus';
import type { ArrayMeshResource } from './processors/createArrayMeshProcessor';
import type { FontVariationResource } from './fonts/font/types';
import type { ThemeResource } from './styles/theme/types';
import { createTextureFromBuffer } from './formats/image/textureProcessing';
import { triangleGlb } from './formats/glb/testing/triangleGlb';
import { wallQuadSurfaces } from './testing/arrayMeshSurfaces';
import { createHotReloadHarness, expectShown, mountProbe, provide } from './testing/hotReloadHarness';

vi.mock('./formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./formats/image/textureProcessing')>();
  return { ...actual, createTextureFromBuffer: vi.fn() };
});

// happy-dom decodes no image, so the decode names the texture after the file's first byte.
vi.mocked(createTextureFromBuffer).mockImplementation(async (data: ArrayBuffer) => {
  const texture = new THREE.Texture();
  texture.name = String(new Uint8Array(data)[0]);
  return texture;
});

const scene = (rootName: string) => `[gd_scene format=3]\n\n[node name="${rootName}" type="Node3D"]\n`;
const resource = (label: string) =>
  `[gd_resource type="Resource" format=3]\n\n[resource]\nlabel = "${label}"\n`;
const arrayMesh = (surfaceCount: number) =>
  `[gd_resource type="ArrayMesh" format=4]\n\n[resource]\n_surfaces = ${wallQuadSurfaces(
    ...Array.from({ length: surfaceCount }, () => ({}))
  )}\nblend_shape_mode = 0\n`;
const fontVariation = (spacing: number) =>
  `[gd_resource type="FontVariation" format=3]\n\n[resource]\nspacing_glyph = ${spacing}\n`;
const theme = (size: number) =>
  `[gd_resource type="Theme" format=3]\n\n[resource]\ndefault_font_size = ${size}\n`;
const png = (firstByte: number) => new Uint8Array([firstByte, 0, 0, 0]).buffer;
const glb = (version: number) => triangleGlb({ extras: { version } });

/** The `extras` version of the first node that carries one. */
function glbVersion(root: THREE.Object3D): string {
  let version = 'none';
  root.traverse((node) => {
    if (version === 'none' && node.userData.version !== undefined) version = String(node.userData.version);
  });
  return version;
}

interface BusRow {
  bus: ResourceType;
  path: string;
  before: string | ArrayBuffer;
  after: string | ArrayBuffer;
  read: (value: never) => string;
  beforeShown: string;
  afterShown: string;
}

const ROWS: BusRow[] = [
  {
    bus: 'scene',
    path: 'res://sub.tscn',
    before: scene('Old'),
    after: scene('New'),
    read: (value: TscnScene) => value.nodes[0]!.name,
    beforeShown: 'Old',
    afterShown: 'New',
  },
  {
    bus: 'resource',
    path: 'res://data.tres',
    before: resource('old'),
    after: resource('new'),
    read: (value: ParsedResource) => value.properties.label!,
    beforeShown: '"old"',
    afterShown: '"new"',
  },
  {
    bus: 'arraymesh',
    path: 'res://mesh.tres',
    before: arrayMesh(1),
    after: arrayMesh(2),
    read: (value: ArrayMeshResource) => String(value.materialPaths.length),
    beforeShown: '1',
    afterShown: '2',
  },
  {
    bus: 'font',
    path: 'res://font.tres',
    before: fontVariation(1),
    after: fontVariation(2),
    read: (value: FontVariationResource) => value.properties.spacing_glyph!,
    beforeShown: '1',
    afterShown: '2',
  },
  {
    bus: 'theme',
    path: 'res://ui.tres',
    before: theme(20),
    after: theme(30),
    read: (value: ThemeResource) => String(value.defaultFontSize),
    beforeShown: '20',
    afterShown: '30',
  },
  {
    bus: 'texture',
    path: 'res://tile.png',
    before: png(1),
    after: png(2),
    read: (value: THREE.Texture) => value.name,
    beforeShown: '1',
    afterShown: '2',
  },
  {
    bus: 'glb',
    path: 'res://prop.glb',
    before: glb(1),
    after: glb(2),
    read: glbVersion,
    beforeShown: '1',
    afterShown: '2',
  },
];

describe.each(ROWS)('provideFile on the $bus bus', (row) => {
  const mount = (loader: ReturnType<typeof createHotReloadHarness>['loader']) =>
    mountProbe(loader, { path: row.path, type: row.bus, read: row.read });

  it('shows the new value when the file changes', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write(row.path, row.before);
    const shown = mount(loader);
    await expectShown(shown, row.beforeShown);

    provider.write(row.path, row.after);
    provide(loader, row.path);

    await expectShown(shown, row.afterShown);
  });

  it('loads a file that arrives after it was found missing', async () => {
    const { provider, loader } = createHotReloadHarness();
    const shown = mount(loader);
    await expectShown(shown, 'unavailable');

    provider.write(row.path, row.after);
    provide(loader, row.path);

    await expectShown(shown, row.afterShown);
  });

  it('becomes unavailable when the file is removed', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write(row.path, row.before);
    const shown = mount(loader);
    await expectShown(shown, row.beforeShown);

    provider.remove(row.path);
    provide(loader, row.path);

    await expectShown(shown, 'unavailable');
  });
});

describe('provideFile, by the path it is given', () => {
  it('reloads the whole file for an address inside it', async () => {
    const { provider, loader } = createHotReloadHarness();
    provider.write('res://data.tres', resource('old'));
    const shown = mountProbe(loader, {
      path: 'res://data.tres',
      type: 'resource',
      read: (value: ParsedResource) => value.properties.label!,
    });
    await expectShown(shown, '"old"');

    provider.write('res://data.tres', resource('new'));
    provide(loader, 'res://data.tres::Resource_1');

    await expectShown(shown, '"new"');
  });

  it('reloads a GLB with its new sidecar when the sidecar changes', async () => {
    const { provider, loader } = createHotReloadHarness();
    const width = (root: THREE.Object3D) => {
      root.updateMatrixWorld(true);
      return String(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).x);
    };
    provider.write('res://prop.glb', glb(1));
    provider.write('res://prop.glb.import', '[params]\n\nnodes/root_scale=2.0\n');
    const shown = mountProbe(loader, { path: 'res://prop.glb', type: 'glb', read: width });
    await expectShown(shown, '2');

    provider.write('res://prop.glb.import', '[params]\n\nnodes/root_scale=3.0\n');
    provide(loader, 'res://prop.glb.import');

    await expectShown(shown, '3');
  });

  it('tells the byte layer that project.godot changed, so its reader reads it again', () => {
    const { fileEventBus, loader } = createHotReloadHarness();
    const invalidated = vi.fn();
    fileEventBus.on('invalidated', invalidated);

    loader.provideFile('res://project.godot');

    expect(invalidated).toHaveBeenCalledWith('res://project.godot');
  });
});
