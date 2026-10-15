/**
 * Every chunk patch as one pure function of three's chunks, read through `installShaderPatches`
 * itself, so a test reads the chunks a canvas compiles with and never rebuilds the install order.
 */

import * as THREE from 'three';
import { installShaderPatches } from '../shaderPatch/installShaderPatches';
import { warningsOf } from './logWarnings';

export type ShaderChunks = typeof THREE.ShaderChunk;

type Uniforms = Record<string, unknown>;

/** Makes `target` hold exactly the keys and values of `source`. */
function replaceContents(target: Uniforms, source: Uniforms): void {
  for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
  Object.assign(target, source);
}

/**
 * Records every global a patch install writes: the chunks, each program's fragment shader and
 * uniforms, and `UniformsLib` with its light and fog groups. The returned call puts them back.
 */
export function snapshotShaderGlobals(): () => void {
  const chunks = { ...THREE.ShaderChunk };
  const programs = Object.values(THREE.ShaderLib).map(
    (program) => [program, program.fragmentShader, { ...program.uniforms }] as const
  );
  const uniformsLib = THREE.UniformsLib as unknown as Uniforms;
  const library = { ...uniformsLib };
  const groups = [THREE.UniformsLib.lights, THREE.UniformsLib.fog].map(
    (group) => [group as Uniforms, { ...group }] as const
  );
  return () => {
    Object.assign(THREE.ShaderChunk, chunks);
    for (const [program, fragmentShader, uniforms] of programs) {
      program.fragmentShader = fragmentShader;
      replaceContents(program.uniforms, uniforms);
    }
    replaceContents(uniformsLib, library);
    for (const [group, uniforms] of groups) replaceContents(group, uniforms);
  };
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
