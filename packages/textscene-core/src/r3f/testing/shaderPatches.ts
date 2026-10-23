/**
 * Every chunk patch as one pure function of three's chunks, read through `installShaderPatches`
 * itself, so a test reads the chunks a canvas compiles with and never rebuilds the install order.
 */

import { afterEach, beforeEach } from 'vitest';
import * as THREE from 'three';
import { installShaderPatches } from '../shaderPatch/installShaderPatches';
import { installGodotLightSpecular } from '../lightSpecular/lightSpecularChunk';
import { installGodotLightSize } from '../lightSize/lightSizeChunk';
import { installGodotNormalMapRead } from '../materials/godotNormalMap';
import { warningsOf } from './logWarnings';

export type ShaderChunks = typeof THREE.ShaderChunk;

/** The soft shadow filter's own function, which marks a chunk that holds the filter. */
export const FILTER_PCF = 'float godotPcf(';

type Table = Record<string, unknown>;

/** Makes `target` hold exactly the keys and values of `source`. */
function replaceContents(target: Table, source: Table): void {
  for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
  Object.assign(target, source);
}

/** Whether a `UniformsLib` entry is a group of uniforms, or a uniform of its own, as a patch adds. */
function isTable(value: unknown): value is Table {
  return typeof value === 'object' && value !== null;
}

/**
 * Records every global a patch install can write: the chunks, the programs of `ShaderLib` with
 * their sources and uniforms, and `UniformsLib` with each of its groups. The returned call puts
 * them back, and removes what the install added.
 */
export function snapshotShaderGlobals(): () => void {
  const chunks = { ...THREE.ShaderChunk };
  const shaderLib = THREE.ShaderLib as unknown as Table;
  const shaderLibCopy = { ...shaderLib };
  const programs = Object.values(THREE.ShaderLib).map(
    (program) => [program, program.vertexShader, program.fragmentShader, { ...program.uniforms }] as const
  );
  const uniformsLib = THREE.UniformsLib as unknown as Table;
  const uniformsLibCopy = { ...uniformsLib };
  const groups = Object.values(uniformsLibCopy)
    .filter(isTable)
    .map((group) => [group, { ...group }] as const);
  return () => {
    replaceContents(THREE.ShaderChunk as unknown as Table, chunks);
    replaceContents(shaderLib, shaderLibCopy);
    for (const [program, vertexShader, fragmentShader, programUniforms] of programs) {
      program.vertexShader = vertexShader;
      program.fragmentShader = fragmentShader;
      replaceContents(program.uniforms, programUniforms);
    }
    replaceContents(uniformsLib, uniformsLibCopy);
    for (const [group, groupUniforms] of groups) replaceContents(group, groupUniforms);
  };
}

/** Puts every global a patch install writes back after each test of the calling file. */
export function restoreShaderGlobalsAfterEach(): void {
  let restore = (): void => {};
  beforeEach(() => {
    restore = snapshotShaderGlobals();
  });
  afterEach(() => restore());
}

/**
 * three's chunks with every patch in, in the order a canvas installs them. Every global the install
 * writes is back as it was afterwards. A patch that fails to install throws, so a test that reads
 * the result never reads a chunk a patch left out.
 */
export function installedShaderChunks(): ShaderChunks {
  const restore = snapshotShaderGlobals();
  try {
    const warnings = warningsOf(installShaderPatches);
    if (warnings.length > 0) {
      throw new Error(`expected every shader patch to install, got ${warnings.join('; ')}`);
    }
    return { ...THREE.ShaderChunk };
  } finally {
    restore();
  }
}

/** The patches `installGodotLightFunction` requires, in the order a canvas installs them. */
export function installLightFunctionPrerequisites(): void {
  installGodotLightSpecular();
  installGodotLightSize();
  installGodotNormalMapRead();
}
