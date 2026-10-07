/**
 * The one sub-resource lookup: which section of a parsed `.tres` an address names,
 * its type check, and the single error policy every loader shares.
 */

import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../parser/parsedResource';
import { resourceSection, resourceSectionOfType } from './resourceSection';

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

describe('resourceSection', () => {
  it.each([
    {
      addresses: 'the [resource] body',
      path: 'res://shared.tres',
      section: { type: 'Theme', properties: { default_font_size: '20' } },
    },
    {
      addresses: 'a declared sub-resource, without its echoed id',
      path: 'res://shared.tres::FontVariation_a',
      section: { type: 'FontVariation', properties: { spacing_glyph: '2' } },
    },
  ])('reads $addresses', ({ path, section }) => {
    expect(resourceSection(FILE, path)).toEqual(section);
  });

  it('throws for a sub-resource the file does not declare, naming the file and the id', () => {
    expect(() => resourceSection(FILE, 'res://shared.tres::Missing_1')).toThrow(
      'res://shared.tres declares no sub-resource "Missing_1"'
    );
  });
});

describe('resourceSectionOfType', () => {
  it.each([
    { addresses: 'the [resource] body', path: 'res://shared.tres', types: new Set(['Theme']) },
    { addresses: 'a declared sub-resource', path: 'res://shared.tres::FontVariation_a', types: FONT_TYPES },
  ])('reads $addresses of an accepted type', ({ path, types }) => {
    expect(resourceSectionOfType(FILE, path, types)).toEqual(resourceSection(FILE, path));
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
    'throws when $addresses has another type, naming the expected and the found',
    ({ path, types, message }) => {
      expect(() => resourceSectionOfType(FILE, path, types)).toThrow(message);
    }
  );

  it('throws the absent-id error before any type check', () => {
    expect(() => resourceSectionOfType(FILE, 'res://shared.tres::Missing_1', FONT_TYPES)).toThrow(
      'declares no sub-resource "Missing_1"'
    );
  });
});
