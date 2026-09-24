/**
 * `materialProgramInputs()`: the key and the merged props from the same bag. A
 * material compiled before its texture resolved samples nothing for life, while
 * `map` reads back fine. `materialFactoryConformance.test.ts` gates the source and
 * `nodes/2d/polygon2d/Component.texture.test.tsx` drives a late texture end to end.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  materialProgramInputs,
  type MaterialProgramBag,
  type ProgramInjection,
} from './materialProgramInputs';

/** A key from the factory: the only thing about a program a caller can compare. */
function keyOf<P extends object, M extends readonly object[] = []>(
  props: P & MaterialProgramBag,
  ...merge: { [Part in keyof M]: M[Part] & MaterialProgramBag }
): string {
  return materialProgramInputs<P, M>({ props, merge }).key;
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
    // `react-jsx-runtime.development.js:242-245` lets a spread `config.key`
    // overwrite the explicit `key=`, so a key inside `props` would win.
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
    // An AnimatedSprite2D advancing a frame, a Sprite2D re-regioned: the program
    // is identical, so a remount per frame would waste a compile per frame.
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
    // `WebGLPrograms.js:415-420` pushes each define's name and its value.
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
      // `:172` `HAS_ALPHAHASH`, published at `:266`, layer `:530`.
      ['alphaHash', { alphaHash: true }],
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
      // three 0.186.0 `WebGLPrograms.js:143`, layer bit 24 at `:541-542`.
      ['retroreflectivity', { retroreflectivity: 0.5 }],
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
      // is a uniform, and rebuilding would waste the program per edit.
      expect(keyOf({ clearcoat: 0.5 })).toBe(keyOf({ clearcoat: 0.9 }));
      expect(keyOf({ clearcoat: 0 })).toBe(keyOf({}));
    });

    it('keys flatShading only while the material is not wireframe', () => {
      // `:317`: `material.wireframe === false && material.flatShading === true`.
      expect(keyOf({ flatShading: true, wireframe: true })).toBe(keyOf({ wireframe: true }));
    });

    it('keys anisotropyMap only once anisotropy has crossed zero', () => {
      // `:147` gates the slot on `HAS_ANISOTROPY`, and only `MeshPhysicalMaterial`
      // declares `anisotropy` (`MeshPhysicalMaterial.js:353`), so on any other
      // material the flowmap is not a program input.
      const flowmap = texture(THREE.NoColorSpace);
      expect(keyOf({ anisotropyMap: flowmap })).toBe(keyOf({}));
      expect(keyOf({ anisotropy: 0.5, anisotropyMap: flowmap })).not.toBe(
        keyOf({ anisotropy: 0.5 })
      );
    });

    it('keys alphaHash even though its neighbour alphaTest is exempt', () => {
      // `Material.js:134` declares `alphaHash` as a plain field with no setter, so
      // the exemption `alphaTest` earns at `:494-502` does not transfer.
      expect(keyOf({ alphaHash: true })).not.toBe(keyOf({ alphaHash: false }));
      expect(keyOf({ alphaHash: false })).toBe(keyOf({}));
    });
  });

  describe('the parameters three does NOT bake into a key', () => {
    it('leaves alphaTest alone — the setter bumps version on the zero crossing', () => {
      // `Material.js:494-502`: `alphaTest` is a program input that re-derives
      // itself, so a remount would waste the program three rebuilds anyway.
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
      // `numClippingPlanes` is a program parameter (`:354`), but
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
      // `canvasItemLighting.ts` sets `transparent: true` and is spread last, so an
      // item that writes `transparent: false` is still transparent, and its key
      // says so.
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
      // fresh closure per render is no recompile, but it would replace the stable
      // function `useCanvasItemLighting` memoises.
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
