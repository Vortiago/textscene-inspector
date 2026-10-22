/**
 * Every shader patch on three's real programs: the global patches install without a warning, and
 * every program injection finds each of its anchors exactly once in the programs it serves. The
 * list of injections is the list a port of Godot's scene shader would replace.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolve } from 'node:path';
import { repoRoot } from '../../parser/testing/parserKit';
import { installShaderPatches } from './installShaderPatches';
import { installedShaderChunks, snapshotShaderGlobals } from '../testing/shaderPatches';
import { isCommentLine, isProductionSource, repoPath, walkSources } from '../testing/sourceScan';
import { mipmappedTexture } from '../testing/mipmapBiasUniform';
import type { ProgramInjection, ProgramShader } from '../materialProgramInputs';
import { GODOT_ALPHA_ANTIALIASING } from '../materials/godotAlphaAntialiasing';
import { GODOT_ALPHA_HASH } from '../materials/godotAlphaHash';
import { GODOT_AMBIENT_OCCLUSION } from '../materials/godotAmbientOcclusion';
import { GODOT_METALLIC_ROUGHNESS_CHANNELS } from '../materials/godotMetallicRoughnessChannels';
import { mipmapBiasInjection, viewportSamplersUserData } from '../materials/godotMipmapBias';
import { GODOT_UNIT_TANGENT_FRAME } from '../materials/godotNormalMap';
import { parallaxInjection, unshadedParallaxInjection } from '../materials/godotParallax';
import { withPointDraw } from '../materials/godotPoint';
import { renderTargetMapInjection, renderTargetMapUserData } from '../materials/renderTargetMap';
import { emissionTextureAddInjection } from '../materials/emissionTextureAdd';
import { surfaceAlphaProps } from '../materials/surfaceAlphaPatch';
import { surfaceDepthMaterial } from '../materials/surfaceDepthMaterial';
import { AtlasDepthMaterial, ParaboloidDepthMaterial } from '../positionalShadow/atlasDepthMaterials';
import { canvasItemLightingProps } from '../lighting2d/canvasItemLighting';
import { LIGHTMAP_PROGRAM } from '../lightmap/lightmapProgram';
import { TILE_TEXTURE_PADDING } from '../tileTexturePadding';
import { HEIGHTMAP_DEFAULTS } from '../../resources/materials/standardmaterial3d/types';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial';

type ProgramName = 'basic' | 'standard' | 'physical' | 'depth' | 'distance';

/** The three material class whose program `name` is. three calls `onBeforeCompile` as its method. */
const MATERIAL_OF_PROGRAM: Record<ProgramName, () => THREE.Material> = {
  basic: () => new THREE.MeshBasicMaterial(),
  standard: () => new THREE.MeshStandardMaterial(),
  physical: () => new THREE.MeshPhysicalMaterial(),
  depth: () => new THREE.MeshDepthMaterial(),
  distance: () => new THREE.MeshDistanceMaterial(),
};

/** What an injection compiles into: the material's own text, as three hands it to `onBeforeCompile`. */
function programShader(program: ProgramName): ProgramShader {
  const { vertexShader, fragmentShader } = THREE.ShaderLib[program];
  return { vertexShader, fragmentShader, uniforms: {} };
}

const NO_SHADER = (): ProgramShader => ({ vertexShader: '', fragmentShader: '', uniforms: {} });

interface InjectionCase {
  /** The module that defines the injection, relative to `r3f/`. */
  readonly module: string;
  readonly name: string;
  /** The programs it serves: each must hold every anchor exactly once. */
  readonly programs: readonly ProgramName[];
  /** Compiles the injection into `shader`, as the material of `program` does. */
  readonly compile: (program: ProgramName, shader: ProgramShader) => void;
  /**
   * An injection that leaves a program without a match as it is: the antialiasing needs both its
   * chunks, and the mipmap bias rewrites each sample it finds. An empty program is no error for it.
   */
  readonly acceptsUnmatchedProgram?: true;
}

