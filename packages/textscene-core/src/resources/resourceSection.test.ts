/**
 * The one sub-resource lookup: which section of a parsed `.tres` an address names,
 * its type check, and the single error policy every loader shares.
 */

import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../parser/parsedResource';
import { findResourceSection, sectionLoader } from './resourceSection';

const SHARED_TRES = [
  '[gd_resource type="Theme" load_steps=2 format=3]',
  '',
  '[sub_resource type="FontVariation" id="FontVariation_a"]',
  'spacing_glyph = 2',
  '',
  '[resource]',
  'default_font_size = 20',
  '',
].join('\n');

const FILE = parseTresFile(SHARED_TRES);
const FONT_TYPES = new Set(['FontFile', 'SystemFont', 'FontVariation']);
const loadSection = sectionLoader(async () => FILE);

describe('sectionLoader', () => {
  it.each([
    {
      addresses: 'the [resource] body',
      path: 'res://shared.tres',
      types: new Set(['Theme']),
      section: { type: 'Theme', properties: { default_font_size: '20' } },
    },
    {
      addresses: 'a declared sub-resource, without its echoed id',
      path: 'res://shared.tres::FontVariation_a',
      types: FONT_TYPES,
      section: { type: 'FontVariation', properties: { spacing_glyph: '2' } },
    },
  ])('reads $addresses with the file that owns it', async ({ path, types, section }) => {
    expect(await loadSection(path, types)).toEqual({ file: FILE, ...section });
  });

  it.each([
    {
      addresses: 'the [resource] body',
      path: 'res://shared.tres',
      types: FONT_TYPES,
      message: 'res://shared.tres has type Theme, expected one of FontFile, SystemFont, FontVariation',
    },
    {
      addresses: 'a declared sub-resource',
      path: 'res://shared.tres::FontVariation_a',
      types: new Set(['Theme']),
      message: 'res://shared.tres::FontVariation_a has type FontVariation, expected Theme',
    },
  ])(
    'rejects when $addresses has another type, naming the expected and the found',
    async ({ path, types, message }) => {
      await expect(loadSection(path, types)).rejects.toThrow(message);
    }
  );

  it('rejects for a sub-resource the file does not declare, naming the file and the id', async () => {
    await expect(loadSection('res://shared.tres::Missing_1', FONT_TYPES)).rejects.toThrow(
      'res://shared.tres declares no sub-resource "Missing_1"'
    );
  });

  it('rejects with the reason the owning file failed to load', async () => {
    const failing = sectionLoader(async () => {
      throw new Error('File not found: res://gone.tres');
    });
    await expect(failing('res://gone.tres::Font_1', FONT_TYPES)).rejects.toThrow(
      'File not found: res://gone.tres'
    );
  });
});

describe('findResourceSection', () => {
  it('answers undefined for a sub-resource the file does not declare', () => {
    expect(findResourceSection(FILE, 'res://shared.tres::Missing_1')).toBeUndefined();
  });
});
