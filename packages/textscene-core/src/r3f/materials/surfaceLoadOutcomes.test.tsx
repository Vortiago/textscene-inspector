import { act } from 'react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as logger from '../../logger';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import type { ScopedReference } from '../../resources/reading';
import { referenceIn } from '../../resources/reading/scopedReference.testkit';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import type { SurfaceShader } from '../spatialShader/surfaceShader';
import { fileMaterial } from './materialReference';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';

const TRANSLATED = new THREE.MeshBasicMaterial();

vi.mock('../litSurface/litSurfaceForm', () => ({ litSurfaceForm: () => 'nodes' }));
vi.mock('../../shaders/nodesHandler.js', () => ({ installNodesHandler: () => {} }));

// The real generator names the samplers; the translation itself is a stub material.
vi.mock('../spatialShader/spatialSurface', async () => {
  const { surfaceShaderOf } = await vi.importActual<typeof import('../spatialShader/surfaceShader')>(
    '../spatialShader/surfaceShader'
  );
  return {
    surfaceShaderOf,
    spatialSurfaceOf: (_gl: unknown, shader: SurfaceShader) => ({
      spatial: { material: TRANSLATED, parameters: {}, pointDraw: null },
      samplers: Object.fromEntries(declaredSamplers(shader.code)),
    }),
    disposeSpatial: () => {},
    setParameterValues: () => {},
    withGodotSurface: () => {},
  };
});

// The import, the first render, the slots' reports and a map's upload each take a turn of the loop.
const SETTLING_TICKS = 10;
const MAP_PATH = 'res://map.png';

/** The sampler kind of each GLSL sampler type a row's text declares. */
const KIND_OF_TYPE: Readonly<Record<string, string>> = {
  sampler2D: 'flat',
  samplerCube: 'cube',
  sampler3D: 'volume',
  sampler2DArray: 'layers',
};

/** The samplers a text declares, with their kinds: Godot declares one only for a map the material reads. */
function declaredSamplers(text: string): [string, { kind: string }][] {
  return [...text.matchAll(/uniform (sampler\w+) (\w+)/g)].map(([, type, name]) => [
    name!,
    { kind: KIND_OF_TYPE[type!]! },
  ]);
}
const MATERIAL_PATH = 'res://paint.tres';
const CUBE_PATH = 'res://sky.webp';
const VOLUME_PATH = 'res://volume.png';
const LAYERS_PATH = 'res://layers.png';
const EXTERNAL: TscnExternalResource[] = [
  { id: '1_map', type: 'Texture2D', path: MAP_PATH },
  { id: '2_cube', type: 'CompressedCubemap', path: CUBE_PATH },
  { id: '3_volume', type: 'CompressedTexture3D', path: VOLUME_PATH },
  { id: '4_layers', type: 'CompressedTexture2DArray', path: LAYERS_PATH },
];

/** What the surface draws: the translated shader, the missing-texture placeholder, or a classic material. */
type Drawn = 'node path' | 'placeholder' | 'classic';

/** What the test does to the map's file, and the reference that names the map. */
interface Outcome {
  readonly name: string;
  readonly map: string;
  readonly resources: readonly TscnInternalResource[];
  readonly settle: (fake: FakeResourceLoader) => void;
  readonly waiting: Drawn;
  readonly after: Drawn;
  /** Godot's end state, cited. */
  readonly godot: string;
}

const FILE_MISSING =
  'Godot refuses the scene at run time (`resource_format_text.cpp:146-154`, `resource_loader.cpp:1566`), and the editor ' +
  'loads the property as null: ' +
  'the previewer marks the missing file instead';

