#!/usr/bin/env node
/**
 * Bakes Godot 4.6.3's DFG table, which Godot integrates on the GPU at start-up
 * (`servers/rendering/renderer_rd/shaders/forward_clustered/integrate_dfg.glsl`), into the
 * committed `dfgTable.generated.ts`: `node scripts/godot-dfg/bake-dfg.mjs [--check]`. `--check`
 * diffs a fresh bake against it and exits 1 on a difference.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TAU } from '../../packages/textscene-core/src/godot/math/math.ts';
import { REPO_ROOT } from '../repoRoot.mjs';

const OUT = join(REPO_ROOT, 'packages/textscene-core/src/godot/rendering/materials/dfgTable.generated.ts');

/** The table's width and height (`render_forward_clustered.cpp:5097-5098`). */
export const DFG_SIZE = 128;

/** `SAMPLE_COUNT` (`integrate_dfg.glsl:13`). */
const SAMPLE_COUNT = 1024;

/**
 * The table as `[fresnel, total]` pairs, a row per roughness and a column per N.V, each at its
 * texel's centre (`integrate_dfg.glsl:156-165`). Godot stores the rows from roughness 1 down and
 * reads them so, so a read of this table at `(NdotV, roughness)` is Godot's read.
 */
export function dfgTable() {
  const table = new Float64Array(DFG_SIZE * DFG_SIZE * 2);
  for (let row = 0; row < DFG_SIZE; row += 1) {
    const halfVectors = sampleHalfVectors((row + 0.5) / DFG_SIZE);
    for (let column = 0; column < DFG_SIZE; column += 1) {
      const [fresnel, total] = integrateDfg((column + 0.5) / DFG_SIZE, (row + 0.5) / DFG_SIZE, halfVectors);
      table[(row * DFG_SIZE + column) * 2] = fresnel;
      table[(row * DFG_SIZE + column) * 2 + 1] = total;
    }
  }
  return table;
}

/**
 * The half vector of each GGX sample at `roughness`, as `x, y, z` triples (`importance_sample_ggx`,
 * `integrate_dfg.glsl:33-55`). The normal is +Z, so the frame's tangent is -Y and its bitangent +X.
 */
function sampleHalfVectors(roughness) {
  const a = roughness * roughness;
  const halfVectors = new Float64Array(SAMPLE_COUNT * 3);
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const phi = (TAU * i) / SAMPLE_COUNT;
    const u = radicalInverse(i);
    const cosTheta = Math.sqrt((1 - u) / (1 + (a * a - 1) * u));
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const x = Math.sin(phi) * sinTheta;
    const y = -Math.cos(phi) * sinTheta;
    const length = Math.sqrt(x * x + y * y + cosTheta * cosTheta);
    halfVectors.set([x / length, y / length, cosTheta / length], i * 3);
  }
  return halfVectors;
}

/** `integrate_brdfs` (`integrate_dfg.glsl:105-150`) without its cloth term. */
function integrateDfg(nDotV, roughness, halfVectors) {
  const vx = Math.sqrt(1 - nDotV * nDotV);
  const vz = nDotV;
  let fresnel = 0;
  let total = 0;
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const hx = halfVectors[i * 3];
    const hy = halfVectors[i * 3 + 1];
    const hz = halfVectors[i * 3 + 2];
    const vDotH = vx * hx + vz * hz;
    const lx = 2 * vDotH * hx - vx;
    const ly = 2 * vDotH * hy;
    const lz = 2 * vDotH * hz - vz;
    const nDotL = saturate(lz / Math.sqrt(lx * lx + ly * ly + lz * lz));
    if (nDotL <= 0) continue;
    const g = geometrySchlickGgx(nDotL, roughness) * geometrySchlickGgx(nDotV, roughness);
    const gVis = (g * saturate(vDotH)) / (saturate(hz) * nDotV);
    fresnel += (1 - saturate(vDotH)) ** 5 * gVis;
    total += gVis;
  }
  return [fresnel / SAMPLE_COUNT, total / SAMPLE_COUNT];
}

/** `geometry_schlick_ggx` (`integrate_dfg.glsl:57-66`), with the IBL `k` of half alpha. */
function geometrySchlickGgx(nDotX, roughness) {
  const k = (roughness * roughness) / 2;
  return nDotX / (nDotX * (1 - k) + k);
}

function saturate(value) {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * `radical_inverse_vdc` (`integrate_dfg.glsl:21-28`), the second Hammersley coordinate.
 * `packages/textscene-core/src/godot/rendering/environment/skyReflection.ts` holds a copy, which this script cannot import.
 */
function radicalInverse(index) {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}

const float32 = new Float32Array(1);
const float32Bits = new Uint32Array(float32.buffer);

/**
 * The half float nearest `value`, ties to even, as Godot's `rgba16f` image holds it. The table
 * holds no value past the half range, nor a negative one.
 */
export function toHalfFloat(value) {
  float32[0] = value;
  const bits = float32Bits[0];
  const exponent = ((bits >>> 23) & 0xff) - 127 + 15;
  const mantissa = bits & 0x7fffff;
  if (exponent < -10) return 0;
  if (exponent <= 0) return roundedShift(mantissa | 0x800000, 14 - exponent);
  return roundedShift((exponent << 23) | mantissa, 13);
}

/** `value` shifted right by `shift` bits, rounded to the nearest, ties to even. */
function roundedShift(value, shift) {
  const kept = value >>> shift;
  const rest = value & ((1 << shift) - 1);
  const half = 1 << (shift - 1);
  return kept + (rest > half || (rest === half && kept & 1) ? 1 : 0);
}

/** The generated module: the table as base64 of its little-endian half floats. */
export function renderTableModule(table) {
  const bytes = Buffer.alloc(table.length * 2);
  table.forEach((value, index) => bytes.writeUInt16LE(toHalfFloat(value), index * 2));
  return `/**
 * Godot 4.6.3's DFG table (\`integrate_dfg.glsl\`), in the half floats Godot stores it in.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:dfg
 */

/** The table's width and height (\`render_forward_clustered.cpp:5097-5098\`). */
export const DFG_SIZE = ${DFG_SIZE};

/**
 * Base64 of the little-endian half floats: \`[fresnel, total]\` per texel, a row per roughness
 * and a column per N.V, each at its texel's centre.
 */
export const DFG_TABLE_BASE64 =
  '${bytes.toString('base64')}';
`;
}

function main() {
  const source = renderTableModule(dfgTable());
  if (!process.argv.includes('--check')) {
    writeFileSync(OUT, source);
    console.log(`[bake-dfg] wrote ${OUT}`);
    return;
  }
  if (readFileSync(OUT, 'utf8') !== source) {
    console.error(`[bake-dfg] STALE: ${OUT} does not match a fresh bake.`);
    console.error('[bake-dfg] run `pnpm godot:dfg` (no --check) to regenerate, then commit.');
    process.exit(1);
  }
  console.log('[bake-dfg] OK: the committed table matches a fresh bake.');
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
