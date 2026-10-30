/**
 * The `FontFace` a scene font registers: its bytes and the descriptors that hold a variable font at
 * its `fvar` defaults. `IS_VITEST` is read at module scope, so each test re-imports the loader with
 * the guard off. happy-dom has no 2D canvas, so the load stops after the registration these tests read.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { faceDescriptors } from './sceneFontFace';
import { fixtureFontBytes, fontFile } from './sfntOutlines.testkit';

class FakeFontFace {
  constructor(
    readonly family: string,
    readonly source: ArrayBuffer,
    readonly descriptors?: FontFaceDescriptors
  ) {}
  load(): Promise<FakeFontFace> {
    return Promise.resolve(this);
  }
}

/**
 * A cold `.woff2` decode can take seconds, so a test waits for its own face. Each call counts faces
 * on its own list: a load an earlier test left in flight registers there, never as this test's face.
 */
const REGISTRATION_TIMEOUT_MS = 10_000;

function fontFaceRecorder(): { FontFace: typeof FakeFontFace; faces: FakeFontFace[] } {
  const faces: FakeFontFace[] = [];
  class RecordedFontFace extends FakeFontFace {
    constructor(...args: ConstructorParameters<typeof FakeFontFace>) {
      super(...args);
      faces.push(this);
    }
  }
  return { FontFace: RecordedFontFace, faces };
}

async function registeredFaceOf(bytes: ArrayBuffer): Promise<FakeFontFace> {
  const recorder = fontFaceRecorder();
  vi.stubGlobal('FontFace', recorder.FontFace);
  vi.stubGlobal('document', { fonts: { add: () => {} }, createElement: () => ({ getContext: () => null }) });
  vi.stubEnv('VITEST', 'false');
  vi.resetModules();
  const logger = await import('../../../../logger');
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  const { peekSceneFontMetrics } = await import('./sceneFontLoader');
  peekSceneFontMetrics(fontFile(bytes), 'Root/Variable');
  return vi.waitFor(
    () => recorder.faces[0] ?? Promise.reject(new Error('expected a registered FontFace, got none')),
    { timeout: REGISTRATION_TIMEOUT_MS }
  );
}

describe('scene font registration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('holds a variable .woff2 at its fvar defaults, through the weight descriptor every engine honours', async () => {
    const face = await registeredFaceOf(fixtureFontBytes('recursive-vf-subset.woff2'));

    expect(face?.descriptors).toMatchObject({ weight: '300' });
  });

  it('also passes every axis at its default as variation settings, for an engine that has them', async () => {
    const face = await registeredFaceOf(fixtureFontBytes('recursive-vf-subset.woff2'));

    expect(face?.descriptors?.variationSettings).toBe('"MONO" 0, "CASL" 0, "wght" 300, "slnt" 0, "CRSV" 0.5');
  });

  it('registers a font with no fvar with no descriptors', async () => {
    const face = await registeredFaceOf(fixtureFontBytes('montserrat-extra-bold.otf'));

    expect(face).toBeDefined();
    expect(face?.descriptors).toBeUndefined();
  });

  it('registers the bytes of a .woff2 itself, never a decoded copy', async () => {
    const bytes = fixtureFontBytes('recursive-vf-subset.woff2');

    const face = await registeredFaceOf(bytes);

    expect(face?.source).toBe(bytes);
  });
});

describe('faceDescriptors', () => {
  it('sets the weight to the wght default and the stretch to the wdth default as a percentage', () => {
    expect(faceDescriptors({ wght: 450, wdth: 87.5 })).toMatchObject({ weight: '450', stretch: '87.5%' });
  });

  it('leaves out the weight and stretch of a font that has neither axis', () => {
    const descriptors = faceDescriptors({ CASL: 0.25 });

    expect(descriptors).toEqual({ variationSettings: '"CASL" 0.25' });
  });

  it('leaves out a weight or stretch that CSS rejects, so the font still loads (error case)', () => {
    const descriptors = faceDescriptors({ wght: 0, wdth: -5, CASL: 1 });

    expect(descriptors).toEqual({ variationSettings: '"wght" 0, "wdth" -5, "CASL" 1' });
  });

  it('answers no descriptors for a font with no axes', () => {
    expect(faceDescriptors({})).toBeUndefined();
  });
});