function injected(
  module: string,
  name: string,
  programs: readonly ProgramName[],
  build: () => ProgramInjection | undefined,
  options: { acceptsUnmatchedProgram?: true } = {}
): InjectionCase {
  return {
    module,
    name,
    programs,
    ...options,
    compile: (program, shader) => {
      const injection = build();
      if (!injection) throw new Error(`expected the ${name} case to build an injection`);
      injection.onBeforeCompile.call(MATERIAL_OF_PROGRAM[program](), shader);
    },
  };
}

function compiledBy(
  module: string,
  name: string,
  program: ProgramName,
  build: () => THREE.Material
): InjectionCase {
  return {
    module,
    name,
    programs: [program],
    compile: (_, shader) => {
      build().onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
    },
  };
}

const LIT: readonly ProgramName[] = ['standard', 'physical'];
const COLOUR: readonly ProgramName[] = ['basic', 'standard', 'physical'];
const SURFACE_AND_DEPTH: readonly ProgramName[] = [...COLOUR, 'depth', 'distance'];

const SOME_SURFACE_ALPHA = { readsAlbedoAlpha: false, opaqueAfterCut: false };
const TRANSPARENT = { transparent: true };

const targetMapOf = (repeats: boolean, isNearest: boolean) =>
  renderTargetMapUserData({ uv: { scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } }, repeats, isNearest });

const pointBag = (samplesAlbedoAtPointCoord: boolean) =>
  withPointDraw(
    { materialClass: 'standard', props: { map: new THREE.Texture() } },
    { pixels: 4, pixelRatio: 1, samplesAlbedoAtPointCoord }
  ).injection;

const surfaceWith = (userData: Record<string, unknown>): THREE.Material => {
  const surface = new THREE.MeshStandardMaterial();
  surface.userData = userData;
  return surface;
};

const lightUniforms = () => ({
  lightBuffer: { value: new THREE.Texture() },
  shadowTintBuffer: { value: new THREE.Texture() },
  isLit: { value: 0 },
  resolution: { value: new THREE.Vector2(2, 2) },
  canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
  lightMode: { value: CanvasItemMaterialLightMode.NORMAL },
});

const INJECTIONS: readonly InjectionCase[] = [
  injected('materials/godotAlphaHash.ts', 'alpha hash', SURFACE_AND_DEPTH, () => GODOT_ALPHA_HASH),
  injected(
    'materials/godotAlphaAntialiasing.ts',
    'alpha antialiasing',
    SURFACE_AND_DEPTH,
    () => GODOT_ALPHA_ANTIALIASING,
    { acceptsUnmatchedProgram: true }
  ),
  injected('materials/godotAmbientOcclusion.ts', 'ambient occlusion', LIT, () => GODOT_AMBIENT_OCCLUSION),
  injected(
    'materials/godotMetallicRoughnessChannels.ts',
    'metallic and roughness channels',
    LIT,
    () => GODOT_METALLIC_ROUGHNESS_CHANNELS
  ),
  injected('materials/godotNormalMap.ts', 'unit tangent frame', LIT, () => GODOT_UNIT_TANGENT_FRAME),
  injected(
    'materials/godotMipmapBias.ts',
    'mipmap bias',
    SURFACE_AND_DEPTH,
    () => mipmapBiasInjection({ userData: viewportSamplersUserData(), map: mipmappedTexture() }),
    { acceptsUnmatchedProgram: true }
  ),
  injected('materials/godotParallax.ts', 'parallax', LIT, () => parallaxInjection(HEIGHTMAP_DEFAULTS)),
  injected('materials/godotParallax.ts', 'unshaded parallax', ['basic'], () =>
    unshadedParallaxInjection(HEIGHTMAP_DEFAULTS)
  ),
  injected('materials/godotPoint.ts', 'point size', COLOUR, () => pointBag(false)),
  injected('materials/godotPoint.ts', 'point coordinate albedo', COLOUR, () => pointBag(true)),
  injected('materials/renderTargetMap.ts', 'render target map transform', SURFACE_AND_DEPTH, () =>
    renderTargetMapInjection(targetMapOf(false, false))
  ),
  injected('materials/renderTargetMap.ts', 'render target map sampler', SURFACE_AND_DEPTH, () =>
    renderTargetMapInjection(targetMapOf(true, true))
  ),
  injected('materials/emissionTextureAdd.ts', 'emission texture add', LIT, () =>
    emissionTextureAddInjection(1)
  ),
  injected(
    'materials/surfaceAlphaPatch.ts',
    'albedo alpha unread',
    COLOUR,
    () => surfaceAlphaProps(SOME_SURFACE_ALPHA, TRANSPARENT).injection
  ),
  injected(
    'materials/surfaceAlphaPatch.ts',
    'opaque after cut',
    COLOUR,
    () =>
      surfaceAlphaProps(
        { ...SOME_SURFACE_ALPHA, opaqueAfterCut: true },
        { ...TRANSPARENT, blending: THREE.AdditiveBlending }
      ).injection
  ),
  compiledBy('materials/surfaceDepthMaterial.ts', 'surface depth', 'depth', () =>
    surfaceDepthMaterial(surfaceWith({}), new THREE.MeshDepthMaterial())
  ),
  compiledBy('materials/surfaceDepthMaterial.ts', 'surface distance', 'distance', () =>
    surfaceDepthMaterial(surfaceWith({}), new THREE.MeshDistanceMaterial())
  ),
  compiledBy(
    'positionalShadow/atlasDepthMaterials.ts',
    'atlas depth',
    'depth',
    () => new AtlasDepthMaterial()
  ),
  compiledBy(
    'positionalShadow/atlasDepthMaterials.ts',
    'paraboloid depth',
    'depth',
    () => new ParaboloidDepthMaterial()
  ),
  injected(
    'lighting2d/canvasItemLighting.ts',
    'canvas item lighting',
    ['basic'],
    () => canvasItemLightingProps(lightUniforms()).injection
  ),
  injected('lightmap/lightmapProgram.ts', 'lightmap read', LIT, () => LIGHTMAP_PROGRAM),
  injected('tileTexturePadding.ts', 'tile texture padding', COLOUR, () => TILE_TEXTURE_PADDING),
];