const OUTCOMES: readonly Outcome[] = [
  {
    name: 'loads late',
    map: 'ExtResource("1_map")',
    resources: [],
    settle: (fake) => fake.textures._resolve(MAP_PATH, new THREE.Texture()),
    waiting: 'classic',
    after: 'node path',
    godot: 'draws the texture',
  },
  {
    name: 'never loads, as its file is missing',
    map: 'ExtResource("1_map")',
    resources: [],
    settle: (fake) => fake.textures._fail(MAP_PATH, 'not found'),
    waiting: 'classic',
    after: 'placeholder',
    godot: FILE_MISSING,
  },
  {
    name: 'fails to decode',
    map: 'ExtResource("1_map")',
    resources: [],
    settle: (fake) => fake.textures._fail(MAP_PATH, 'the PNG does not decode'),
    waiting: 'classic',
    after: 'placeholder',
    godot: `the loader gives no texture, as for a missing file. ${FILE_MISSING}`,
  },
  {
    name: 'is a CanvasTexture',
    map: 'SubResource("Canvas")',
    resources: [{ id: 'Canvas', type: 'CanvasTexture', data: {} }],
    settle: () => {},
    waiting: 'node path',
    after: 'node path',
    godot: 'its RID names no texture, so the sampler reads the default (`material_storage.cpp:1094-1096`)',
  },
  {
    name: 'is a float, not a texture',
    map: '3.0',
    resources: [],
    settle: () => {},
    waiting: 'node path',
    after: 'node path',
    godot: 'the setter takes the float as a null texture, so the sampler reads the default',
  },
  {
    name: 'is an AtlasTexture whose atlas file is missing',
    map: 'SubResource("Atlas")',
    resources: [{ id: 'Atlas', type: 'AtlasTexture', data: { atlas: 'ExtResource("1_map")' } }],
    settle: (fake) => fake.textures._fail(MAP_PATH, 'not found'),
    waiting: 'classic',
    after: 'placeholder',
    godot: FILE_MISSING,
  },
];

const SHADER_CODE: TscnInternalResource = {
  id: 'Code',
  type: 'Shader',
  data: {
    code: JSON.stringify(
      'shader_type spatial;\nuniform sampler2D albedo_map;\nuniform sampler2D roughness_map;\n' +
        'void fragment() {\n\tALBEDO = texture(albedo_map, UV).rgb;\n\tROUGHNESS = texture(roughness_map, UV).g;\n}\n'
    ),
  },
};

const USER_SHADER = { shader: 'SubResource("Code")' };

/** Each class with the albedo and one other map, and the flags that make Godot read the map. */
const MATERIALS = [
  {
    materialClass: 'StandardMaterial3D',
    waitsInClassic: true,
    maps: [
      { property: 'albedo_texture', flags: {} },
      { property: 'normal_texture', flags: { normal_enabled: 'true' } },
    ],
  },
  {
    materialClass: 'ORMMaterial3D',
    waitsInClassic: true,
    maps: [
      { property: 'albedo_texture', flags: {} },
      { property: 'orm_texture', flags: {} },
    ],
  },
  {
    materialClass: 'ShaderMaterial',
    // A user's shader keeps no classic material while it waits: it draws the sampler's default.
    waitsInClassic: false,
    maps: [
      { property: 'shader_parameter/albedo_map', flags: USER_SHADER },
      { property: 'shader_parameter/roughness_map', flags: USER_SHADER },
    ],
  },
] as const;

const ROWS = MATERIALS.flatMap(({ materialClass, waitsInClassic, maps }) =>
  maps.flatMap(({ property, flags }) =>
    OUTCOMES.map((outcome) => ({
      materialClass,
      property,
      flags,
      outcome,
      waiting: waitsInClassic ? outcome.waiting : ('node path' as const),
    }))
  )
);

async function renderSurface(source: ScopedReference, resources: readonly TscnInternalResource[]) {
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider internalResources={[...resources]} externalResources={EXTERNAL}>
        <mesh>
          <boxGeometry />
          <SurfaceMaterialSlot source={source} drawnOn="mesh" />
        </mesh>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
  await settleEffects();
  const mesh = renderer.scene.children[0]!.instance as THREE.Mesh;
  return { fake, drawn: () => drawnOf(mesh.material as THREE.Material) };
}

