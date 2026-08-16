/**
 * `materialProgramInputs()` — the key and the merged props, and the drift guard
 * that keeps a canvas material with a `map` from being written without a key.
 *
 * The failure it prevents is silent and total: a material compiled before its
 * texture resolved samples NOTHING for the rest of its life (`USE_MAP` is baked
 * at that first compile), so a textured polygon paints its flat fill colour over
 * the whole shape and a particle field paints untextured quads. Nothing in the
 * material's own state looks wrong afterwards — `map` reads back as the texture
 * — which is why this is checked at the source rather than by inspection.
 *
 * A SOURCE check for `canvasItemSinglePassConformance.test.ts`'s reason: a
 * render harness only covers the painters it can drive with a probe, and every
 * painter has source. The behavioural half — that a late texture actually
 * reaches the shader — is asserted where the sequence can be driven end to end,
 * in `nodes/2d/polygon2d/Component.texture.test.tsx`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  isCommentLine,
  isProductionSource,
  reportOffenders,
  walkSources,
  type SourceFile,
} from './testing/sourceScan';
import {
  materialProgramInputs,
  type MaterialProgramBag,
  type ProgramInjection,
} from './materialProgramInputs';

/**
 * The 2D canvas, and only it — same roots the single-pass guard walks. NOT
 * because 3D is covered elsewhere: that premise held for the `map` dimension
 * alone and was false for every other one this scan does not look at. What keeps
 * 3D out is that this scan reads `map=` on a hand-written TAG, which no 3D
 * material is any more; the structural rule that every material comes from the
 * factory is what covers them, and it owns both dimensions at once.
 */
const SOURCE_ROOTS = ['../nodes/2d', '../nodes/base/node2d', './controls', './components'].map(
  (dir) => join(import.meta.dirname, dir)
);

/** Canvas painters that sit loose in `r3f/` rather than under a root. */
const SOURCE_FILES = ['./TileSourceMesh.tsx'].map((file) => join(import.meta.dirname, file));

function scannedSources(): SourceFile[] {
  const found = walkSources(SOURCE_ROOTS, (name) => name.endsWith('.tsx') && isProductionSource(name));
  return [...found, ...SOURCE_FILES.map((file) => ({ file, source: readFileSync(file, 'utf8') }))];
}

/** A key from the factory — the only thing about a program a caller can compare. */
function keyOf<P extends object, M extends readonly object[] = []>(
  props: P & MaterialProgramBag,
  ...merge: { [Part in keyof M]: M[Part] & MaterialProgramBag }
): string {
  return materialProgramInputs<P, M>({ props, merge }).key;
}

/**
 * Lines opening a material tag that binds a `map` without keying the material
 * on it.
 *
 * The whole opening TAG is the unit: these materials carry a dozen props over
 * as many lines, so `map` and the key are never on the line the tag starts on.
 * The tag is taken to end at the first line that CLOSES it (`>` or `/>` at the
 * end), which no prop line here reaches.
 *
 * A tag with no `map` at all is not an offence: its program has no texture in
 * it, and a key would claim a dependency it does not have.
 *
 * A tag that takes its props from the factory binds `map:` inside an object
 * literal rather than `map=` on the tag, so it is out of this scan's reach —
 * which is deliberate for now: the structural rule that every canvas material
 * comes from the factory is a stronger check than this one and replaces it.
 * Until then this still catches a hand-written tag, which is the way the
 * omission arrived the first time.
 */
