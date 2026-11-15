/**
 * The `FONT` kind gives one value for a Font written once, from a `[sub_resource]` of the scene, a
 * `.tres` of its own and a sub-resource of another `.tres`. The file arms answer the font
 * processor's value, so the test builds that value with the real processor and compares it with
 * the decode of the scene's text.
 */

import { describe, expect, it } from 'vitest';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { ResourceLoader } from '../../ResourceLoader';
import { snapshotOver } from '../../reading/snapshot';
import { busServing } from '../../testing/servingFileBus';
import { sceneTables } from '../../reading/reading.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { FONT } from './kind';
import type { FontResource } from './types';

/** A FontVariation with values off their defaults, over a SystemFont written beside it. */
const BASE =
  '[sub_resource type="SystemFont" id="base"]\nfont_names = PackedStringArray("Serif")\nfont_weight = 700';
const VARIATION = [
  '[sub_resource type="FontVariation" id="font"]',
  'base_font = SubResource("base")',
  'fallbacks = Array[Font]([SubResource("base")])',
  'spacing_glyph = 3',
  'variation_embolden = 0.5',
].join('\n');

/** Enough timer ticks for the processor to read a file through the bus. */
const LOAD_TICKS = 5;

/** The value the loader's font processor builds for `address`, served from `files`. */
async function processorValue(files: Record<string, string>, address: string): Promise<FontResource> {
  const { bus, provider } = busServing(files);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  loader.fonts.request(address);
  for (let tick = 0; tick < LOAD_TICKS && loader.fonts.getCached(address) === undefined; tick++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
  const value = loader.fonts.getCached(address);
  if (!value) throw new Error(`expected the font processor to build ${address}, got ${String(value)}`);
  return value;
}

/** The FONT read of `ref` in a scene written as `scene`, with the processor's values for `loaded`. */
function fontAt(ref: string, scene: string, loaded: Record<string, object> = {}): FontResource | null {
  return staticSnapshot({}, loaded).read(nodeReference(ref, sceneTables(scene)), FONT).value;
}

describe('the FONT kind from every origin', () => {
  const inScene = () => fontAt('SubResource("font")', `${BASE}\n\n${VARIATION}`);

  it('decodes a FontVariation of the scene, its base font and its fallbacks', () => {
    expect(inScene()).toMatchObject({
      kind: 'variation',
      baseFont: { kind: 'system', fontNames: ['Serif'], properties: { font_weight: '700' } },
      fallbacks: [{ kind: 'system' }],
      properties: { spacing_glyph: '3', variation_embolden: '0.5' },
    });
  });

  it('decodes the same value from a .tres of its own', async () => {
    const path = 'res://font.tres';
    const tres = `[gd_resource type="FontVariation" format=3]\n\n${BASE}\n\n${VARIATION.replace('[sub_resource type="FontVariation" id="font"]', '[resource]')}\n`;
    const built = await processorValue({ [path]: tres }, path);
    const ext = `[ext_resource type="FontVariation" path="${path}" id="1_font"]`;

    expect(fontAt('ExtResource("1_font")', ext, { [path]: built })).toEqual(inScene());
  });

  it('decodes the same value from a sub-resource of another .tres', async () => {
    const holderPath = 'res://holder.tres';
    const address = `${holderPath}::font`;
    const holder = `[gd_resource type="Resource" format=3]\n\n${BASE}\n\n${VARIATION}\n\n[resource]\n`;
    const built = await processorValue({ [holderPath]: holder }, address);
    // As a decode of the holder follows it: in the holder's tables, with the holder as its origin.
    const reference = {
      ref: 'SubResource("font")',
      resources: sceneTables(`${BASE}\n\n${VARIATION}`),
      origin: holderPath,
      isHeldLocally: false,
    };

    expect(staticSnapshot({}, { [address]: built }).read(reference, FONT).value).toEqual(inScene());
  });
});

describe('a FONT read', () => {
  const FONT_FILE = 'res://font.ttf';
  const EXT = `[ext_resource type="FontFile" path="${FONT_FILE}" id="1_font"]`;
  const FILE_FONT: FontResource = {
    kind: 'file',
    bytes: undefined,
    mimeType: undefined,
    fallbacks: [],
    properties: {},
  };

  it("answers the processor's own object for a font file, so a Label measures it once", () => {
    expect(fontAt('ExtResource("1_font")', EXT, { [FONT_FILE]: FILE_FONT })).toBe(FILE_FONT);
  });

  it('answers the same object for one text read twice', () => {
    const scene = `${EXT}\n\n[sub_resource type="FontVariation" id="v"]\nbase_font = ExtResource("1_font")`;

    expect(fontAt('SubResource("v")', scene, { [FONT_FILE]: FILE_FONT })).toBe(
      fontAt('SubResource("v")', scene, { [FONT_FILE]: FILE_FONT })
    );
  });

  it('keeps a FontVariation whose base font failed, over no base, as Godot draws the default font', () => {
    const scene = `${EXT}\n\n[sub_resource type="FontVariation" id="v"]\nbase_font = ExtResource("1_font")`;

    expect(fontAt('SubResource("v")', scene)).toMatchObject({ kind: 'variation', baseFont: null });
  });

  it('reads no base font for a FontVariation whose base font names itself', () => {
    const scene = '[sub_resource type="FontVariation" id="v"]\nbase_font = SubResource("v")';

    expect(fontAt('SubResource("v")', scene)).toMatchObject({ kind: 'variation', baseFont: null });
  });

  it('refuses a resource of another class', () => {
    const scene = '[sub_resource type="StyleBoxFlat" id="s"]';

    const read = staticSnapshot({}).read(nodeReference('SubResource("s")', sceneTables(scene)), FONT);

    expect(read).toMatchObject({ status: 'unavailable', reason: 'wrong-type' });
  });
});

describe('a FONT read of a Font built into the scene', () => {
  const GOOD = 'res://fonts/good.ttf';
  const FONT_A: FontResource = {
    kind: 'file',
    bytes: new ArrayBuffer(1),
    mimeType: 'font/ttf',
    fallbacks: [],
    properties: {},
  };
  const EXT = [
    { id: '1', path: GOOD, type: 'FontFile' },
    { id: '2', path: 'res://fonts/missing.ttf', type: 'FontFile' },
  ];

  /** The FONT read of `ref` in tables `ext` and `int`, with the good font file loaded. */
  function readIn(ref: string | undefined, int: SceneResources['internalResources'] = []) {
    return staticSnapshot({}, { [GOOD]: FONT_A }).read(
      nodeReference(ref, { externalResources: EXT, internalResources: int }),
      FONT
    );
  }

  /** The `fontNames` an inline SystemFont with this `font_names` value reads. */
  function fontNamesOf(fontNames: string): string[] {
    const font = readIn('SubResource("s")', [
      { id: 's', type: 'SystemFont', data: { font_names: fontNames } },
    ]).value;
    if (font?.kind !== 'system') throw new Error(`expected a SystemFont, got ${font?.kind ?? 'null'}`);
    return font.fontNames;
  }

  it('reads each element of font_names as a String slot does', () => {
    expect(fontNamesOf('PackedStringArray("sans-serif", "Noto Sans")')).toEqual(['sans-serif', 'Noto Sans']);
  });

  it('decodes the escapes the tokenizer decodes in font_names', () => {
    expect(fontNamesOf('PackedStringArray("a\\nb", "say \\"hi\\"")')).toEqual(['a\nb', 'say "hi"']);
  });

  it('reads no font_names from an empty array or another value', () => {
    expect(fontNamesOf('PackedStringArray()')).toEqual([]);
    expect(fontNamesOf('"sans-serif"')).toEqual([]);
  });

  it('reads font_names from the typed and the bare array, which the slot converts', () => {
    expect(fontNamesOf('Array[String](["sans-serif"])')).toEqual(['sans-serif']);
    expect(fontNamesOf('["sans-serif"]')).toEqual(['sans-serif']);
  });

  it('answers pending for a font file still loading', () => {
    const loading = snapshotOver({ getCached: () => undefined, loaded: () => undefined });

    const read = loading.read(
      nodeReference('ExtResource("1")', { externalResources: EXT, internalResources: [] }),
      FONT
    );

    expect(read.status).toBe('pending');
  });

  it('draws a FontVariation over its base font while a fallback still loads, as on main', () => {
    const int = [
      {
        id: 'v',
        type: 'FontVariation',
        data: { base_font: 'ExtResource("1")', fallbacks: 'Array[Font]([ExtResource("3")])' },
      },
    ];
    const ext = [...EXT, { id: '3', path: 'res://fonts/loading.ttf', type: 'FontFile' }];
    const snapshot = snapshotOver({
      getCached: () => undefined,
      loaded: (_fileKind, address) => (address === GOOD ? FONT_A : undefined),
    });

    const read = snapshot.read(
      nodeReference('SubResource("v")', { externalResources: ext, internalResources: int }),
      FONT
    );

    expect(read).toMatchObject({
      status: 'loaded',
      value: { kind: 'variation', baseFont: FONT_A, fallbacks: [] },
    });
  });

  it('reads no font, not pending, for a font file that failed, and says the file is missing', () => {
    expect(readIn('ExtResource("2")')).toMatchObject({ status: 'unavailable', reason: 'missing-file' });
  });

  it('decodes a FontVariation over a font file, with its other properties raw', () => {
    const int = [
      { id: 'v', type: 'FontVariation', data: { base_font: 'ExtResource("1")', spacing_glyph: '-8' } },
    ];

    expect(readIn('SubResource("v")', int).value).toEqual({
      kind: 'variation',
      baseFont: FONT_A,
      fallbacks: [],
      properties: { spacing_glyph: '-8' },
    });
  });

  it('decodes a FontVariation with no base_font to a null base font', () => {
    const int = [{ id: 'v', type: 'FontVariation', data: {} }];

    expect(readIn('SubResource("v")', int).value).toEqual({
      kind: 'variation',
      baseFont: null,
      fallbacks: [],
      properties: {},
    });
  });

  // `fallbacks` is a property of `Font` (`font.cpp:101`), so every Font class reads it.
  it.each(['FontFile', 'FontVariation', 'SystemFont'])(
    'keeps each fallback of a %s that loads, in order',
    (type) => {
      const int = [
        { id: 'f', type, data: { fallbacks: 'Array[Font]([ExtResource("1"), ExtResource("2")])' } },
      ];

      expect(readIn('SubResource("f")', int).value).toMatchObject({ fallbacks: [FONT_A], properties: {} });
    }
  );

  it.each([undefined, 'not-a-ref', 'SubResource("gone")'])('reads no font for %j', (ref) => {
    expect(readIn(ref).value).toBeNull();
  });
});