/** Lets the translator's import, the texture slots' reports and the swaps that follow land. */
async function settleEffects() {
  for (let tick = 0; tick < SETTLING_TICKS; tick++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function drawnOf(material: THREE.Material): Drawn {
  if (material === TRANSLATED) return 'node path';
  const color = (material as THREE.MeshStandardMaterial).color;
  return color?.getHex() === 0xff00ff ? 'placeholder' : 'classic';
}

afterEach(() => vi.restoreAllMocks());

// Each row states what the surface draws while a map loads and after, and cites Godot's end state.
describe('what a surface draws on the node lit surface for each load outcome of a map', () => {
  it.each(ROWS)(
    '$materialClass $property that $outcome.name',
    async ({ materialClass, property, flags, outcome, waiting: whileWaiting }) => {
      vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const material: TscnInternalResource = {
        id: 'Paint',
        type: materialClass,
        data: { ...flags, [property]: outcome.map },
      };
      const resources = [material, SHADER_CODE, ...outcome.resources];
      const { fake, drawn } = await renderSurface(
        referenceIn('SubResource("Paint")', EXTERNAL, resources),
        resources
      );
      const waiting = drawn();

      await act(async () => outcome.settle(fake));
      await settleEffects();
      await vi.waitFor(() => expect(drawn()).toBe(outcome.after));

      expect({ waiting, after: drawn() }).toEqual({ waiting: whileWaiting, after: outcome.after });
    }
  );
});

describe('what a surface draws on the node lit surface for a material file', () => {
  it("draws Godot's default material through its shader once the file is missing", async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { fake, drawn } = await renderSurface(fileMaterial(MATERIAL_PATH), []);

    await act(async () => fake.resources._fail(MATERIAL_PATH, 'not found'));
    await settleEffects();

    // Godot draws a surface with no material through its default (`render_forward_clustered.cpp:4222`).
    expect(drawn()).toBe('node path');
  });
});

/** A user's spatial shader that samples `uniforms`, each line a declaration, and writes their sum. */
function layeredShader(uniforms: string, reads: string): TscnInternalResource {
  return {
    id: 'Code',
    type: 'Shader',
    data: {
      code: JSON.stringify(`shader_type spatial;\n${uniforms}\nvoid fragment() {\n\tALBEDO = ${reads};\n}\n`),
    },
  };
}

/** A ShaderMaterial row on a map other than a flat texture: the kind, its file and its processor. */
interface LayeredRow {
  readonly kind: string;
  readonly shader: TscnInternalResource;
  readonly parameter: Readonly<Record<string, string>>;
  readonly settleLate: (fake: FakeResourceLoader) => void;
  readonly settleMissing: (fake: FakeResourceLoader) => void;
}

const LAYERED_ROWS: readonly LayeredRow[] = [
  {
    kind: 'a samplerCube',
    shader: layeredShader('uniform samplerCube sky;', 'texture(sky, NORMAL).rgb'),
    parameter: { 'shader_parameter/sky': 'ExtResource("2_cube")' },
    settleLate: (fake: FakeResourceLoader) => fake.cubemaps._resolve(CUBE_PATH, new THREE.CubeTexture()),
    settleMissing: (fake: FakeResourceLoader) => fake.cubemaps._fail(CUBE_PATH, 'not found'),
  },
  {
    kind: 'a sampler3D',
    shader: layeredShader('uniform sampler3D volume;', 'texture(volume, vec3(UV, 0.5)).rgb'),
    parameter: { 'shader_parameter/volume': 'ExtResource("3_volume")' },
    settleLate: (fake: FakeResourceLoader) =>
      fake.textures3D._resolve(VOLUME_PATH, new THREE.Data3DTexture()),
    settleMissing: (fake: FakeResourceLoader) => fake.textures3D._fail(VOLUME_PATH, 'not found'),
  },
];

// A user's shader draws while it waits, and a missing map file takes the placeholder, as a flat one does.
describe('what a ShaderMaterial draws for each load outcome of a cube or volume map', () => {
  async function renderShaded(row: LayeredRow) {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const material: TscnInternalResource = {
      id: 'Paint',
      type: 'ShaderMaterial',
      data: { shader: 'SubResource("Code")', ...row.parameter },
    };
    const resources = [material, row.shader];
    return renderSurface(referenceIn('SubResource("Paint")', EXTERNAL, resources), resources);
  }

  it.each(LAYERED_ROWS)('draws the shader once $kind map loads', async (row) => {
    const { fake, drawn } = await renderShaded(row);

    await act(async () => row.settleLate(fake));
    await settleEffects();

    expect(drawn()).toBe('node path');
  });

  it.each(LAYERED_ROWS)('draws the placeholder once $kind map file is missing', async (row) => {
    const { fake, drawn } = await renderShaded(row);

    await act(async () => row.settleMissing(fake));
    await settleEffects();
    await vi.waitFor(() => expect(drawn()).toBe('placeholder'));
  });

  it('draws the placeholder for a missing flat map beside a sampler2DArray, which has no slot', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shader = layeredShader(
      'uniform sampler2D albedo_map;\nuniform sampler2DArray layers;',
      'texture(albedo_map, UV).rgb + texture(layers, vec3(UV, 0.0)).rgb'
    );
    const material: TscnInternalResource = {
      id: 'Paint',
      type: 'ShaderMaterial',
      data: {
        shader: 'SubResource("Code")',
        'shader_parameter/albedo_map': 'ExtResource("1_map")',
        'shader_parameter/layers': 'ExtResource("4_layers")',
      },
    };
    const resources = [material, shader];
    const { fake, drawn } = await renderSurface(
      referenceIn('SubResource("Paint")', EXTERNAL, resources),
      resources
    );

    await act(async () => fake.textures._fail(MAP_PATH, 'not found'));
    await settleEffects();
    await vi.waitFor(() => expect(drawn()).toBe('placeholder'));
  });
});

