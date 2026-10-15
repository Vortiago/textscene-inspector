/**
 * The patched lookup is checked twice: its text against the installed three, so a release that
 * rewrites the chunk fails here and not in a golden, and its split selection by running the
 * patched `getSunShadow` body as JavaScript through a shim of the few GLSL words it uses.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FRAMEBUFFER_HEIGHT_UNIFORM } from '../shadowFilter/framebufferRows';
import { installedFramebufferHeight } from '../shadowFilter/framebufferRows.testkit';
import { installGodotSplitShadow } from './splitShadowChunk';
import { NO_BLEND, type SplitSlot } from './fitDirectionalShadowSplits';
import { DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM } from './shadowAtlas';
import { SUN_RANGE_BEGINS, SUN_SHADOW_FADES, SUN_SHADOW_ROWS, SUN_SOFT_SHADOWS } from './sunShadowUniforms';
import { GLSL_BUILT_INS } from '../testing/glslScalar';
import { functionBody, withoutBlock } from '../testing/glslSource';
import { DIRECTIONAL_SOFT_SHADOWS } from '../shadowFilter/softShadowSearch';
import { warningsOf } from '../testing/logWarnings';
import { installedShaderChunks, FILTER_PCF, restoreShaderGlobalsAfterEach } from '../testing/shaderPatches';

const CHUNK = 'shadowmap_pars_fragment';
const threeChunk = THREE.ShaderChunk[CHUNK];
/** The loop head of three's own lookup. Its build strips comments and blank lines from chunks. */
const THREE_CASCADE_WALK = 'for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- )';
const THREE_SLOT_MATRICES = 'uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];';

/** The per-split lookup, which marks a chunk that holds the patch. */
const SPLIT_LOOKUP = 'float getSunShadowSplit(';

restoreShaderGlobalsAfterEach();

/** The shadow chunk a canvas compiles with. */
const installedChunk = () => installedShaderChunks()[CHUNK];

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

/** The statements of the patched split selection, between its opening and closing braces. */
function lookupBody(chunk: string, name = 'godotSunSplitShadow'): string {
  const signature = chunk.indexOf(`float ${name}(`);
  const open = chunk.indexOf(') {', signature) + ') {'.length;
  const close = chunk.indexOf('\n\t\t}', open);
  return chunk.slice(open, close);
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
  const body = lookupBody(installedChunk()).replace(/\b(?:int|float|bool|vec4)\s+(?=\w+\s*=)/g, 'let ');
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
  const { smoothstep, mix } = GLSL_BUILT_INS;
  const shadow = run(smoothstep, mix, sampleSplit, 4, 0, { w: depth }, cascade, null, null);
  return { shadow, samples };
}

/**
 * Runs the soft lookup at `depth` over `slots`, as `runLookup` runs the split selection. Each slot's
 * soft split shadows at `shadowBySlot[slot]`.
 */
