/**
 * The patched lookup is checked twice: its text against the installed three, so a release that
 * rewrites the chunk fails here and not in a golden, and its split selection by running the
 * patched `getSunShadow` body as JavaScript through a shim of the few GLSL words it uses.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOFT_SHADOW_FILTER, softShadowFilterChunk } from '../shadowFilter/softShadowFilter';
import { FRAMEBUFFER_HEIGHT_UNIFORM, framebufferHeight } from '../shadowFilter/framebufferRows';
import { godotSplitShadowChunk, installGodotSplitShadow } from './splitShadowChunk';
import { NO_BLEND, type SplitSlot } from './fitDirectionalShadowSplits';
import { warningsOf } from '../testing/logWarnings';

const CHUNK = 'shadowmap_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];
/** The loop head of three's own lookup. Its build strips comments and blank lines from chunks. */
const THREE_CASCADE_WALK = 'for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- )';

afterEach(() => {
  THREE.ShaderChunk[CHUNK] = threeChunk;
  for (const shader of Object.values(THREE.ShaderLib)) delete shader.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM];
  delete (THREE.UniformsLib.lights as Record<string, THREE.IUniform>)[FRAMEBUFFER_HEIGHT_UNIFORM];
});

/** three's own module source. Its exports map exposes `"./src/*"`. */
function threeSource(path: string): string {
  return readFileSync(createRequire(import.meta.url).resolve(`three/src/${path}`), 'utf8');
}

/** The source of the patched per-split lookup, from its signature to the sun lookup after it. */
function splitLookup(chunk: string): string {
  const start = chunk.indexOf('float getSunShadowSplit(');
  return chunk.slice(start, chunk.indexOf('float getSunShadow(', start));
}

interface Sample {
  slot: number;
  radiusScale: number;
}

interface Lookup {
  shadow: number;
  samples: Sample[];
}

/** The statements of the patched `getSunShadow`, between its opening and closing braces. */
function lookupBody(chunk: string): string {
  const signature = chunk.indexOf('float getSunShadow(');
  const open = chunk.indexOf(') {', signature) + ') {'.length;
  const close = chunk.indexOf('\n\t\t}', open);
  return chunk.slice(open, close);
}

/** GLSL's `smoothstep`, whose band the blend runs through. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, weight: number): number {
  return a * (1 - weight) + b * weight;
}

/**
 * Runs the lookup at `depth` over `slots`. Each slot's split shadows at `shadowBySlot[slot]`. A
 * declaration keyword becomes `let`, since every name the body declares is a scalar or a vec4.
 */
function runLookup(slots: SplitSlot[], depth: number, shadowBySlot = [0, 0, 0, 0]): Lookup {
  const samples: Sample[] = [];
  const sampleSplit = (_map: unknown, _shadow: unknown, slot: number, radiusScale: number) => {
    samples.push({ slot, radiusScale });
    return shadowBySlot[slot]!;
  };
  const body = lookupBody(godotSplitShadowChunk(threeChunk)!).replace(
    /\b(?:int|float|bool|vec4)\s+(?=\w+\s*=)/g,
    'let '
  );
  const cascade = slots.map(([x, y, z, w]) => ({ x, y, z, w }));
  const run = new Function(
    'smoothstep',
    'mix',
    'getSunShadowSplit',
    'SUN_LIGHT_CASCADES',
    'shadowIndex',
    'vSunShadowWorldPosition',
    'sunShadowCascade',
    'shadowMap',
    'sunLightShadow',
    body
  ) as (...args: unknown[]) => number;
  const shadow = run(smoothstep, mix, sampleSplit, 4, 0, { w: depth }, cascade, null, null);
  return { shadow, samples };
}

/** Four splits ending at 10, 20, 50 and 100. */
function fourSplits(blendStarts: [number, number, number] = [NO_BLEND, NO_BLEND, NO_BLEND]): SplitSlot[] {
  return [
    [10, 0, 0, blendStarts[0]],
    [20, 0, 0, blendStarts[1]],
    [50, 0, 0, blendStarts[2]],
    [100, 0, 0, NO_BLEND],
  ];
}