export function unkeyedMappedMaterialLines(source: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    if (!/<mesh(Basic|Standard)Material(?![A-Za-z0-9])/.test(lines[i]!)) continue;

    let tag = '';
    for (let j = i; j < lines.length; j++) {
      tag += `${lines[j]}\n`;
      if (/\/?>\s*$/.test(lines[j]!.trim())) break;
    }
    if (!/\bmap=/.test(tag)) continue;
    // `key={program.key}` (the factory's output) or an inline call of it.
    if (!/\bkey=\{(?:[A-Za-z0-9_$]+\.key\b|materialProgramInputs\()/.test(tag)) offenders.push(i + 1);
  }
  return offenders;
}

describe('materialProgramInputs', () => {
  const texture = (colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture => {
    const tex = new THREE.Texture();
    tex.colorSpace = colorSpace;
    return tex;
  };
  const DECODE = { DECODE_VIDEO_TEXTURE: '' };

  it('keeps the React key out of props, where a spread would override it', () => {
    const program = materialProgramInputs({ props: { map: texture() } });
    expect(program.key).not.toBe('');
    expect('key' in program.props).toBe(false);
    // `react-jsx-runtime.development.js:242-245` reads the explicit `key=`
    // attribute first and then lets a spread `config.key` overwrite it, warning
    // as it goes — so a key inside `props` would silently win.
    // @ts-expect-error `key` is the factory's output; a caller may not supply one.
    materialProgramInputs({ props: { key: 'mine' } });
  });

  it('hands back the material props it was given, merged in order', () => {
    const program = materialProgramInputs({
      props: { color: 'red', transparent: false },
      merge: [{ side: THREE.DoubleSide, forceSinglePass: true }, { transparent: true }],
    });
    expect(program.props).toEqual({
      color: 'red',
      transparent: true,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
  });

  it('separates a material that has a map from one that does not', () => {
    expect(keyOf({ map: texture() })).not.toBe(keyOf({ map: null }));
  });

  it('separates a decoding material from a plain one holding the same map', () => {
    const tex = texture(THREE.NoColorSpace);
    expect(keyOf({ map: tex, defines: DECODE })).not.toBe(keyOf({ map: tex }));
  });

  it('keeps one key across a texture swap — a new texture is not a new program', () => {
    // An AnimatedSprite2D advancing a frame, a Sprite2D re-regioned. Remounting
    // a material per animation frame would throw away a compiled program per
    // frame for a program that is identical.
    expect(keyOf({ map: texture(), defines: DECODE })).toBe(
      keyOf({ map: texture(), defines: DECODE })
    );
  });

  it('separates two different define sets, and treats a same-shaped set as one', () => {
    expect(keyOf({ map: texture(), defines: DECODE })).not.toBe(
      keyOf({ map: texture(), defines: { ...DECODE, SOMETHING_ELSE: '' } })
    );
    expect(keyOf({ defines: { A: '', B: '' } })).toBe(keyOf({ defines: { B: '', A: '' } }));
  });

  it('separates two defines that differ only in VALUE', () => {
    // `WebGLPrograms.js:415-420` pushes each define's name AND its value.
    expect(keyOf({ defines: { STEPS: '4' } })).not.toBe(keyOf({ defines: { STEPS: '8' } }));
  });

  it('reads an undefined map the same as a null one', () => {
    expect(keyOf({ map: undefined })).toBe(keyOf({ map: null }));
  });

  it('separates each texture slot on its own', () => {
    const bare = keyOf({});
    for (const slot of ['map', 'alphaMap', 'aoMap', 'lightMap', 'emissiveMap', 'normalMap'])
      expect(keyOf({ [slot]: texture() }), slot).not.toBe(bare);
    // Two slots are not one slot: `mapUv` and `alphaMapUv` are separate terms.
    expect(keyOf({ map: texture() })).not.toBe(keyOf({ alphaMap: texture() }));
  });

  describe('the parameters three bakes', () => {
    const cases: [name: string, changed: object][] = [
      // The `opaque` composite, `WebGLPrograms.js:262`, one term at a time.
      ['transparent', { transparent: true }],
      ['blending, on an opaque material', { blending: THREE.CustomBlending }],
      // Both a term of `opaque` and a parameter of its own (`:213`, layer `:589`).
      ['alphaToCoverage', { alphaToCoverage: true }],
      ['side', { side: THREE.DoubleSide }],
      ['vertexColors', { vertexColors: true }],
      ['premultipliedAlpha', { premultipliedAlpha: true }],
      ['combine', { combine: THREE.MixOperation }],
      ['dithering', { dithering: true }],
      ['the material fog flag', { fog: true }],
      // The physical features, each a `> 0` boolean at `:140-145` and a layer
      // bit of its own (`:509`, `:511`, `:527`, `:533`, `:577`, `:579`).
      ['clearcoat', { clearcoat: 0.5 }],
      ['sheen', { sheen: 0.5 }],
      ['anisotropy', { anisotropy: 0.5 }],
      ['transmission', { transmission: 0.5 }],
      ['iridescence', { iridescence: 0.5 }],
      ['dispersion', { dispersion: 0.5 }],
      ['flatShading', { flatShading: true }],
    ];

    for (const [name, changed] of cases)
      it(`changes the key for ${name}`, () => {
        expect(keyOf(changed)).not.toBe(keyOf({}));
      });

    it('separates BackSide from FrontSide as well as DoubleSide', () => {
      // `doubleSided` and `flipSided` are two independent layers (`:569`, `:570`).
      expect(keyOf({ side: THREE.BackSide })).not.toBe(keyOf({ side: THREE.FrontSide }));
      expect(keyOf({ side: THREE.BackSide })).not.toBe(keyOf({ side: THREE.DoubleSide }));
    });

    it('reads a physical feature as a threshold, not a magnitude', () => {
      // `:141` is `material.clearcoat > 0`, so a slider moving inside the band
      // is a uniform — rebuilding for it would throw away the program per edit.
      expect(keyOf({ clearcoat: 0.5 })).toBe(keyOf({ clearcoat: 0.9 }));
      expect(keyOf({ clearcoat: 0 })).toBe(keyOf({}));
    });

    it('keys flatShading only while the material is not wireframe', () => {
      // `:317` — `material.wireframe === false && material.flatShading === true`.
      expect(keyOf({ flatShading: true, wireframe: true })).toBe(keyOf({ wireframe: true }));
    });

    it('keys anisotropyMap only once anisotropy has crossed zero', () => {
      // `:147` gates the slot on `HAS_ANISOTROPY`, and only
      // `MeshPhysicalMaterial` declares `anisotropy` at all
      // (`MeshPhysicalMaterial.js:353`) — so on any other material the flowmap
      // is provably not a program input.
      const flowmap = texture(THREE.NoColorSpace);
      expect(keyOf({ anisotropyMap: flowmap })).toBe(keyOf({}));
      expect(keyOf({ anisotropy: 0.5, anisotropyMap: flowmap })).not.toBe(
        keyOf({ anisotropy: 0.5 })
      );
    });
  });

  describe('the parameters three does NOT bake into a key', () => {
    it('leaves alphaTest alone — the setter bumps version on the zero crossing', () => {
      // `Material.js:494-502`: `alphaTest` IS a program input, and it re-derives
      // itself. Remounting for it would throw away the program three is about to
      // rebuild anyway.
      expect(keyOf({ alphaTest: 0.5 })).toBe(keyOf({ alphaTest: 0 }));
    });

    it('leaves blending alone once the material is already transparent', () => {
      // `blending`'s only reference in `WebGLPrograms` is inside `opaque`
      // (`:262`), which `transparent: true` has already decided. A canvas item
      // edited between MIX and ADD is per-draw GL state, not a new program.
      const transparent = { transparent: true };
      expect(keyOf({ ...transparent, blending: THREE.CustomBlending })).toBe(
        keyOf({ ...transparent, blending: THREE.NormalBlending })
      );
    });

    it('leaves the per-draw values alone — colour, opacity, depth and stencil', () => {
      const base = { color: 'red', opacity: 1, depthWrite: false, depthTest: true };
      expect(keyOf(base)).toBe(
        keyOf({ ...base, color: 'blue', opacity: 0.25, depthWrite: true, depthTest: false })
      );
    });

    it('leaves wireframe alone on a material with no bumpMap and no flatShading', () => {
      // `wireframe` reaches a program only through `HAS_BUMPMAP` (`:132`) and
      // `flatShading` (`:317`), neither of which a flat canvas material has.
      expect(keyOf({ wireframe: true })).toBe(keyOf({ wireframe: false }));
    });

    it('leaves clippingPlanes alone — `setProgram` re-checks the plane count', () => {
      // `numClippingPlanes` IS a program parameter (`:354`), but
      // `WebGLRenderer.js:2456-2458` compares it every draw and rebuilds, so a
      // Control moving in or out of a clipped ancestor self-heals.
      const plane = new THREE.Plane();
      expect(keyOf({ clippingPlanes: [plane] })).toBe(keyOf({ clippingPlanes: [] }));
    });
  });

  describe('the merged result, not the site that supplied it', () => {
    /** What `canvasItemLightingProps` forces, in the shape the factory takes. */
    const lighting = { transparent: true as const };

    it('takes a forced transparent over the site value beneath it', () => {
      // `canvasItemLighting.ts` sets `transparent: true` unconditionally, and it
      // is spread LAST — so an item that writes `transparent: false` is still
      // transparent, and its key must say so or the program and the material
      // disagree.
      expect(keyOf({ transparent: false }, lighting)).toBe(keyOf({}, lighting));
      expect(keyOf({ transparent: false }, lighting)).not.toBe(keyOf({ transparent: false }));
    });

    it('takes a merged side over the material default', () => {
      const facing = { side: THREE.DoubleSide, forceSinglePass: true as const };
      expect(keyOf({}, facing)).not.toBe(keyOf({}));
      expect(keyOf({}, facing)).toBe(keyOf({ side: THREE.DoubleSide }));
    });
  });

  describe('composed program cache keys', () => {
    const injection = (cacheKey: string, marker: string): ProgramInjection => ({
      cacheKey,
      onBeforeCompile: (shader) => {
        shader.fragmentShader += marker;
      },
    });

    it('keeps both contributions when two injections meet on one material', () => {
      const both = materialProgramInputs({
        props: { injection: injection('stylebox', 'A') },
        merge: [{ injection: injection('light', 'B') }],
      });
      expect(both.key).toContain('stylebox');
      expect(both.key).toContain('light');
      expect(both.props.customProgramCacheKey?.()).toContain('stylebox');
      expect(both.props.customProgramCacheKey?.()).toContain('light');

      const shader = { vertexShader: '', fragmentShader: '', uniforms: {} };
      both.props.onBeforeCompile?.(shader);
      expect(shader.fragmentShader).toBe('AB');
    });

    it('separates one injection from none, and two from one', () => {
      const none = keyOf({});
      const one = keyOf({ injection: injection('light', 'B') });
      const two = keyOf({ injection: injection('stylebox', 'A') }, { injection: injection('light', 'B') });
      expect(one).not.toBe(none);
      expect(two).not.toBe(one);
    });

    it('reads the contribution, never the patch identity', () => {
      // Two distinct closures with the same contribution are one program; the
      // key is composed of strings only, so a per-render arrow cannot remount.
      expect(keyOf({ injection: injection('light', 'B') })).toBe(
        keyOf({ injection: injection('light', 'B') })
      );
    });

    it('keeps a lone injection identical across renders, patch and thunk alike', () => {
      // R3F assigns a changed prop without bumping `material.needsUpdate`, so a
      // fresh closure per render is not a recompile — but it would replace the
      // stable function `useCanvasItemLighting` memoises for exactly this reason.
      const light = injection('light', 'B');
      const first = materialProgramInputs({ props: {}, merge: [{ injection: light }] });
      const second = materialProgramInputs({ props: {}, merge: [{ injection: light }] });
      expect(first.props.onBeforeCompile).toBe(light.onBeforeCompile);
      expect(second.props.customProgramCacheKey).toBe(first.props.customProgramCacheKey);
    });

    it('adds neither prop to a material with nothing injected', () => {
      const bare = materialProgramInputs({ props: { color: 'red' } });
      expect('onBeforeCompile' in bare.props).toBe(false);
      expect('customProgramCacheKey' in bare.props).toBe(false);
    });

    it('refuses a patch that is not paired with its contribution', () => {
      // @ts-expect-error an `onBeforeCompile` travels only inside `injection`.
      materialProgramInputs({ props: { onBeforeCompile: () => {} } });
      // @ts-expect-error and so does its `customProgramCacheKey`.
      materialProgramInputs({ props: { customProgramCacheKey: () => 'loose' } });
      // @ts-expect-error a shared recipe has no unpaired route in either.
      materialProgramInputs({ props: {}, merge: [{ onBeforeCompile: () => {} }] });
    });
  });
});

describe('Canvas-item material program conformance', () => {
  it('keys every 2D canvas material that binds a map on its program inputs', () => {
    const offenders = reportOffenders(scannedSources(), unkeyedMappedMaterialLines);

    expect(
      offenders,
      `these materials would sample nothing if their texture resolved after they mounted — build the tag with materialProgramInputs(): ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would have caught the omission it was written for — the check is not vacuous', () => {
    // Polygon2D's fill as it stood while the textured polygon rendered solid
    // white: the map bound, the defines passed, and the material compiled once,
    // mapless, a render before either arrived.
    const preFix = [
      '      <meshBasicMaterial',
      '        color={fill}',
      '        map={texture}',
      '        transparent',
      '        {...canvasItemFacing()}',
      '        defines={decodeDefines}',
      '      />',
    ].join('\n');
    expect(unkeyedMappedMaterialLines(preFix)).toEqual([1]);

    const fixed = preFix.replace(
      '        defines={decodeDefines}',
      '        key={program.key}\n        defines={decodeDefines}'
    );
    expect(unkeyedMappedMaterialLines(fixed)).toEqual([]);

    // A material that binds no map has no texture in its program.
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial color={fill} transparent />')).toEqual([]);
    // A single-line tag, and a prop merely NAMED map.
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial map={tex} />')).toEqual([1]);
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial mapped={tex} />')).toEqual([]);
    expect(unkeyedMappedMaterialLines(' * `<meshBasicMaterial map=…>` in a comment is not a use')).toEqual([]);
    // A key that is not the factory's is not a program key.
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial key={node.name} map={tex} />')).toEqual([1]);
  });

  it('reads the whole 2D render tree, so a new painter cannot escape unnoticed', () => {
    expect(scannedSources().length).toBeGreaterThanOrEqual(80);
  });

  it('no longer has a reason to exclude 3D, and stays 2D only because it is the weaker check', () => {
    // This USED to read "cannot reach a 3D material", on the ground that a 3D
    // material's slots were keyed by `StandardMaterialSlot`. They were — for
    // `map` and the seven slots beside it, and for nothing else. `transparent`,
    // `side`, `vertexColors` and the physical `> 0` thresholds are program
    // inputs too (`WebGLPrograms.js:262`, `:369-370`, `:308`, `:140-145`), and
    // every one of them came off a re-parsable property with no key on it.
    //
    // So the exclusion is documentary now, not protective: 3D and 2D go through
    // the same factory, and what covers either is that a material is BUILT from
    // it — a stronger statement than "a tag that binds `map=` also writes a
    // key", which is all this scan can say. Widening the roots would only make
    // it pass vacuously, since no material writes `map=` on a tag any more.
    expect(
      scannedSources()
        .map(({ file }) => file)
        .filter((file) => /\/nodes\/(3d|base\/node3d)\/|\/r3f\/(materials|csg|environment|sky)\//.test(file))
    ).toEqual([]);
  });
});