/** The maps a generated shader samples and the classic material never loads, with the flag for each. */
const UNLOADED_IN_CLASSIC = [
  { property: 'detail_albedo', flag: 'detail_enabled' },
  { property: 'detail_mask', flag: 'detail_enabled' },
  { property: 'bent_normal_texture', flag: 'bent_normal_enabled' },
  { property: 'rim_texture', flag: 'rim_enabled' },
  { property: 'clearcoat_texture', flag: 'clearcoat_enabled' },
  { property: 'backlight_texture', flag: 'backlight_enabled' },
  { property: 'refraction_texture', flag: 'refraction_enabled' },
  { property: 'subsurf_scatter_texture', flag: 'subsurf_scatter_enabled' },
] as const;

describe('what a StandardMaterial3D draws for a map the classic material never loads', () => {
  async function renderUnloaded({ property, flag }: (typeof UNLOADED_IN_CLASSIC)[number]) {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const material: TscnInternalResource = {
      id: 'Paint',
      type: 'StandardMaterial3D',
      data: { [flag]: 'true', [property]: 'ExtResource("1_map")' },
    };
    return renderSurface(referenceIn('SubResource("Paint")', EXTERNAL, [material]), [material]);
  }

  it.each(UNLOADED_IN_CLASSIC)('draws the node path once $property loads', async (row) => {
    const { fake, drawn } = await renderUnloaded(row);

    await act(async () => fake.textures._resolve(MAP_PATH, new THREE.Texture()));
    await settleEffects();
    await vi.waitFor(() => expect(drawn()).toBe('node path'));
  });

  it.each(UNLOADED_IN_CLASSIC)('draws the placeholder once the $property file is missing', async (row) => {
    const { fake, drawn } = await renderUnloaded(row);

    await act(async () => fake.textures._fail(MAP_PATH, 'not found'));
    await settleEffects();
    await vi.waitFor(() => expect(drawn()).toBe('placeholder'));
  });
});