/** The program as `injection` leaves it. It throws when an anchor is missing or occurs twice. */
function compiled(injection: InjectionCase, program: ProgramName): ProgramShader {
  const shader = programShader(program);
  injection.compile(program, shader);
  return shader;
}

let restoreGlobals: () => void;

beforeAll(() => {
  restoreGlobals = snapshotShaderGlobals();
  installShaderPatches();
});

afterAll(() => restoreGlobals());

describe('the global shader patches', () => {
  it('install on three without a warning', () => {
    expect(() => installedShaderChunks()).not.toThrow();
  });
});

describe.each(INJECTIONS)('the $name injection', (injection) => {
  it.each(injection.programs)('finds each of its anchors once in three’s %s program', (program) => {
    const original = programShader(program);
    const patched = compiled(injection, program);
    expect([patched.vertexShader, patched.fragmentShader]).not.toEqual([
      original.vertexShader,
      original.fragmentShader,
    ]);
  });

  it.skipIf(injection.acceptsUnmatchedProgram)(
    'throws for a program that holds none of its anchors (error case)',
    () => {
      const shader = NO_SHADER();
      expect(() => injection.compile(injection.programs[0]!, shader)).toThrow(
        /expected .* to hold ".*" once/s
      );
    }
  );
});

describe('the list of injections', () => {
  const R3F = resolve(repoRoot(), 'packages/textscene-core/src/r3f');

  /** A line that defines an `onBeforeCompile`: a method, a property or an assignment, not prose. */
  const DEFINES_INJECTION = /^\s*(?:[\w.]+\.)?onBeforeCompile\s*(?:[(:=]|\s*=)/;

  /** `defining` only prepends a `#define`: it holds no anchor to miss. */
  const WITHOUT_ANCHORS = new Set(['materialProgramInputs.ts']);

  const definers = walkSources([R3F], isProductionSource)
    .filter(({ source }) =>
      source.split('\n').some((line) => !isCommentLine(line) && DEFINES_INJECTION.test(line))
    )
    .map(({ file }) => repoPath(file).replace('packages/textscene-core/src/r3f/', ''))
    .filter((module) => !WITHOUT_ANCHORS.has(module));

  it('names the module of every injection that splices a program', () => {
    expect(new Set(INJECTIONS.map(({ module }) => module))).toEqual(new Set(definers));
  });
});