describe('godotSplitShadowChunk', () => {
  it('replaces three’s cascade walk in the installed three', () => {
    const patched = godotSplitShadowChunk(threeChunk)!;
    expect(threeChunk).toContain(THREE_CASCADE_WALK);
    expect(patched).not.toContain(THREE_CASCADE_WALK);
    expect(patched).toContain('float getSunShadowSplit(');
  });

  it('gives every sun four slots', () => {
    const patched = godotSplitShadowChunk(threeChunk)!;
    expect(patched).toContain('#define SUN_LIGHT_CASCADES 4');
    expect(patched).not.toContain('#define SUN_LIGHT_CASCADES 2');
  });

  it('keeps everything after the lookup (edge case)', () => {
    const patched = godotSplitShadowChunk(threeChunk)!;
    const tail = threeChunk.slice(
      threeChunk.indexOf('\n\t#endif', threeChunk.indexOf('float getSunShadow('))
    );
    expect(tail).toContain('getPointShadow');
    expect(patched.endsWith(tail)).toBe(true);
  });

  it('is null for a chunk without the lookup (error case)', () => {
    expect(godotSplitShadowChunk('void main() {}')).toBeNull();
  });
});

describe('the patched split PCF', () => {
  it('follows Godot’s soft shadow filter, which the install puts in first', () => {
    installGodotSplitShadow();
    const patched = THREE.ShaderChunk[CHUNK];
    const filter = patched.indexOf(SOFT_SHADOW_FILTER);
    expect(filter).toBeGreaterThan(0);
    expect(filter).toBeLessThan(patched.indexOf('float godotSunShadow('));
    expect(patched.indexOf('float godotSunShadow(')).toBeLessThan(
      patched.indexOf('float getSunShadowSplit(')
    );
  });

  it('samples each split through Godot’s PCF under PCF shadows', () => {
    const lookup = splitLookup(godotSplitShadowChunk(threeChunk)!);
    expect(lookup).toMatch(/#if defined\( SHADOWMAP_TYPE_PCF \)\s+return godotSunShadow\(/);
  });

  it('spans soft_shadow_scale texels of the whole atlas, narrowed by the split’s blur factor', () => {
    const patched = godotSplitShadowChunk(threeChunk)!;
    expect(patched).toContain('godotPcf( atlas, ( vec2( 1.0 ) / atlasSize ) * softShadowScale, coord )');
    expect(splitLookup(patched)).toContain('sunLightShadow.shadowRadius * radiusScale,');
  });

  it('keeps three’s own lookup for a map that is not PCF (edge case)', () => {
    const lookup = splitLookup(godotSplitShadowChunk(threeChunk)!);
    expect(lookup).toMatch(/#else\s+return getShadow\(/);
  });

  it('leaves a receiver outside the atlas or past its far plane unshadowed (error case)', () => {
    const patched = godotSplitShadowChunk(threeChunk)!;
    expect(patched).toContain(
      'bool inFrustum = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0;'
    );
    expect(patched).toContain('if ( ! ( inFrustum && coord.z <= 1.0 ) ) return 1.0;');
  });
});

describe('three’s sun shadow, as the split PCF relies on it', () => {
  it('uploads the whole atlas as a sun shadow’s map size', () => {
    expect(threeSource('renderers/webgl/WebGLLights.js')).toContain(
      'shadowUniforms.shadowMapSize.copy( shadow.mapSize ).multiply( shadow.getFrameExtents() );'
    );
  });

  it('biases, bounds and blends a PCF lookup as the port does', () => {
    const pcf = threeChunk.slice(
      threeChunk.indexOf('float getShadow( sampler2DShadow shadowMap,'),
      threeChunk.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )')
    );
    expect(pcf).toContain(
      'float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {'
    );
    expect(pcf).toContain('shadowCoord.xyz /= shadowCoord.w;');
    expect(pcf).toContain('shadowCoord.z += shadowBias;');
    expect(pcf).toContain(
      'bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;'
    );
    expect(pcf).toContain('bool frustumTest = inFrustum && shadowCoord.z <= 1.0;');
    expect(pcf).toContain('return mix( 1.0, shadow, shadowIntensity );');
  });

  it('takes the same arguments in the lookup it keeps for another map type (edge case)', () => {
    expect(threeChunk).toContain(
      'float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {'
    );
  });
});

describe('the patched split lookup', () => {
  it('picks the first split whose far end lies past the fragment', () => {
    expect(runLookup(fourSplits(), 5).samples[0]!.slot).toBe(0);
    expect(runLookup(fourSplits(), 15).samples[0]!.slot).toBe(1);
    expect(runLookup(fourSplits(), 30).samples[0]!.slot).toBe(2);
    expect(runLookup(fourSplits(), 60).samples[0]!.slot).toBe(3);
  });

  it('hands a depth on a far end to the next split (edge case)', () => {
    expect(runLookup(fourSplits(), 10).samples[0]!.slot).toBe(1);
  });

  it('narrows a far split’s filter by the first split’s far end over its own', () => {
    expect(runLookup(fourSplits(), 5).samples[0]!.radiusScale).toBe(1);
    expect(runLookup(fourSplits(), 30).samples[0]!.radiusScale).toBeCloseTo(0.2, 12);
  });

  it('gives the next split no weight before the blend band', () => {
    expect(runLookup(fourSplits([9, 18, 45]), 5, [0, 1, 1, 1]).shadow).toBe(0);
  });

  it('samples only its own split before the blend band (edge case)', () => {
    expect(runLookup(fourSplits([9, 18, 45]), 5).samples).toEqual([{ slot: 0, radiusScale: 1 }]);
  });

  it('mixes in the next split over the blend band, at the full filter radius', () => {
    const { shadow, samples } = runLookup(fourSplits([9, 18, 45]), 9.5, [0, 1, 1, 1]);
    expect(samples).toEqual([
      { slot: 0, radiusScale: 1 },
      { slot: 1, radiusScale: 1 },
    ]);
    expect(shadow).toBeCloseTo(0.5, 12);
  });

  it('blends a light whose first blend start is negative (edge case)', () => {
    // Godot's setter keeps a negative split offset, and Godot blends by its own flag.
    const slots: SplitSlot[] = [
      [-10, 0, 0, -9],
      [20, 0, 0, 18],
      [50, 0, 0, 45],
      [100, 0, 0, NO_BLEND],
    ];
    expect(runLookup(slots, 30).samples[0]).toEqual({ slot: 2, radiusScale: 1 });
  });

  it('never blends the last slot, whatever its w holds (edge case)', () => {
    const slots = fourSplits([9, 18, 45]);
    slots[3]![3] = 80;
    expect(runLookup(slots, 85).samples).toHaveLength(1);
  });

  it('returns the last split’s own shadow past its far end (edge case)', () => {
    expect(runLookup(fourSplits(), 5000, [1, 1, 1, 0.25]).shadow).toBe(0.25);
  });

  it('keeps a two-split light in its second split up to the far end', () => {
    const twoSplits: SplitSlot[] = [
      [10, 0, 0, NO_BLEND],
      [100, 0, 0, NO_BLEND],
      [100, 0, 0, NO_BLEND],
      [100, 0, 0, NO_BLEND],
    ];
    expect(runLookup(twoSplits, 60).samples[0]).toEqual({ slot: 1, radiusScale: 0.1 });
  });

  it('reads a nan depth as the last split (error case)', () => {
    expect(runLookup(fourSplits(), Number.NaN).samples[0]!.slot).toBe(3);
  });
});

/** three's chunk with the soft shadow filter and the split lookup in. */
function installedChunk(): string | null {
  return godotSplitShadowChunk(softShadowFilterChunk(threeChunk)!);
}

describe('installGodotSplitShadow', () => {
  it('replaces three’s chunk with the filtered, patched one', () => {
    installGodotSplitShadow();
    expect(THREE.ShaderChunk[CHUNK]).toBe(installedChunk());
  });

  it('gives every lit built-in material the framebuffer height the filter reads', () => {
    installGodotSplitShadow();
    expect(THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(framebufferHeight);
  });

  it('patches the chunk once, and warns nothing, when called twice (edge case)', () => {
    installGodotSplitShadow();
    expect(warningsOf(installGodotSplitShadow)).toEqual([]);
    expect(THREE.ShaderChunk[CHUNK]).toBe(installedChunk());
  });

  it('leaves a chunk it cannot patch alone (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';
    installGodotSplitShadow();
    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
  });
});