function runSoftLookup(slots: SplitSlot[], depth: number, shadowBySlot = [0, 0, 0, 0]): Lookup {
  const samples: Sample[] = [];
  const sampleSplit = (_map: unknown, _shadow: unknown, slot: number) => {
    samples.push({ slot, radiusScale: 1 });
    return shadowBySlot[slot]!;
  };
  const body = lookupBody(installedChunk(), 'godotSunSoftShadow').replace(
    /\b(?:int|float|bool|vec4)\s+(?=\w+\s*=)/g,
    'let '
  );
  const cascade = slots.map(([x, y, z, w]) => ({ x, y, z, w }));
  const run = new Function(
    'smoothstep',
    'mix',
    'max',
    'godotSunSoftSplit',
    'SUN_LIGHT_CASCADES',
    'shadowIndex',
    'vSunShadowWorldPosition',
    'sunShadowCascade',
    'godotSunSoftShadows',
    'godotSunRangeBegins',
    'shadowMap',
    'sunLightShadow',
    body
  ) as (...args: unknown[]) => number;
  const { smoothstep, mix, max } = GLSL_BUILT_INS;
  const light = [{ x: 0, y: 1, z: 0, w: 0.5 }];
  const shadow = run(
    smoothstep,
    mix,
    max,
    sampleSplit,
    4,
    0,
    { w: depth },
    cascade,
    light,
    [[0, 0, 0, 0]],
    null,
    null
  );
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

describe('the installed split lookup', () => {
  it('replaces three’s cascade walk in the installed three', () => {
    expect(threeChunk).toContain(THREE_CASCADE_WALK);
    expect(installedChunk()).not.toContain(THREE_CASCADE_WALK);
    expect(installedChunk()).toContain(SPLIT_LOOKUP);
  });

  it('gives every sun four slots', () => {
    const patched = installedChunk();
    expect(patched).toContain('#define SUN_LIGHT_CASCADES 4');
    expect(patched).not.toContain('#define SUN_LIGHT_CASCADES 2');
  });

  it('declares each slot’s matrix as three vec4 rows, in place of three’s mat4 array', () => {
    const patched = installedChunk();
    expect(threeChunk).toContain(THREE_SLOT_MATRICES);
    expect(patched).not.toContain('mat4 sunShadowMatrix');
    expect(patched).toContain(
      `uniform vec4 ${SUN_SHADOW_ROWS}[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES * 3 ];`
    );
  });

  it('keeps three’s chunk, and warns, when three declares the slot matrices another way (error case)', () => {
    const rewritten = threeChunk.replace(THREE_SLOT_MATRICES, 'uniform mat4 sunShadowMatrix[ 8 ];');
    THREE.ShaderChunk[CHUNK] = rewritten;
    expect(warningsOf(installGodotSplitShadow)).toHaveLength(1);
    expect(THREE.ShaderChunk[CHUNK]).not.toContain(SPLIT_LOOKUP);
    expect(THREE.ShaderChunk[CHUNK]).toContain('uniform mat4 sunShadowMatrix[ 8 ];');
  });
});

describe('the patched split PCF', () => {
  it('follows Godot’s soft shadow filter, which the install puts in first', () => {
    installGodotSplitShadow();
    const patched = THREE.ShaderChunk[CHUNK];
    const filter = patched.indexOf(FILTER_PCF);
    expect(filter).toBeGreaterThan(0);
    expect(filter).toBeLessThan(patched.indexOf('float godotSunShadow('));
    expect(patched.indexOf('float godotSunShadow(')).toBeLessThan(
      patched.indexOf('float getSunShadowSplit(')
    );
  });

  it('samples each split through Godot’s PCF under PCF shadows', () => {
    const lookup = splitLookup(installedChunk());
    expect(lookup).toMatch(/#if defined\( SHADOWMAP_TYPE_PCF \)\s+return godotSunShadow\(/);
  });

  it('spans soft_shadow_scale texels of the whole atlas, narrowed by the split’s blur factor', () => {
    const patched = installedChunk();
    expect(patched).toContain('godotPcf( atlas, ( vec2( 1.0 ) / atlasSize ) * softShadowScale, coord )');
    expect(splitLookup(patched)).toContain('sunLightShadow.shadowRadius * radiusScale,');
  });

  it('maps each split’s receiver into the atlas through the slot’s rows', () => {
    expect(splitLookup(installedChunk())).toContain('godotSunShadowCoord( slot, shadowWorldPosition )');
  });

  it('reads a slot’s three rows as the first three rows of its matrix, with w at 1', () => {
    const patched = installedChunk();
    expect(patched).toContain('int row = slot * 3;');
    expect(patched).toContain(
      `return vec4( dot( ${SUN_SHADOW_ROWS}[ row ], point ), dot( ${SUN_SHADOW_ROWS}[ row + 1 ], point ), dot( ${SUN_SHADOW_ROWS}[ row + 2 ], point ), 1.0 );`
    );
  });

  it('keeps three’s own lookup for a map that is not PCF (edge case)', () => {
    const lookup = splitLookup(installedChunk());
    expect(lookup).toMatch(/#else\s+return getShadow\(/);
  });

  it('leaves a receiver outside the atlas or past its far plane unshadowed (error case)', () => {
    const patched = installedChunk();
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

describe('the soft split lookup', () => {
  // `scene_forward_clustered.glsl:2310-2398`, the branch with soft shadows.
  const slotsOf = (samples: Sample[]) => samples.map(({ slot }) => slot);

  it('takes the first split whose far end lies past the fragment', () => {
    expect(slotsOf(runSoftLookup(fourSplits(), 15).samples)).toEqual([1]);
  });

  it('blends the first split into the second over the whole first split, from the camera', () => {
    const { shadow, samples } = runSoftLookup(fourSplits([9, 18, 45]), 5, [0, 1, 1, 1]);
    expect(slotsOf(samples)).toEqual([0, 1]);
    // smoothstep(0, 10, 5)
    expect(shadow).toBeCloseTo(0.5, 12);
  });

  it('blends a later split in from the far end of the split two before it', () => {
    const { shadow, samples } = runSoftLookup(fourSplits([9, 18, 45]), 15, [0, 0, 1, 1]);
    expect(slotsOf(samples)).toEqual([1, 2]);
    // smoothstep(10, 20, 15)
    expect(shadow).toBeCloseTo(0.5, 12);
  });

  it('takes the last slot past every far end (edge case)', () => {
    expect(slotsOf(runSoftLookup(fourSplits(), 500).samples)).toEqual([3]);
  });

  it('reads a nan depth as the last split (error case)', () => {
    expect(slotsOf(runSoftLookup(fourSplits(), Number.NaN).samples)).toEqual([3]);
  });
});

describe('the soft split shadow', () => {
  const chunk = () => installedChunk();

  it('compiles no search without Godot’s directional soft shadows, so binds no atlas colour (edge case)', () => {
    const compiled = withoutBlock(
      installedChunk(),
      `#if defined( SHADOWMAP_TYPE_PCF ) && defined( ${DIRECTIONAL_SOFT_SHADOWS} )`
    );
    expect(compiled).not.toContain(DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM);
    expect(compiled).not.toContain('godotSunSoftShadow(');
    expect(compiled).toContain(
      'return mix( godotSunSplitShadow( shadowMap, sunLightShadow, shadowIndex ), 1.0, fadeOut );'
    );
  });

  it('replaces the PCF for a sun with an angle', () => {
    expect(chunk()).toContain(
      'if ( godotSunSoftShadows[ shadowIndex ].w > 0.0 ) return mix( godotSunSoftShadow( shadowMap, sunLightShadow, shadowIndex ), 1.0, fadeOut );'
    );
  });

  it('spreads the search by the distance from the range start, the angle and the blur', () => {
    // `scene_forward_clustered.glsl:2321-2326`: the receiver's position along the light is in view space.
    expect(chunk()).toContain(
      'float testRadius = ( dot( light.xyz, position - cameraPosition ) - rangeBegin ) * light.w;'
    );
    expect(chunk()).toContain('vec2 texScale = uvScale * testRadius * sunLightShadow.shadowRadius;');
  });

  it('reads the box’s size in the atlas off the slot’s rows, and the range start by slot', () => {
    // `light_storage.cpp:727-731`; `splitShadow.test.ts` pins the matrix's scale.
    expect(chunk()).toContain(
      'vec2 uvScale = vec2( godotSunShadowScale( slot, 0 ), godotSunShadowScale( slot, 1 ) );'
    );
    expect(chunk()).toContain(`return length( ${SUN_SHADOW_ROWS}[ slot * 3 + row ].xyz );`);
    expect(chunk()).toContain(`${SUN_RANGE_BEGINS}[ shadowIndex ][ split ]`);
  });

  it('maps the receiver into the atlas through the slot’s rows', () => {
    expect(chunk()).toContain('vec3 coord = godotSunShadowCoord( slot, position ).xyz;');
  });

  it('reads blockers from the atlas colour and widens the penumbra by their distance', () => {
    // `scene_forward_lights_inc.glsl:393-405`, in a depth that grows away from the light.
    expect(chunk()).toContain(`godotRawDepth( ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM}, uv )`);
    expect(chunk()).toContain('texScale *= ( coord.z - blockerAverage ) / ( blockerAverage - lightSide );');
  });

  it('measures a blocker’s distance from Godot’s light side, not from the moved near plane', () => {
    // Godot's near plane is the range start (`renderer_scene_cull.cpp:2327-2349`). The caster reach
    // moves this box's near plane further towards the light, so its depth 0 lies before that side.
    expect(chunk()).toContain(
      'float lightSide = coord.z - godotSunShadowScale( slot, 2 ) * ( rangeBegin - dot( light.xyz, position ) );'
    );
    expect(chunk()).toContain('godotSunBlockerShadow( shadowMap, coord, texScale, lightSide )');
  });

  it('flattens a blocker nearer the light than Godot’s light side to Godot’s pancake depth (edge case)', () => {
    // Godot clamps the depth to 0.9999 of its range, so the blocker sits 1e-4 of that range past its
    // light side, and `1 - lightSide` is that range in this box's depth.
    // `scene_forward_clustered.glsl:679-682`.
    expect(chunk()).toContain(
      `float blocker = max( godotRawDepth( ${DIRECTIONAL_SHADOW_ATLAS_COLOUR_UNIFORM}, uv ), pancaked );`
    );
    expect(chunk()).toContain('float pancaked = lightSide + GODOT_SUN_PANCAKE * ( 1.0 - lightSide );');
  });

  it('keeps the receiver lit without a blocker (edge case)', () => {
    expect(chunk()).toContain('if ( blockerCount == 0.0 ) return 1.0;');
  });
});

/**
 * How far the patched lookup fades shadow `shadowIndex` out at `depth`, from 0 (shadowed) to 1
 * (unshadowed), given each sun's fade as `[from, to]`.
 */
function runFadeOut(fades: [number, number][], shadowIndex: number, depth: number): number {
  const body = functionBody(installedChunk(), 'float godotSunShadowFadeOut').replace(/\bvec2\s+/g, 'let ');
  const run = new Function(
    'smoothstep',
    SUN_SHADOW_FADES,
    'shadowIndex',
    'vSunShadowWorldPosition',
    body
  ) as (...args: unknown[]) => number;
  const vectors = fades.map(([x, y]) => ({ x, y }));
  return run(GLSL_BUILT_INS.smoothstep, vectors, shadowIndex, { w: depth });
}

describe('the sun shadow fade', () => {
  it('fades the shadow out across its fade by the view depth (`scene_forward_clustered.glsl:2491`)', () => {
    expect([56, 64, 72, 80, 90].map((depth) => runFadeOut([[64, 80]], 0, depth))).toEqual([0, 0, 0.5, 1, 1]);
  });

  it("reads each sun's own fade", () => {
    expect(
      runFadeOut(
        [
          [64, 80],
          [10, 20],
        ],
        1,
        15
      )
    ).toBe(0.5);
  });

  it('fades nothing for a fade whose ends do not ascend (edge case)', () => {
    expect(runFadeOut([[0, 0]], 0, 100)).toBe(0);
  });

  it('declares one fade per sun shadow', () => {
    expect(installedChunk()).toContain(`uniform vec2 ${SUN_SHADOW_FADES}[ NUM_SUN_LIGHT_SHADOWS ];`);
  });

  it('mixes the split shadow towards unshadowed by the fade', () => {
    expect(functionBody(installedChunk(), 'float getSunShadow')).toContain(
      'return mix( godotSunSplitShadow( shadowMap, sunLightShadow, shadowIndex ), 1.0, fadeOut );'
    );
  });

  it('samples nothing past the fade (edge case)', () => {
    expect(functionBody(installedChunk(), 'float getSunShadow')).toContain(
      'if ( fadeOut >= 1.0 ) return 1.0;'
    );
  });

  it('fades a ShadowMaterial receiver, whose shadow mask reads the same sun lookup', () => {
    const chunks = installedShaderChunks();
    const shadowShader = THREE.ShaderLib.shadow.fragmentShader.replace(
      /#include <(\w+)>/g,
      (_include, name: string) => chunks[name as keyof typeof chunks] as string
    );
    expect(shadowShader).toContain('getShadowMask()');
    expect(functionBody(shadowShader, 'float getSunShadow')).toContain(
      'godotSunShadowFadeOut( shadowIndex )'
    );
  });
});

describe('installGodotSplitShadow', () => {
  it('puts the soft shadow filter and the split lookup in three’s chunk', () => {
    installGodotSplitShadow();
    expect(THREE.ShaderChunk[CHUNK]).toContain(FILTER_PCF);
    expect(THREE.ShaderChunk[CHUNK]).toContain(SPLIT_LOOKUP);
  });

  it('keeps everything after three’s lookup (edge case)', () => {
    const tail = threeChunk.slice(
      threeChunk.indexOf('\n\t#endif', threeChunk.indexOf('float getSunShadow('))
    );
    installGodotSplitShadow();
    expect(tail).toContain('getPointShadow');
    expect(THREE.ShaderChunk[CHUNK].endsWith(tail)).toBe(true);
  });

  it('gives every lit built-in material the framebuffer height the filter reads', () => {
    installGodotSplitShadow();
    expect(THREE.ShaderLib.standard.uniforms[FRAMEBUFFER_HEIGHT_UNIFORM]!.value).toBe(
      installedFramebufferHeight()
    );
  });

  it('gives every lit built-in material the arrays the soft shadow reads', () => {
    installGodotSplitShadow();
    for (const name of [SUN_SOFT_SHADOWS, SUN_RANGE_BEGINS])
      expect(THREE.ShaderLib.standard.uniforms[name]!.value).toBeInstanceOf(Float32Array);
  });

  it('gives every lit built-in material the slot rows the lookup reads', () => {
    installGodotSplitShadow();
    expect(THREE.ShaderLib.standard.uniforms[SUN_SHADOW_ROWS]!.value).toBeInstanceOf(Float32Array);
  });

  it('patches the chunk once, and warns nothing, when called twice (edge case)', () => {
    installGodotSplitShadow();
    const once = THREE.ShaderChunk[CHUNK];
    expect(warningsOf(installGodotSplitShadow)).toEqual([]);
    expect(THREE.ShaderChunk[CHUNK]).toBe(once);
  });

  it('keeps three’s sun lookup, and warns, when it cannot replace it (error case)', () => {
    THREE.ShaderChunk[CHUNK] = threeChunk.replace(
      '#define SUN_LIGHT_CASCADES 2',
      '#define SUN_LIGHT_CASCADES 3'
    );
    expect(warningsOf(installGodotSplitShadow)).toHaveLength(1);
    expect(THREE.ShaderChunk[CHUNK]).toContain(THREE_CASCADE_WALK);
    expect(THREE.ShaderChunk[CHUNK]).not.toContain(SPLIT_LOOKUP);
    expect(THREE.ShaderLib.standard.uniforms[SUN_SOFT_SHADOWS]).toBeUndefined();
  });

  it('leaves a chunk the soft shadow filter cannot patch alone (error case)', () => {
    THREE.ShaderChunk[CHUNK] = 'void main() {}';
    installGodotSplitShadow();
    expect(THREE.ShaderChunk[CHUNK]).toBe('void main() {}');
  });
});
